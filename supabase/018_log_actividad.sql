-- =====================================================================
-- 018 - Log de actividad
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 017.
--
-- Quién hizo qué y cuándo. Lo escribe la BASE con triggers, así no se puede saltear desde la aplicación.
--
-- Qué se registra (solo lo del admin y los empleados; lo del cliente NO entra):
--  * Admin: crear / modificar / eliminar / activar / desactivar películas, salas, productos, categorías, combos
--    (y los productos de cada combo), cupones, costos de canje de puntos y configuración; crear, modificar y cancelar
--    funciones; cambiar el rol de una cuenta (asignar o quitar empleados).
--  * Empleados: cada entrada validada y cada entrega de candy.
--  * En las modificaciones se guarda QUÉ cambió, con el valor anterior y el nuevo.
--
-- Reglas:
--  * El usuario es el de la sesión (auth.uid()). Si no hay sesión (por ejemplo, un script ejecutado a mano en el editor
--    SQL) o la cuenta es de un cliente, no se registra nada. Excepción: un CAMBIO DE ROL se registra siempre, para que
--    se vea si alguien se lo cambia sin ser admin.
--  * Crear o modificar una serie de funciones es una sola acción del admin pero la base la escribe función por función:
--    se juntan en UN renglón por transacción y por película ("Creó 8 funciones de ..."), con la lista adentro.
--    Lo mismo pasa con los productos de un combo: un renglón por combo con todos los cambios.
--  * El nombre y el rol del usuario se guardan al momento: el log se sigue entendiendo si después cambian.
--  * No hay borrado automático: se conserva todo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Si de antes quedó una tabla "log_actividad" con otra estructura (sin la columna "lote"), se reemplaza.
--    CUIDADO: la vieja se borra con sus datos (no se usaba). Si ya tiene la estructura nueva, no se toca.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'log_actividad')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'log_actividad' and column_name = 'lote') then
    drop table log_actividad cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) Tabla y vista
-- ---------------------------------------------------------------------
create table if not exists log_actividad (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  usuario_id      uuid references profiles (id) on delete set null,
  usuario_nombre  text not null,
  usuario_rol     text not null,
  accion          text not null check (accion in (
                    'crear', 'modificar', 'eliminar', 'activar', 'desactivar', 'cancelar',
                    'cambiar_rol', 'validar_entrada', 'entregar_candy')),
  entidad         text not null check (entidad in (
                    'funcion', 'pelicula', 'sala', 'producto', 'categoria', 'combo', 'combo_productos',
                    'cupon', 'recompensa', 'configuracion', 'empleado', 'compra')),
  entidad_id      text,
  descripcion     text not null,
  detalle         jsonb,
  lote            bigint not null default txid_current()  -- transacción que lo escribió: junta varias escrituras de una misma acción
);

create index if not exists log_actividad_fecha_idx   on log_actividad (created_at desc);
create index if not exists log_actividad_usuario_idx on log_actividad (usuario_id, created_at desc);

-- Las funciones y los productos de un combo se escriben de a uno pero son una sola acción del admin: hay UNA sola fila por
-- (transacción, usuario, acción, elemento) y es la que se va completando (ver log_agrupar)
create unique index if not exists log_actividad_lote_unico
  on log_actividad (lote, usuario_id, accion, entidad, entidad_id)
  where entidad in ('funcion', 'combo_productos');

-- Los usuarios que tienen actividad (para el filtro de la pantalla)
create or replace view log_usuarios as
select usuario_id,
       max(usuario_nombre) as usuario_nombre,
       max(usuario_rol)    as usuario_rol
  from log_actividad
 where usuario_id is not null
 group by usuario_id;

-- ---------------------------------------------------------------------
-- 2) Piezas comunes
-- ---------------------------------------------------------------------

-- La cuenta que hizo la acción, o una fila vacía si no se tiene que registrar (sin sesión, o es un cliente)
create or replace function log_actor(p_usuario uuid, p_incluir_clientes boolean)
returns profiles
language plpgsql
stable
as $$
declare
  v_uid uuid := coalesce(p_usuario, auth.uid());
  v_p   profiles%rowtype;
begin
  if v_uid is null then
    return v_p;
  end if;
  select * into v_p from profiles where id = v_uid;
  if not found or (v_p.rol = 'cliente' and not p_incluir_clientes) then
    return null;
  end if;
  return v_p;
end;
$$;

-- Escribe un renglón del log
create or replace function log_registrar(
  p_accion            text,
  p_entidad           text,
  p_entidad_id        text,
  p_descripcion       text,
  p_detalle           jsonb,
  p_usuario           uuid    default null,
  p_incluir_clientes  boolean default false
)
returns void
language plpgsql
as $$
declare
  v_p profiles%rowtype := log_actor(p_usuario, p_incluir_clientes);
begin
  if v_p.id is null then
    return;
  end if;
  insert into log_actividad (usuario_id, usuario_nombre, usuario_rol, accion, entidad, entidad_id, descripcion, detalle)
  values (v_p.id, trim(v_p.nombre || ' ' || v_p.apellido), v_p.rol, p_accion, p_entidad, p_entidad_id, p_descripcion, p_detalle);
end;
$$;

-- Escribe un renglón que se va completando durante la transacción: la primera escritura lo crea y las siguientes
-- le suman un elemento a la lista del detalle (p_clave) y actualizan la cantidad y la descripción.
--   p_texto_uno:    descripción cuando hay uno solo.   p_texto_varios: con %s donde va la cantidad.
create or replace function log_agrupar(
  p_accion        text,
  p_entidad       text,
  p_entidad_id    text,
  p_clave         text,
  p_item          jsonb,
  p_texto_uno     text,
  p_texto_varios  text
)
returns void
language plpgsql
as $$
declare
  v_p profiles%rowtype := log_actor(null, false);
begin
  if v_p.id is null then
    return;
  end if;

  insert into log_actividad (usuario_id, usuario_nombre, usuario_rol, accion, entidad, entidad_id, descripcion, detalle)
  values (v_p.id, trim(v_p.nombre || ' ' || v_p.apellido), v_p.rol, p_accion, p_entidad, p_entidad_id, p_texto_uno,
          jsonb_build_object(p_clave, jsonb_build_array(p_item), 'cantidad', 1))
  on conflict (lote, usuario_id, accion, entidad, entidad_id) where entidad in ('funcion', 'combo_productos')
  do update set
    detalle     = jsonb_build_object(p_clave, log_actividad.detalle->p_clave || excluded.detalle->p_clave,
                                     'cantidad', (log_actividad.detalle->>'cantidad')::int + 1),
    descripcion = format(p_texto_varios, (log_actividad.detalle->>'cantidad')::int + 1);
end;
$$;

-- Qué campos cambiaron entre dos versiones de una fila: {campo: {antes, despues}} (null si no cambió nada)
create or replace function log_diferencias(p_viejo jsonb, p_nuevo jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_object_agg(n.key, jsonb_build_object('antes', p_viejo->n.key, 'despues', n.value))
    from jsonb_each(p_nuevo) n
   where n.key not in ('created_at', 'updated_at')
     and (p_viejo->n.key) is distinct from n.value;
$$;

-- Los identificadores de otra tabla no se leen: el log guarda el NOMBRE de lo que había en ese momento.
-- Hoy el único caso es la categoría de un producto (categoria_id -> categoria).
create or replace function log_resolver_datos(p_datos jsonb)
returns jsonb
language sql
stable
as $$
  select case
           when p_datos ? 'categoria_id' then
             (p_datos - 'categoria_id') || jsonb_build_object(
               'categoria', (select nombre from categorias_producto where id = (p_datos->>'categoria_id')::uuid))
           else p_datos
         end;
$$;

-- Lo mismo para un cambio {campo: {antes, despues}}
create or replace function log_resolver_cambios(p_cambios jsonb)
returns jsonb
language sql
stable
as $$
  select case
           when p_cambios ? 'categoria_id' then
             (p_cambios - 'categoria_id') || jsonb_build_object(
               'categoria', jsonb_build_object(
                 'antes',   (select nombre from categorias_producto where id = (p_cambios->'categoria_id'->>'antes')::uuid),
                 'despues', (select nombre from categorias_producto where id = (p_cambios->'categoria_id'->>'despues')::uuid)))
           else p_cambios
         end;
$$;

-- ---------------------------------------------------------------------
-- 3) Trigger genérico: películas, salas, productos, categorías, combos, cupones, recompensas y configuración
--    Argumentos: entidad, columna con el nombre, cómo se nombra ("la película")
-- ---------------------------------------------------------------------
create or replace function log_registrar_cambio()
returns trigger
language plpgsql
as $$
declare
  v_entidad   text := tg_argv[0];
  v_columna   text := tg_argv[1];
  v_label     text := tg_argv[2];
  v_nuevo     jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_viejo     jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_ref       jsonb := coalesce(v_nuevo, v_viejo);
  v_dif       jsonb;
  v_accion    text;
  v_verbo     text;
  v_detalle   jsonb;
begin
  if tg_op = 'INSERT' then
    v_accion := 'crear';    v_verbo := 'Creó';
    v_detalle := jsonb_build_object('datos', log_resolver_datos(v_nuevo - 'id' - 'created_at'));
  elsif tg_op = 'DELETE' then
    v_accion := 'eliminar'; v_verbo := 'Eliminó';
    v_detalle := jsonb_build_object('datos', log_resolver_datos(v_viejo - 'id' - 'created_at'));
  else
    v_dif := log_diferencias(v_viejo, v_nuevo);
    if v_dif is null then
      return null; -- no cambió nada que valga la pena registrar
    end if;
    -- si lo único que cambió es activar o desactivar, se registra así
    if (select count(*) from jsonb_object_keys(v_dif)) = 1 and (v_dif ? 'activa' or v_dif ? 'activo') then
      if coalesce((v_nuevo->>'activa')::boolean, (v_nuevo->>'activo')::boolean) then
        v_accion := 'activar';    v_verbo := 'Activó';
      else
        v_accion := 'desactivar'; v_verbo := 'Desactivó';
      end if;
    else
      v_accion := 'modificar'; v_verbo := 'Modificó';
    end if;
    v_detalle := jsonb_build_object('cambios', log_resolver_cambios(v_dif));
  end if;

  perform log_registrar(
    v_accion, v_entidad, coalesce(v_ref->>'id', v_ref->>'clave'),
    format('%s %s "%s"', v_verbo, v_label, v_ref->>v_columna),
    v_detalle
  );
  return null;
end;
$$;

drop trigger if exists log_peliculas on peliculas;
create trigger log_peliculas after insert or update or delete on peliculas
  for each row execute function log_registrar_cambio('pelicula', 'nombre', 'la película');

drop trigger if exists log_salas on salas;
create trigger log_salas after insert or update or delete on salas
  for each row execute function log_registrar_cambio('sala', 'nombre', 'la sala');

drop trigger if exists log_productos on productos;
create trigger log_productos after insert or update or delete on productos
  for each row execute function log_registrar_cambio('producto', 'nombre', 'el producto');

drop trigger if exists log_categorias_producto on categorias_producto;
create trigger log_categorias_producto after insert or update or delete on categorias_producto
  for each row execute function log_registrar_cambio('categoria', 'nombre', 'la categoría');

drop trigger if exists log_combos on combos;
create trigger log_combos after insert or update or delete on combos
  for each row execute function log_registrar_cambio('combo', 'nombre', 'el combo');

drop trigger if exists log_cupones on cupones;
create trigger log_cupones after insert or update or delete on cupones
  for each row execute function log_registrar_cambio('cupon', 'nombre', 'el cupón');

drop trigger if exists log_recompensas on recompensas;
create trigger log_recompensas after insert or update or delete on recompensas
  for each row execute function log_registrar_cambio('recompensa', 'nombre', 'la recompensa');

drop trigger if exists log_configuracion on configuracion;
create trigger log_configuracion after insert or update or delete on configuracion
  for each row execute function log_registrar_cambio('configuracion', 'clave', 'la configuración');

-- ---------------------------------------------------------------------
-- 4) Funciones: una serie es una sola acción del admin. Se juntan en un renglón por película y transacción.
-- ---------------------------------------------------------------------
create or replace function log_registrar_funcion()
returns trigger
language plpgsql
as $$
declare
  v_f        funciones%rowtype := case when tg_op = 'DELETE' then old else new end;
  v_pelicula text;
  v_sala     int;
  v_dif      jsonb;
  v_accion   text;
  v_item     jsonb;
  v_verbo1   text;
  v_verbo2   text;
begin
  select nombre into v_pelicula from peliculas where id = v_f.pelicula_id;
  select numero into v_sala     from salas     where id = v_f.sala_id;

  if tg_op = 'INSERT' then
    v_accion := 'crear';    v_verbo1 := 'Creó';    v_verbo2 := 'Creó';
    v_item := jsonb_build_object('inicio', new.inicio, 'sala', v_sala, 'idioma', new.idioma,
                                 'precio_base', new.precio_base, 'con_preventa', new.con_preventa);
  elsif tg_op = 'DELETE' then
    v_accion := 'eliminar'; v_verbo1 := 'Eliminó'; v_verbo2 := 'Eliminó';
    v_item := jsonb_build_object('inicio', old.inicio, 'sala', v_sala);
  else
    v_dif := log_diferencias(to_jsonb(old), to_jsonb(new)) - 'fin_bloqueo' - 'serie_id';
    -- la sala se muestra con su número, no con su identificador
    if v_dif ? 'sala_id' then
      v_dif := (v_dif - 'sala_id') || jsonb_build_object('sala', jsonb_build_object(
                 'antes', (select numero from salas where id = old.sala_id),
                 'despues', v_sala));
    end if;
    if v_dif is null or v_dif = '{}'::jsonb then
      return null;
    end if;
    if v_dif ? 'activa' and (v_dif->'activa'->>'despues')::boolean = false then
      v_accion := 'cancelar'; v_verbo1 := 'Canceló'; v_verbo2 := 'Canceló';
    else
      v_accion := 'modificar'; v_verbo1 := 'Modificó'; v_verbo2 := 'Modificó';
    end if;
    v_item := jsonb_build_object('inicio', new.inicio, 'cambios', v_dif);
  end if;

  perform log_agrupar(
    v_accion, 'funcion', v_f.pelicula_id::text, 'funciones', v_item,
    format('%s 1 función de "%s"', v_verbo1, v_pelicula),
    v_verbo2 || ' %s funciones de "' || replace(v_pelicula, '%', '%%') || '"'
  );
  return null;
end;
$$;

drop trigger if exists log_funciones on funciones;
create trigger log_funciones after insert or update or delete on funciones
  for each row execute function log_registrar_funcion();

-- ---------------------------------------------------------------------
-- 5) Productos de un combo: un renglón por combo con todos los cambios de la transacción
-- ---------------------------------------------------------------------
create or replace function log_registrar_combo_item()
returns trigger
language plpgsql
as $$
declare
  v_combo_id uuid := case when tg_op = 'DELETE' then old.combo_id else new.combo_id end;
  v_producto uuid := case when tg_op = 'DELETE' then old.producto_id else new.producto_id end;
  v_nombre   text;
  v_item     jsonb;
begin
  select nombre into v_nombre from combos where id = v_combo_id;
  if v_nombre is null then
    return null; -- el combo se está eliminando: ya queda registrado como combo eliminado
  end if;

  -- si el combo se creó en esta misma transacción, sus productos ya figuran en el renglón de "Creó el combo"
  if tg_op = 'INSERT' and exists (
       select 1 from log_actividad
        where lote = txid_current() and entidad = 'combo' and accion = 'crear' and entidad_id = v_combo_id::text) then
    return null;
  end if;

  v_item := jsonb_build_object(
    'producto', (select nombre from productos where id = v_producto),
    'antes',    case when tg_op = 'INSERT' then null else old.cantidad end,
    'despues',  case when tg_op = 'DELETE' then null else new.cantidad end
  );

  perform log_agrupar(
    'modificar', 'combo_productos', v_combo_id::text, 'productos', v_item,
    format('Modificó los productos del combo "%s"', v_nombre),
    'Modificó los productos del combo "' || replace(v_nombre, '%', '%%') || '" (%s cambios)'
  );
  return null;
end;
$$;

drop trigger if exists log_combo_items on combo_items;
create trigger log_combo_items after insert or update or delete on combo_items
  for each row execute function log_registrar_combo_item();

-- ---------------------------------------------------------------------
-- 6) Cambio de rol (asignar o quitar empleados). Se registra siempre, sea quien sea el que lo hace.
-- ---------------------------------------------------------------------
create or replace function log_registrar_rol()
returns trigger
language plpgsql
as $$
begin
  if new.rol is distinct from old.rol then
    perform log_registrar(
      'cambiar_rol', 'empleado', new.id::text,
      format('Cambió el rol de %s (%s)', trim(new.nombre || ' ' || new.apellido), new.email),
      jsonb_build_object('cambios', jsonb_build_object('rol', jsonb_build_object('antes', old.rol, 'despues', new.rol))),
      null, true
    );
  end if;
  return null;
end;
$$;

drop trigger if exists log_rol on profiles;
create trigger log_rol after update of rol on profiles
  for each row execute function log_registrar_rol();

-- ---------------------------------------------------------------------
-- 7) Validaciones en el cine: entrada validada y candy entregado (a nombre del empleado que lo hizo)
-- ---------------------------------------------------------------------
create or replace function log_registrar_validacion()
returns trigger
language plpgsql
as $$
declare
  v_pelicula text;
  v_inicio   timestamptz;
begin
  select p.nombre, f.inicio into v_pelicula, v_inicio
    from funciones f join peliculas p on p.id = f.pelicula_id
   where f.id = new.funcion_id;

  if old.entrada_validada_at is null and new.entrada_validada_at is not null then
    perform log_registrar(
      'validar_entrada', 'compra', new.id::text,
      format('Validó la entrada %s de "%s"', new.codigo, v_pelicula),
      jsonb_build_object('datos', jsonb_build_object('codigo', new.codigo, 'pelicula', v_pelicula, 'inicio', v_inicio)),
      new.entrada_validada_por
    );
  end if;

  if old.candy_entregado_at is null and new.candy_entregado_at is not null then
    perform log_registrar(
      'entregar_candy', 'compra', new.id::text,
      format('Entregó el candy de la compra %s ("%s")', new.codigo, v_pelicula),
      jsonb_build_object('datos', jsonb_build_object('codigo', new.codigo, 'pelicula', v_pelicula, 'inicio', v_inicio)),
      new.candy_entregado_por
    );
  end if;
  return null;
end;
$$;

drop trigger if exists log_validacion on compras;
create trigger log_validacion after update of entrada_validada_at, candy_entregado_at on compras
  for each row execute function log_registrar_validacion();

-- ---------------------------------------------------------------------
-- 8) guardar_combo (reemplaza a la de 013): ahora no borra y vuelve a crear todos los productos del combo, solo toca los
--    que cambian (borra los que se sacaron, agrega los nuevos y actualiza las cantidades). El resultado es el mismo,
--    pero así el log registra solo lo que cambió de verdad.
-- ---------------------------------------------------------------------
create or replace function guardar_combo(p_id uuid, p_datos jsonb, p_items jsonb)
returns combos
language plpgsql
as $$
declare
  v_combo combos%rowtype;
  v_n     int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El combo tiene que incluir al menos un producto';
  end if;
  v_n := jsonb_array_length(p_items);

  if (select count(distinct e->>'producto_id') from jsonb_array_elements(p_items) e) <> v_n then
    raise exception 'Hay productos repetidos en el combo';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
              where (e->>'cantidad')::int is null or (e->>'cantidad')::int < 1) then
    raise exception 'La cantidad de cada producto tiene que ser 1 o más';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
              where not exists (select 1 from productos p where p.id = (e->>'producto_id')::uuid)) then
    raise exception 'Alguno de los productos elegidos no existe';
  end if;

  if p_id is null then
    insert into combos (nombre, descripcion, imagen_url, precio, cantidad_entradas, orden, activo, destacado)
    values (trim(p_datos->>'nombre'), nullif(trim(p_datos->>'descripcion'), ''), p_datos->>'imagen_url',
            (p_datos->>'precio')::numeric, (p_datos->>'cantidad_entradas')::int,
            coalesce((p_datos->>'orden')::int, 0), coalesce((p_datos->>'activo')::boolean, true),
            coalesce((p_datos->>'destacado')::boolean, false))
    returning * into v_combo;
  else
    update combos
       set nombre            = trim(p_datos->>'nombre'),
           descripcion       = nullif(trim(p_datos->>'descripcion'), ''),
           imagen_url        = p_datos->>'imagen_url',
           precio            = (p_datos->>'precio')::numeric,
           cantidad_entradas = (p_datos->>'cantidad_entradas')::int,
           orden             = coalesce((p_datos->>'orden')::int, 0),
           activo            = coalesce((p_datos->>'activo')::boolean, true),
           destacado         = coalesce((p_datos->>'destacado')::boolean, false)
     where id = p_id
     returning * into v_combo;
    if not found then
      raise exception 'El combo no existe';
    end if;
  end if;

  -- se sacan los productos que ya no están, y se agregan o actualizan los demás (los que no cambian no se tocan)
  delete from combo_items
   where combo_id = v_combo.id
     and producto_id not in (select (e->>'producto_id')::uuid from jsonb_array_elements(p_items) e);

  insert into combo_items (combo_id, producto_id, cantidad)
  select v_combo.id, (e->>'producto_id')::uuid, (e->>'cantidad')::int
    from jsonb_array_elements(p_items) e
  on conflict (combo_id, producto_id)
  do update set cantidad = excluded.cantidad
  where combo_items.cantidad is distinct from excluded.cantidad;

  return v_combo;
end;
$$;

