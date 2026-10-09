-- =====================================================================
-- 019 · S15 · Seguridad: RLS (Row Level Security) en todas las tablas
--
-- Qué hace este script, en orden:
--   1) Helpers: rol_actual(), es_admin(), exigir_admin(), exigir_duenio_compra().
--   2) Funciones nuevas: butacas_ocupadas, resenias_de_pelicula y buscar_entrada (ahora devuelve la entrada completa),
--      más el broadcast de butacas (reemplaza a postgres_changes sobre compra_butacas).
--   3) Controles de rol dentro de las funciones que no los tenían (admin / dueño de la compra).
--   4) Todas las funciones pasan a SECURITY DEFINER con search_path fijo y se revoca el EXECUTE a todos;
--      después se otorga solo lo que cada rol necesita.
--   5) Se activa RLS en TODAS las tablas de public y se escriben las políticas por tabla.
--   6) Vistas, almacenamiento (bucket imagenes) y Realtime.
--
-- Cómo correrlo: pegar todo en el SQL Editor de Supabase y ejecutar (una sola vez; se puede repetir sin romper nada).
-- Antes: tener al menos un usuario con rol 'admin' en profiles (si no, nadie podría administrar).
-- Marcha atrás de emergencia: ver el bloque comentado al final.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Helpers
--    SECURITY DEFINER: se ejecutan con los permisos del dueño de la función, así pueden leer profiles aunque la
--    persona que llama no pueda. search_path fijo: evita que alguien "tape" una tabla con otra del mismo nombre.
-- ---------------------------------------------------------------------
create or replace function rol_actual()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rol from profiles where id = auth.uid();
$$;

create or replace function es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(rol_actual() = 'admin', false);
$$;

-- Corta con error si quien llama no es admin (se inyecta al principio de las funciones de administración)
create or replace function exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not es_admin() then
    raise exception 'No tenés permiso para hacer esto' using errcode = '42501';
  end if;
end;
$$;

-- Una compra con cuenta solo la puede tocar su dueño. Las compras sin cuenta (usuario_id nulo) se manejan con su id,
-- que es un uuid imposible de adivinar y que solo conoce quien la creó.
create or replace function exigir_duenio_compra(p_compra_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_dueno uuid;
begin
  select usuario_id into v_dueno from compras where id = p_compra_id;
  if v_dueno is not null and v_dueno is distinct from auth.uid() then
    raise exception 'La compra no existe';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Funciones nuevas
-- ---------------------------------------------------------------------

-- Butacas ocupadas de una función SIN datos de quién las compró (lo único que necesita el mapa del cliente).
-- Descarta las reservas ya vencidas, igual que hacía la app.
create or replace function butacas_ocupadas(p_funcion_id uuid)
returns table (butaca_codigo text, estado text, reservada_hasta timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cb.butaca_codigo, cb.estado, cb.reservada_hasta
    from compra_butacas cb
   where cb.funcion_id = p_funcion_id
     and (cb.estado = 'vendida'
          or (cb.estado = 'reservada' and (cb.reservada_hasta is null or cb.reservada_hasta > now())));
$$;

-- Reseñas de una película con el autor como "Nombre I." (el apellido nunca sale completo).
-- Mantiene la forma que ya usaba la app: la reseña + profiles { nombre, apellido }.
create or replace function resenias_de_pelicula(p_pelicula_id uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select to_jsonb(r) || jsonb_build_object(
           'profiles', jsonb_build_object('nombre', p.nombre, 'apellido', left(p.apellido, 1)))
    from resenias r
    join profiles p on p.id = r.usuario_id
   where r.pelicula_id = p_pelicula_id
   order by r.created_at desc;
$$;

-- buscar_entrada: antes devolvía el id y la app leía la tabla compras; ahora compras está cerrada y la función
-- devuelve la entrada completa (misma forma que el select de la app). Mismo error si código y email no coinciden.
drop function if exists buscar_entrada(text, text);
create or replace function buscar_entrada(p_codigo text, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_c compras%rowtype;
begin
  select * into v_c
    from compras
   where replace(codigo, '-', '') = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
     and lower(email) = lower(trim(coalesce(p_email, '')))
     and pagada_at is not null
     and estado in ('pagada', 'cancelada');

  if not found then
    raise exception 'No encontramos una entrada con esos datos';
  end if;

  return to_jsonb(v_c) || jsonb_build_object(
    'funciones', (
      select to_jsonb(f2) || jsonb_build_object(
               'peliculas', (select jsonb_build_object('nombre', pe.nombre, 'imagen_url', pe.imagen_url,
                                                       'restriccion_edad', pe.restriccion_edad)
                               from peliculas pe where pe.id = f2.pelicula_id),
               'salas', (select jsonb_build_object('numero', s.numero, 'formato', s.formato)
                           from salas s where s.id = f2.sala_id))
        from funciones f2 where f2.id = v_c.funcion_id),
    'compra_butacas', coalesce((select jsonb_agg(jsonb_build_object('butaca_codigo', cb.butaca_codigo))
                                  from compra_butacas cb where cb.compra_id = v_c.id), '[]'::jsonb),
    'compra_items', coalesce((select jsonb_agg(jsonb_build_object(
                                'nombre', ci.nombre, 'cantidad', ci.cantidad, 'precio_unitario', ci.precio_unitario,
                                'puntos_unitarios', ci.puntos_unitarios, 'combo_nombre', ci.combo_nombre))
                                from compra_items ci where ci.compra_id = v_c.id), '[]'::jsonb),
    'compra_combos', coalesce((select jsonb_agg(jsonb_build_object('nombre', cc.nombre, 'cantidad', cc.cantidad))
                                 from compra_combos cc where cc.compra_id = v_c.id), '[]'::jsonb)
  );
end;
$$;

-- Tiempo real de las butacas por broadcast: cada cambio en compra_butacas emite un mensaje mínimo
-- (código, estado) a un canal PRIVADO por función. No lleva compra, precio ni datos personales.
create or replace function butacas_emitir_cambio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila compra_butacas%rowtype := case when tg_op = 'DELETE' then old else new end;
begin
  perform realtime.send(
    jsonb_build_object(
      'butaca_codigo', v_fila.butaca_codigo,
      'estado', case when tg_op = 'DELETE' then 'liberada' else v_fila.estado end),
    'cambio',
    'butacas:' || v_fila.funcion_id,
    true);   -- true = canal privado (se controla con la política de realtime.messages, más abajo)
  return null;
end;
$$;

drop trigger if exists compra_butacas_broadcast on compra_butacas;
create trigger compra_butacas_broadcast
  after insert or update or delete on compra_butacas
  for each row execute function butacas_emitir_cambio();

-- ---------------------------------------------------------------------
-- 3) Controles de rol dentro de las funciones existentes
--    En vez de reescribir 70 cuerpos, se toma la definición actual (pg_get_functiondef) y se agrega una línea
--    al principio del cuerpo. Se aplica a todas las sobrecargas con ese nombre y se verifica al final.
-- ---------------------------------------------------------------------
do $$
declare
  r        record;
  v_def    text;
  v_nueva  text;
  v_admin  text[] := array['crear_funciones', 'modificar_funciones', 'cancelar_funcion', 'resumen_cancelacion',
                           'resumen_postergar_estreno', 'guardar_combo'];
  v_duenio text[] := array['confirmar_pago', 'liberar_compra'];
begin
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and p.proname = any (v_admin || v_duenio)
  loop
    v_def := pg_get_functiondef(r.oid);
    continue when v_def like '%exigir_admin()%' or v_def like '%exigir_duenio_compra(%';

    v_nueva := regexp_replace(
      v_def,
      E'\\n(begin)[ \\t]*\\r?\\n',
      case when r.proname = any (v_admin)
           then E'\n\\1\n  perform exigir_admin();\n'
           else E'\n\\1\n  perform exigir_duenio_compra(p_compra_id);\n' end,
      'i');

    if v_nueva = v_def then
      raise exception 'No se pudo agregar el control de rol a la función %', r.proname;
    end if;
    execute v_nueva;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Todas las funciones: SECURITY DEFINER + search_path fijo + permisos de ejecución
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  -- las puede llamar cualquiera (la compra sin cuenta y el catálogo)
  v_publicas text[] := array['reservar_butacas', 'definir_candy_compra', 'confirmar_pago', 'liberar_compra',
                             'buscar_entrada', 'butacas_ocupadas', 'resenias_de_pelicula', 'peliculas_mas_vendidas',
                             'puede_resenar'];
  -- requieren sesión; el rol (admin / empleado) lo controla cada función por dentro
  v_sesion text[] := array['cancelar_compra', 'mi_cupon', 'guardar_resenia', 'eliminar_resenia', 'mis_peliculas',
                           'activar_alerta', 'quitar_alerta', 'revisar_alertas', 'evaluar_codigo', 'validar_codigo',
                           'crear_funciones', 'modificar_funciones', 'cancelar_funcion', 'resumen_cancelacion',
                           'resumen_postergar_estreno', 'guardar_combo', 'reporte_facturacion',
                           'ranking_peliculas', 'ranking_productos', 'ranking_combos'];
begin
  for r in
    select p.oid::regprocedure as firma, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')   -- no tocar extensiones
  loop
    execute format('alter function %s security definer set search_path = public, pg_temp', r.firma);
    execute format('revoke execute on function %s from public, anon, authenticated', r.firma);

    if r.proname = any (v_publicas) then
      execute format('grant execute on function %s to anon, authenticated', r.firma);
    elsif r.proname = any (v_sesion) then
      execute format('grant execute on function %s to authenticated', r.firma);
    end if;
    -- el resto (colocar_funcion, compensar_compra, log_*, validar_*, triggers...) son internas: nadie las llama desde afuera
  end loop;
end;
$$;

-- Las funciones de ayuda de las políticas sí las tienen que poder ejecutar quienes consultan las tablas
grant execute on function rol_actual(), es_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) RLS: se activa en TODAS las tablas de public (si se escapó alguna, queda cerrada por defecto)
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', r.tablename);
  end loop;
end;
$$;

-- Permisos que ninguna política podría limitar (TRUNCATE ignora RLS) y que la app nunca usa
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- 5.1) Catálogo: lo lee cualquiera (también sin sesión); lo modifica solo el admin
do $$
declare
  t text;
begin
  foreach t in array array['generos', 'peliculas', 'pelicula_generos', 'salas', 'butacas', 'funciones', 'configuracion',
                           'categorias_producto', 'productos', 'combos', 'combo_items']
  loop
    execute format('drop policy if exists %I on %I', t || '_lectura', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_lectura', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('create policy %I on %I for all to authenticated using (es_admin()) with check (es_admin())',
                   t || '_admin', t);
  end loop;
end;
$$;

-- 5.2) Reseñas: las lee cualquiera; se escriben solo con las funciones (guardar_resenia / eliminar_resenia)
drop policy if exists resenias_lectura on resenias;
create policy resenias_lectura on resenias for select to anon, authenticated using (true);

-- 5.3) Recompensas (canje de puntos): las ven las cuentas; las modifica el admin
drop policy if exists recompensas_lectura on recompensas;
create policy recompensas_lectura on recompensas for select to authenticated using (true);
drop policy if exists recompensas_admin on recompensas;
create policy recompensas_admin on recompensas for all to authenticated using (es_admin()) with check (es_admin());

-- 5.4) Cupones: solo el admin (el cliente usa mi_cupon(), que es una función)
drop policy if exists cupones_admin on cupones;
create policy cupones_admin on cupones for all to authenticated using (es_admin()) with check (es_admin());

-- 5.5) profiles: cada cuenta ve la suya, el admin ve todas.
--      Alta: una cuenta solo puede crear SU fila, como cliente y sin saldos (nadie se regala rol, puntos ni crédito).
--      Cambios: solo el admin y solo la columna rol (ver los grants de columnas más abajo).
drop policy if exists profiles_lectura on profiles;
create policy profiles_lectura on profiles for select to authenticated
  using (id = auth.uid() or es_admin());

drop policy if exists profiles_alta on profiles;
create policy profiles_alta on profiles for insert to authenticated
  with check (id = auth.uid() and rol = 'cliente' and puntos = 0 and credito = 0);

drop policy if exists profiles_cambio_rol on profiles;
create policy profiles_cambio_rol on profiles for update to authenticated
  using (es_admin()) with check (es_admin());

revoke update on profiles from authenticated;
grant update (rol) on profiles to authenticated;

-- 5.6) Datos propios (el admin ve las compras para el mapa de butacas de la función)
drop policy if exists compras_propias on compras;
create policy compras_propias on compras for select to authenticated
  using (usuario_id = auth.uid() or es_admin());

drop policy if exists compra_butacas_propias on compra_butacas;
create policy compra_butacas_propias on compra_butacas for select to authenticated
  using (es_admin() or compra_id in (select id from compras where usuario_id = auth.uid()));

drop policy if exists compra_items_propios on compra_items;
create policy compra_items_propios on compra_items for select to authenticated
  using (compra_id in (select id from compras where usuario_id = auth.uid()));

drop policy if exists compra_combos_propios on compra_combos;
create policy compra_combos_propios on compra_combos for select to authenticated
  using (compra_id in (select id from compras where usuario_id = auth.uid()));

drop policy if exists puntos_movimientos_propios on puntos_movimientos;
create policy puntos_movimientos_propios on puntos_movimientos for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists credito_movimientos_propios on credito_movimientos;
create policy credito_movimientos_propios on credito_movimientos for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists alertas_estreno_propias on alertas_estreno;
create policy alertas_estreno_propias on alertas_estreno for select to authenticated
  using (usuario_id = auth.uid());

-- Notificaciones: las ve y las marca como leídas su dueño (solo la columna leida). Las crean las funciones.
drop policy if exists notificaciones_propias on notificaciones;
create policy notificaciones_propias on notificaciones for select to authenticated
  using (usuario_id = auth.uid());
drop policy if exists notificaciones_marcar_leida on notificaciones;
create policy notificaciones_marcar_leida on notificaciones for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke update on notificaciones from authenticated;
grant update (leida) on notificaciones to authenticated;

-- 5.7) Log de actividad: lo lee solo el admin. Lo escriben los triggers (funciones SECURITY DEFINER).
drop policy if exists log_actividad_admin on log_actividad;
create policy log_actividad_admin on log_actividad for select to authenticated using (es_admin());

-- ---------------------------------------------------------------------
-- 6) Vistas, almacenamiento y Realtime
-- ---------------------------------------------------------------------

-- log_usuarios: con security_invoker la vista respeta las políticas de quien consulta (solo el admin ve algo)
alter view log_usuarios set (security_invoker = true);
revoke all on log_usuarios from anon;

-- peliculas_puntuacion: solo promedios y cantidades; es pública a propósito (cartelera sin sesión)
grant select on peliculas_puntuacion to anon, authenticated;

-- Imágenes: se ven todas, pero subir solo puede el admin (antes podía cualquier cuenta con sesión)
drop policy if exists imagenes_subida_con_sesion on storage.objects;
drop policy if exists imagenes_subida_admin on storage.objects;
create policy imagenes_subida_admin on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes' and es_admin());

-- Realtime de butacas: cualquiera puede ESCUCHAR los canales 'butacas:<funcion>'; nadie puede enviar desde el cliente
drop policy if exists butacas_broadcast_lectura on realtime.messages;
create policy butacas_broadcast_lectura on realtime.messages for select to anon, authenticated
  using (realtime.messages.extension = 'broadcast' and (select realtime.topic()) like 'butacas:%');

-- ---------------------------------------------------------------------
-- 7) Verificaciones (si algo no cierra, el script se corta con un error claro)
-- ---------------------------------------------------------------------
do $$
declare
  v_faltan text;
begin
  -- las funciones de administración y de compra tienen que llevar el control inyectado
  select string_agg(distinct p.proname, ', ') into v_faltan
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and ((p.proname in ('crear_funciones', 'modificar_funciones', 'cancelar_funcion', 'resumen_cancelacion',
                         'resumen_postergar_estreno', 'guardar_combo') and p.prosrc not like '%exigir_admin()%')
       or (p.proname in ('confirmar_pago', 'liberar_compra') and p.prosrc not like '%exigir_duenio_compra(%'));
  if v_faltan is not null then
    raise exception 'Faltan los controles de rol en: %', v_faltan;
  end if;

  -- ninguna función de public puede quedar sin SECURITY DEFINER
  select string_agg(p.oid::regprocedure::text, ', ') into v_faltan
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and not p.prosecdef
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
  if v_faltan is not null then
    raise exception 'Funciones sin SECURITY DEFINER: %', v_faltan;
  end if;

  -- tablas sin RLS
  select string_agg(tablename, ', ') into v_faltan from pg_tables where schemaname = 'public' and not rowsecurity;
  if v_faltan is not null then
    raise exception 'Tablas sin RLS: %', v_faltan;
  end if;
end;
$$;

-- Para revisar a mano: tablas con RLS pero SIN políticas (quedan cerradas para todos; tiene que ser solo lo que esperás)
-- select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r'
--    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);

-- ---------------------------------------------------------------------
-- MARCHA ATRÁS DE EMERGENCIA (solo si una pantalla clave se rompe y necesitás tiempo para corregir):
--   do $$ declare r record; begin
--     for r in select tablename from pg_tables where schemaname = 'public' loop
--       execute format('alter table %I disable row level security', r.tablename);
--     end loop; end $$;
-- =====================================================================
