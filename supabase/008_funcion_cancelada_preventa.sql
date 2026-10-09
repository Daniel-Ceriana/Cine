-- =====================================================================
-- 008 - Función cancelada con compradores y preventa por película
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 007.
-- Cambia: la preventa pasa de la función a la película; cancelar una función (o quitar
-- fechas de una serie) compensa a los compradores; una función con entradas vendidas
-- no se puede mover ni cambiar.
-- Reemplaza: colocar_funcion, crear_funciones, modificar_funciones, reservar_butacas, cancelar_compra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Preventa por película (el mail la pide "película por película").
--    Las películas toman los valores de su función más reciente (o 0 si no tienen funciones).
-- ---------------------------------------------------------------------
alter table peliculas add column if not exists precio_preventa numeric(10,2) not null default 0 check (precio_preventa >= 0);
alter table peliculas add column if not exists dias_preventa   int           not null default 0 check (dias_preventa >= 0);

update peliculas p
   set precio_preventa = f.precio_preventa,
       dias_preventa   = f.dias_preventa
  from (
    select distinct on (pelicula_id) pelicula_id, precio_preventa, dias_preventa
      from funciones
     order by pelicula_id, created_at desc
  ) f
 where f.pelicula_id = p.id;

-- ---------------------------------------------------------------------
-- 2) Quién canceló la compra: el cliente o el cine (cuando se cancela la función)
-- ---------------------------------------------------------------------
alter table compras add column if not exists cancelada_motivo text;
alter table compras drop constraint if exists compras_cancelada_motivo_check;
alter table compras add constraint compras_cancelada_motivo_check
  check (cancelada_motivo is null or cancelada_motivo in ('cliente', 'cine'));

update compras set cancelada_motivo = 'cliente' where cancelada_at is not null and cancelada_motivo is null;

-- ---------------------------------------------------------------------
-- 3) Las funciones de funciones ya no reciben la preventa
-- ---------------------------------------------------------------------
drop function if exists colocar_funcion(uuid, uuid, uuid, timestamptz, text, text, numeric, numeric, int, uuid);
drop function if exists crear_funciones(uuid, date[], time, text, text, numeric, numeric, int);
drop function if exists modificar_funciones(uuid, text, date[], time, uuid, text, text, numeric, numeric, int);

-- colocar_funcion: inserta (p_id null) o actualiza (p_id con valor) una función buscando sala
-- del formato pedido. Si la sala actual sirve se prefiere esa; si no, prueba las demás por número.
-- Devuelve false si ninguna está libre.
create or replace function colocar_funcion(
  p_id              uuid,
  p_serie_id        uuid,
  p_pelicula_id     uuid,
  p_inicio          timestamptz,
  p_formato         text,
  p_idioma          text,
  p_precio_base     numeric,
  p_sala_actual     uuid
)
returns boolean
language plpgsql
as $$
declare
  v_sala uuid;
begin
  for v_sala in
    select id from salas
    where activa and formato = p_formato
    order by (id = p_sala_actual) desc, numero
  loop
    begin
      if p_id is null then
        insert into funciones (pelicula_id, sala_id, inicio, idioma, precio_base, serie_id)
        values (p_pelicula_id, v_sala, p_inicio, p_idioma, p_precio_base, p_serie_id);
      else
        update funciones
           set pelicula_id = p_pelicula_id, sala_id = v_sala, inicio = p_inicio,
               idioma = p_idioma, precio_base = p_precio_base
         where id = p_id;
      end if;
      return true;
    exception when exclusion_violation then
      null; -- sala ocupada en ese horario, probar la siguiente
    end;
  end loop;

  return false;
end;
$$;

-- crear_funciones: varias fechas, una hora, todas en la misma serie. Todo o nada.
create or replace function crear_funciones(
  p_pelicula_id     uuid,
  p_fechas          date[],
  p_hora            time,
  p_formato         text,
  p_idioma          text,
  p_precio_base     numeric
)
returns int
language plpgsql
as $$
declare
  v_zona     constant text := 'America/Argentina/Buenos_Aires';
  v_serie    uuid := gen_random_uuid();
  v_fecha    date;
  v_inicio   timestamptz;
  v_creadas  int := 0;
  v_fallidas text[] := '{}';
begin
  if not exists (select 1 from peliculas where id = p_pelicula_id) then
    raise exception 'La película no existe';
  end if;
  if not exists (select 1 from salas where activa and formato = p_formato) then
    raise exception 'No hay salas activas de formato %', p_formato;
  end if;

  foreach v_fecha in array p_fechas loop
    v_inicio := (v_fecha + p_hora) at time zone v_zona;

    if colocar_funcion(null, v_serie, p_pelicula_id, v_inicio, p_formato, p_idioma, p_precio_base, null) then
      v_creadas := v_creadas + 1;
    else
      v_fallidas := v_fallidas || to_char(v_inicio at time zone v_zona, 'DD/MM/YYYY HH24:MI');
    end if;
  end loop;

  if array_length(v_fallidas, 1) > 0 then
    raise exception 'No hay sala % disponible el/los día(s): %', p_formato, array_to_string(v_fallidas, ', ');
  end if;

  return v_creadas;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) compensar_compra: cancela una compra pagada y compensa a su dueño. La usan
--    cancelar_compra (motivo 'cliente') y la cancelación de funciones (motivo 'cine').
--    - libera las butacas
--    - con cuenta: acredita el total como crédito, quita los puntos ganados (sin dejar el saldo
--      en negativo), devuelve los canjeados y crea la notificación
--    - sin cuenta: solo se cancela y se liberan las butacas (no hay dónde acreditar)
--    El cupón de primera compra vuelve a estar disponible: cupon_aplicable solo mira compras 'pagada'.
-- ---------------------------------------------------------------------
create or replace function compensar_compra(p_compra_id uuid, p_motivo text)
returns compras
language plpgsql
as $$
declare
  v_zona    constant text := 'America/Argentina/Buenos_Aires';
  v_c       compras%rowtype;
  v_f       funciones%rowtype;
  v_p       peliculas%rowtype;
  v_ganados int;
  v_saldo   int;
  v_quitar  int;
  v_cuando  text;
  v_detalle text;
begin
  select * into v_c from compras where id = p_compra_id for update;
  if not found then
    raise exception 'La compra no existe';
  end if;
  if v_c.estado <> 'pagada' then
    return v_c; -- ya estaba cancelada o nunca se pagó: no hay nada que compensar
  end if;

  select * into v_f from funciones where id = v_c.funcion_id;
  select * into v_p from peliculas where id = v_f.pelicula_id;

  update compras set estado = 'cancelada', cancelada_at = now(), cancelada_motivo = p_motivo
   where id = p_compra_id
   returning * into v_c;

  update compra_butacas set estado = 'liberada'
   where compra_id = p_compra_id and estado = 'vendida';

  if v_c.usuario_id is null then
    return v_c;
  end if;

  -- Crédito por el total de la compra
  if v_c.total > 0 then
    update profiles set credito = credito + v_c.total where id = v_c.usuario_id;
    insert into credito_movimientos (usuario_id, monto, descripcion, compra_id)
    values (v_c.usuario_id, v_c.total,
            case when p_motivo = 'cine' then 'Función cancelada: ' else 'Cancelación de la compra para ' end || v_p.nombre,
            p_compra_id);
  end if;

  -- Puntos ganados con esta compra: se quitan (sin dejar el saldo en negativo)
  v_ganados := floor(v_c.total - v_c.credito_usado);
  if v_ganados > 0 then
    select puntos into v_saldo from profiles where id = v_c.usuario_id for update;
    v_quitar := least(v_ganados, v_saldo);
    if v_quitar > 0 then
      update profiles set puntos = puntos - v_quitar where id = v_c.usuario_id;
      insert into puntos_movimientos (usuario_id, tipo, puntos, descripcion, compra_id)
      values (v_c.usuario_id, 'ajuste', -v_quitar,
              case when p_motivo = 'cine' then 'Función cancelada: ' else 'Cancelación de la compra para ' end || v_p.nombre,
              p_compra_id);
    end if;
  end if;

  -- Puntos canjeados: se devuelven
  if v_c.puntos_usados > 0 then
    update profiles set puntos = puntos + v_c.puntos_usados where id = v_c.usuario_id;
    insert into puntos_movimientos (usuario_id, tipo, puntos, descripcion, compra_id)
    values (v_c.usuario_id, 'devolucion', v_c.puntos_usados,
            case when p_motivo = 'cine' then 'Devolución por función cancelada: ' else 'Devolución por cancelar la compra para ' end || v_p.nombre,
            p_compra_id);
  end if;

  v_cuando  := to_char(v_f.inicio at time zone v_zona, 'DD/MM "a las" HH24:MI');
  v_detalle := case when v_c.total > 0 then ' Se acreditaron $' || v_c.total || ' de crédito en tu cuenta.' else '' end
            || case when v_c.puntos_usados > 0 then ' Se te devolvieron ' || v_c.puntos_usados || ' puntos.' else '' end;

  insert into notificaciones (usuario_id, tipo, titulo, mensaje, compra_id)
  values (v_c.usuario_id, 'cancelacion',
          case when p_motivo = 'cine' then 'Función cancelada' else 'Compra cancelada' end,
          case when p_motivo = 'cine'
               then 'El cine canceló la función de ' || v_p.nombre || ' del ' || v_cuando || '.'
               else 'Cancelaste tu compra para ' || v_p.nombre || ' del ' || v_cuando || '.'
          end || v_detalle,
          p_compra_id);

  return v_c;
end;
$$;

-- cancelar_compra (reemplaza a la de 007): las reglas del cliente; la compensación la hace compensar_compra
create or replace function cancelar_compra(p_compra_id uuid)
returns compras
language plpgsql
as $$
declare
  v_uid   uuid := auth.uid();
  v_c     compras%rowtype;
  v_f     funciones%rowtype;
  v_horas int;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión para cancelar una compra';
  end if;

  select * into v_c from compras where id = p_compra_id for update;
  if not found or v_c.usuario_id is distinct from v_uid then
    raise exception 'La compra no existe';
  end if;
  if v_c.estado <> 'pagada' then
    raise exception 'Solo se pueden cancelar compras pagadas';
  end if;
  if v_c.entrada_validada_at is not null or v_c.candy_entregado_at is not null then
    raise exception 'La entrada ya fue utilizada, no se puede cancelar';
  end if;

  select * into v_f from funciones where id = v_c.funcion_id;
  select valor::int into v_horas from configuracion where clave = 'horas_cancelacion';

  if v_f.inicio - make_interval(hours => v_horas) <= now() then
    raise exception 'Solo podés cancelar hasta % horas antes de la función', v_horas;
  end if;

  return compensar_compra(p_compra_id, 'cliente');
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Cancelación de funciones
-- ---------------------------------------------------------------------

-- resumen_cancelacion: qué pasaría si se cancelan estas funciones (para que el admin confirme).
-- Solo cuentan las compras pagadas de funciones que todavía no empezaron.
create or replace function resumen_cancelacion(p_funcion_ids uuid[])
returns jsonb
language plpgsql
stable
as $$
declare
  v_con       int;
  v_credito   numeric;
  v_anonimas  int;
  v_total_an  numeric;
  v_lista     jsonb;
begin
  select count(*) filter (where c.usuario_id is not null),
         coalesce(sum(c.total) filter (where c.usuario_id is not null), 0),
         count(*) filter (where c.usuario_id is null),
         coalesce(sum(c.total) filter (where c.usuario_id is null), 0)
    into v_con, v_credito, v_anonimas, v_total_an
    from compras c
    join funciones f on f.id = c.funcion_id
   where c.funcion_id = any (p_funcion_ids) and c.estado = 'pagada' and f.inicio > now();

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', c.nombre, 'email', c.email, 'codigo', c.codigo, 'total', c.total,
           'pelicula', p.nombre, 'inicio', f.inicio) order by f.inicio, c.nombre), '[]'::jsonb)
    into v_lista
    from compras c
    join funciones f on f.id = c.funcion_id
    join peliculas p on p.id = f.pelicula_id
   where c.funcion_id = any (p_funcion_ids) and c.estado = 'pagada' and f.inicio > now()
     and c.usuario_id is null;

  return jsonb_build_object(
    'compras_con_cuenta', v_con,
    'credito_total',      v_credito,
    'compras_anonimas',   v_anonimas,
    'total_anonimas',     v_total_an,
    'anonimas',           v_lista
  );
end;
$$;

-- desactivar_funcion: da de baja una función. Si todavía no empezó, compensa a sus compradores
-- y libera a quienes estaban pagando (reservas pendientes). Es lo único que desactiva funciones.
create or replace function desactivar_funcion(p_funcion_id uuid)
returns void
language plpgsql
as $$
declare
  v_f funciones%rowtype;
  v_compra uuid;
begin
  select * into v_f from funciones where id = p_funcion_id for update;
  if not found then
    raise exception 'La función no existe';
  end if;

  if v_f.inicio > now() then
    for v_compra in select id from compras where funcion_id = p_funcion_id and estado = 'pagada' loop
      perform compensar_compra(v_compra, 'cine');
    end loop;

    -- quien está en el paso de pago pierde la reserva: confirmar_pago ya no la va a aceptar
    update compra_butacas set estado = 'liberada'
     where funcion_id = p_funcion_id and estado = 'reservada';
    update compras set estado = 'cancelada'
     where funcion_id = p_funcion_id and estado = 'pendiente';
  end if;

  update funciones set activa = false where id = p_funcion_id;
end;
$$;

-- cancelar_funcion: la que llama el admin. Devuelve el resumen de lo compensado.
create or replace function cancelar_funcion(p_funcion_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_f       funciones%rowtype;
  v_resumen jsonb;
begin
  select * into v_f from funciones where id = p_funcion_id;
  if not found then
    raise exception 'La función no existe';
  end if;
  if not v_f.activa then
    raise exception 'La función ya estaba cancelada';
  end if;
  if v_f.inicio <= now() then
    raise exception 'La función ya comenzó, no se puede cancelar';
  end if;

  v_resumen := resumen_cancelacion(array[p_funcion_id]);
  perform desactivar_funcion(p_funcion_id);
  return v_resumen;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) modificar_funciones (reemplaza a la de 002): sin preventa, con las reglas de funciones vendidas
--    p_alcance = 'una'        -> solo p_funcion_id, en la fecha p_fechas[1]
--    p_alcance = 'siguientes' -> esa función y las siguientes de su serie:
--        * días de la serie que ya no están en p_fechas -> se cancelan (con compensación a los compradores)
--        * días que ya existían                          -> se actualizan
--        * días nuevos                                    -> se crean en la misma serie
--    Una función con entradas vendidas no puede cambiar de día, hora, película, formato ni idioma
--    (solo el precio base): hay que cancelarla y crear otra. Todo o nada.
-- ---------------------------------------------------------------------
create or replace function validar_cambio_con_ventas(
  p_f           funciones,
  p_inicio      timestamptz,
  p_pelicula_id uuid,
  p_formato     text,
  p_idioma      text
)
returns void
language plpgsql
stable
as $$
declare
  v_zona constant text := 'America/Argentina/Buenos_Aires';
begin
  if not exists (select 1 from compras where funcion_id = p_f.id and estado = 'pagada') then
    return;
  end if;

  if p_inicio <> p_f.inicio
     or p_pelicula_id <> p_f.pelicula_id
     or p_idioma <> p_f.idioma
     or p_formato <> (select formato from salas where id = p_f.sala_id) then
    raise exception 'La función del % ya tiene entradas vendidas: no se puede cambiar el día, la hora, la película, el formato ni el idioma. Cancelala y creá otra.',
      to_char(p_f.inicio at time zone v_zona, 'DD/MM/YYYY HH24:MI');
  end if;
end;
$$;

create or replace function modificar_funciones(
  p_funcion_id      uuid,
  p_alcance         text,
  p_fechas          date[],
  p_hora            time,
  p_pelicula_id     uuid,
  p_formato         text,
  p_idioma          text,
  p_precio_base     numeric
)
returns int
language plpgsql
as $$
declare
  v_zona        constant text := 'America/Argentina/Buenos_Aires';
  v_base        funciones%rowtype;
  v_existente   funciones%rowtype;
  v_quitar      uuid;
  v_fecha_base  date;
  v_fecha       date;
  v_inicio      timestamptz;
  v_tocadas     int := 0;
  v_fallidas    text[] := '{}';
begin
  select * into v_base from funciones where id = p_funcion_id;
  if not found then
    raise exception 'La función no existe';
  end if;
  if p_alcance not in ('una', 'siguientes') then
    raise exception 'Alcance inválido';
  end if;
  if coalesce(array_length(p_fechas, 1), 0) = 0 then
    raise exception 'Falta indicar al menos una fecha';
  end if;
  if not exists (select 1 from salas where activa and formato = p_formato) then
    raise exception 'No hay salas activas de formato %', p_formato;
  end if;

  -- Solo esta función (o funciones sin serie)
  if p_alcance = 'una' or v_base.serie_id is null then
    v_inicio := (p_fechas[1] + p_hora) at time zone v_zona;

    perform validar_cambio_con_ventas(v_base, v_inicio, p_pelicula_id, p_formato, p_idioma);

    if not colocar_funcion(v_base.id, v_base.serie_id, p_pelicula_id, v_inicio, p_formato,
                           p_idioma, p_precio_base, v_base.sala_id) then
      raise exception 'No hay sala % disponible el %', p_formato,
        to_char(v_inicio at time zone v_zona, 'DD/MM/YYYY HH24:MI');
    end if;
    return 1;
  end if;

  -- Esta y las siguientes de la serie
  v_fecha_base := (v_base.inicio at time zone v_zona)::date;

  if exists (select 1 from unnest(p_fechas) f where f < v_fecha_base) then
    raise exception 'No se pueden elegir fechas anteriores a la función que se está modificando';
  end if;

  -- Los días que se sacan de la serie se cancelan: se compensa a quienes ya habían comprado
  for v_quitar in
    select id from funciones
     where serie_id = v_base.serie_id
       and activa
       and (inicio at time zone v_zona)::date >= v_fecha_base
       and not ((inicio at time zone v_zona)::date = any (p_fechas))
  loop
    perform desactivar_funcion(v_quitar);
  end loop;

  foreach v_fecha in array p_fechas loop
    v_inicio := (v_fecha + p_hora) at time zone v_zona;

    -- ¿ya existe una función de la serie ese día? (si no, v_existente.id queda null y se crea)
    select * into v_existente
      from funciones
     where serie_id = v_base.serie_id
       and activa
       and (inicio at time zone v_zona)::date = v_fecha
     limit 1;

    if v_existente.id is not null then
      perform validar_cambio_con_ventas(v_existente, v_inicio, p_pelicula_id, p_formato, p_idioma);
    end if;

    if colocar_funcion(v_existente.id, v_base.serie_id, p_pelicula_id, v_inicio, p_formato,
                       p_idioma, p_precio_base, v_existente.sala_id) then
      v_tocadas := v_tocadas + 1;
    else
      v_fallidas := v_fallidas || to_char(v_inicio at time zone v_zona, 'DD/MM/YYYY HH24:MI');
    end if;
  end loop;

  if array_length(v_fallidas, 1) > 0 then
    raise exception 'No hay sala % disponible el/los día(s): %', p_formato, array_to_string(v_fallidas, ', ');
  end if;

  return v_tocadas;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Ahora sí: la preventa deja de existir en las funciones
-- ---------------------------------------------------------------------
alter table funciones drop column if exists precio_preventa;
alter table funciones drop column if exists dias_preventa;

-- ---------------------------------------------------------------------
-- 8) reservar_butacas (reemplaza a la de 007): la preventa se lee de la película
-- ---------------------------------------------------------------------
create or replace function reservar_butacas(
  p_funcion_id          uuid,
  p_butacas             text[],
  p_email               text default null,
  p_nombre              text default null,
  p_mayor_declarado     boolean default false,
  p_butacas_con_puntos  text[] default '{}',
  p_usar_credito        boolean default false
)
returns compras
language plpgsql
as $$
declare
  v_zona    constant text := 'America/Argentina/Buenos_Aires';
  v_uid     uuid := auth.uid();  -- null si no hay sesión iniciada
  v_hoy     date := (now() at time zone v_zona)::date;
  v_f       funciones%rowtype;
  v_p       peliculas%rowtype;
  v_perfil  profiles%rowtype;
  v_max     int;
  v_minutos int;
  v_recargo numeric;
  v_base    numeric;
  v_con_pts text[] := coalesce(p_butacas_con_puntos, '{}');
  v_costo   int;
  v_puntos_necesarios int := 0;
  v_subtotal  numeric;
  v_cupon     jsonb;
  v_pct       numeric := 0;
  v_descuento numeric := 0;
  v_credito   numeric := 0;
  v_email   text := nullif(trim(p_email), '');
  v_nombre  text := nullif(trim(p_nombre), '');
  v_compra  compras%rowtype;
  v_codigo  text;
begin
  -- Función válida
  select * into v_f from funciones where id = p_funcion_id and activa;
  if not found then
    raise exception 'La función no existe o fue cancelada';
  end if;
  if v_f.inicio <= now() then
    raise exception 'La función ya comenzó';
  end if;
  select * into v_p from peliculas where id = v_f.pelicula_id;

  -- Configuración
  select valor::int into v_max     from configuracion where clave = 'max_butacas_por_compra';
  select valor::int into v_minutos from configuracion where clave = 'minutos_reserva';
  select valor      into v_recargo from configuracion where clave = 'recargo_vip';

  -- Butacas pedidas
  if p_butacas is null or coalesce(array_length(p_butacas, 1), 0) = 0 then
    raise exception 'Elegí al menos una butaca';
  end if;
  if (select count(distinct b) from unnest(p_butacas) b) <> array_length(p_butacas, 1) then
    raise exception 'Hay butacas repetidas en el pedido';
  end if;
  if array_length(p_butacas, 1) > v_max then
    raise exception 'Podés comprar hasta % butacas por compra', v_max;
  end if;
  if exists (select 1 from unnest(p_butacas) c where not exists (select 1 from butacas b where b.codigo = c)) then
    raise exception 'Alguna de las butacas elegidas no existe';
  end if;
  if exists (select 1 from unnest(v_con_pts) c where c <> all (p_butacas)) then
    raise exception 'Se pidió canjear puntos por una butaca que no está en el pedido';
  end if;

  -- Comprador: con sesión se toman los datos del perfil; sin sesión, los que se pasan
  if v_uid is not null then
    select * into v_perfil from profiles where id = v_uid;
    if not found then
      raise exception 'No se encontró el perfil de tu cuenta';
    end if;
    v_email  := coalesce(v_email, v_perfil.email);
    v_nombre := coalesce(v_nombre, trim(v_perfil.nombre || ' ' || v_perfil.apellido));
  end if;
  if v_email is null or v_nombre is null then
    raise exception 'Necesitamos tu nombre y tu email para enviarte la entrada';
  end if;

  -- Restricción de edad
  if v_p.restriccion_edad > 0 then
    if v_uid is not null then
      if date_part('year', age(v_hoy, v_perfil.fecha_nacimiento::date)) < v_p.restriccion_edad then
        raise exception 'Esta película es +%: tu cuenta no cumple la edad mínima para comprar la entrada', v_p.restriccion_edad;
      end if;
    elsif not coalesce(p_mayor_declarado, false) then
      raise exception 'Tenés que declarar que cumplís la edad mínima (+%) para comprar esta entrada', v_p.restriccion_edad;
    end if;
  end if;

  -- Precio base: preventa antes del estreno (si la película la tiene configurada), precio normal desde el estreno
  if v_hoy < v_p.fecha_estreno::date then
    if v_p.dias_preventa > 0 and v_hoy >= v_p.fecha_estreno::date - v_p.dias_preventa then
      v_base := v_p.precio_preventa;
    else
      raise exception 'La venta de entradas para esta función todavía no está abierta';
    end if;
  else
    v_base := v_f.precio_base;
  end if;

  -- Canje de puntos: hace falta cuenta, que el canje esté disponible y saldo suficiente.
  -- (los puntos se descuentan recién al confirmar el pago)
  if coalesce(array_length(v_con_pts, 1), 0) > 0 then
    if v_uid is null then
      raise exception 'Para canjear puntos tenés que iniciar sesión';
    end if;
    select costo_puntos into v_costo from recompensas where tipo = 'entrada' and activa;
    if v_costo is null then
      raise exception 'El canje de entradas por puntos no está disponible en este momento';
    end if;
    v_puntos_necesarios := v_costo * array_length(v_con_pts, 1);
    if v_perfil.puntos < v_puntos_necesarios then
      raise exception 'No tenés puntos suficientes: necesitás % y tenés %', v_puntos_necesarios, v_perfil.puntos;
    end if;
  end if;

  -- Lo que se cobra en dinero por cada butaca: los puntos cubren la entrada, el recargo VIP se paga igual
  select coalesce(sum(
           case when b.codigo = any (v_con_pts) then 0 else v_base end
           + case when b.tipo = 'vip' then v_recargo else 0 end
         ), 0)
    into v_subtotal
    from butacas b
   where b.codigo = any (p_butacas);

  -- Cupón (solo con cuenta): el de mayor descuento que le corresponda, sobre lo que se paga en dinero
  v_cupon := cupon_aplicable(v_uid);
  if v_cupon is not null then
    v_pct := (v_cupon->>'porcentaje')::numeric;
    v_descuento := round(v_subtotal * v_pct / 100, 2);
  end if;

  -- Crédito: solo con cuenta. Cubre hasta el total; el resto se paga con el medio de pago.
  -- (el crédito se descuenta recién al confirmar el pago)
  if coalesce(p_usar_credito, false) and v_uid is not null then
    v_credito := least(v_perfil.credito, v_subtotal - v_descuento);
  end if;

  -- Antes de reservar, se liberan las reservas vencidas de esta función
  perform liberar_reservas_vencidas(p_funcion_id);

  insert into compras (funcion_id, usuario_id, email, nombre, expira_at, mayor_declarado,
                       subtotal, descuento, total,
                       cupon_id, cupon_nombre, cupon_porcentaje, puntos_usados, credito_usado)
  values (p_funcion_id, v_uid, v_email, v_nombre, now() + make_interval(mins => v_minutos),
          coalesce(p_mayor_declarado, false),
          v_subtotal, v_descuento, v_subtotal - v_descuento,
          (v_cupon->>'id')::uuid, v_cupon->>'nombre', case when v_cupon is null then null else v_pct end,
          v_puntos_necesarios, v_credito)
  returning * into v_compra;

  foreach v_codigo in array p_butacas loop
    begin
      insert into compra_butacas (compra_id, funcion_id, butaca_codigo, precio, con_puntos, estado, reservada_hasta)
      select v_compra.id, p_funcion_id, b.codigo,
             case when b.codigo = any (v_con_pts) then 0 else v_base end
               + case when b.tipo = 'vip' then v_recargo else 0 end,
             b.codigo = any (v_con_pts),
             'reservada', v_compra.expira_at
        from butacas b
       where b.codigo = v_codigo;
    exception when unique_violation then
      -- este raise deshace toda la reserva: no queda ninguna butaca tomada a medias
      raise exception 'La butaca % ya no está disponible', v_codigo;
    end;
  end loop;

  return v_compra;
end;
$$;
