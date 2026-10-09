-- =====================================================================
-- 009 - Funciones desde el estreno y preventa por función
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 008.
-- Reglas nuevas:
--   * Una función no puede empezar antes de la fecha de estreno de su película.
--   * La preventa se marca función por función (funciones.con_preventa). Solo esas funciones
--     se venden antes del estreno, desde (estreno - días de preventa), al precio de preventa
--     de la película. Desde el estreno todas pagan el precio base.
--   * Si se posterga el estreno de una película, se cancelan (con compensación a los
--     compradores) las funciones que queden antes de la nueva fecha.
-- Reemplaza: colocar_funcion, crear_funciones, modificar_funciones y reservar_butacas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) funciones.con_preventa
--    Las funciones que ya existen y son de una película con preventa configurada, desde el
--    estreno en adelante, quedan marcadas (así se comportaban hasta ahora).
-- ---------------------------------------------------------------------
alter table funciones add column if not exists con_preventa boolean not null default false;

update funciones f
   set con_preventa = true
  from peliculas p
 where p.id = f.pelicula_id
   and p.dias_preventa > 0
   and p.precio_preventa > 0
   and (f.inicio at time zone 'America/Argentina/Buenos_Aires')::date >= p.fecha_estreno::date;

-- ---------------------------------------------------------------------
-- 2) Las funciones anteriores al estreno que ya existían se cancelan, compensando a los compradores
--    con la misma lógica de la cancelación de funciones (desactivar_funcion, de la 008).
-- ---------------------------------------------------------------------
do $$
declare
  v_f uuid;
begin
  for v_f in
    select f.id
      from funciones f
      join peliculas p on p.id = f.pelicula_id
     where f.activa
       and (f.inicio at time zone 'America/Argentina/Buenos_Aires')::date < p.fecha_estreno::date
  loop
    perform desactivar_funcion(v_f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Funciones de funciones: ahora reciben p_con_preventa y validan contra la película
-- ---------------------------------------------------------------------
drop function if exists colocar_funcion(uuid, uuid, uuid, timestamptz, text, text, numeric, uuid);
drop function if exists crear_funciones(uuid, date[], time, text, text, numeric);
drop function if exists modificar_funciones(uuid, text, date[], time, uuid, text, text, numeric);

-- validar_funcion_pelicula: reglas de una función respecto de su película
create or replace function validar_funcion_pelicula(
  p_pelicula_id  uuid,
  p_inicio       timestamptz,
  p_con_preventa boolean
)
returns void
language plpgsql
stable
as $$
declare
  v_zona constant text := 'America/Argentina/Buenos_Aires';
  v_p    peliculas%rowtype;
begin
  select * into v_p from peliculas where id = p_pelicula_id;
  if not found then
    raise exception 'La película no existe';
  end if;

  if (p_inicio at time zone v_zona)::date < v_p.fecha_estreno::date then
    raise exception 'La función del % es anterior al estreno de "%" (%): solo se pueden crear funciones desde la fecha de estreno',
      to_char(p_inicio at time zone v_zona, 'DD/MM/YYYY'), v_p.nombre, to_char(v_p.fecha_estreno::date, 'DD/MM/YYYY');
  end if;

  if p_con_preventa and (v_p.dias_preventa <= 0 or v_p.precio_preventa <= 0) then
    raise exception 'La película "%" no tiene preventa configurada (días y precio): cargala en la película antes de marcar funciones con preventa', v_p.nombre;
  end if;
end;
$$;

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
  p_con_preventa    boolean,
  p_sala_actual     uuid
)
returns boolean
language plpgsql
as $$
declare
  v_sala uuid;
begin
  perform validar_funcion_pelicula(p_pelicula_id, p_inicio, p_con_preventa);

  for v_sala in
    select id from salas
    where activa and formato = p_formato
    order by (id = p_sala_actual) desc, numero
  loop
    begin
      if p_id is null then
        insert into funciones (pelicula_id, sala_id, inicio, idioma, precio_base, con_preventa, serie_id)
        values (p_pelicula_id, v_sala, p_inicio, p_idioma, p_precio_base, p_con_preventa, p_serie_id);
      else
        update funciones
           set pelicula_id = p_pelicula_id, sala_id = v_sala, inicio = p_inicio,
               idioma = p_idioma, precio_base = p_precio_base, con_preventa = p_con_preventa
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
  p_precio_base     numeric,
  p_con_preventa    boolean default false
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

    if colocar_funcion(null, v_serie, p_pelicula_id, v_inicio, p_formato, p_idioma,
                       p_precio_base, coalesce(p_con_preventa, false), null) then
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

-- modificar_funciones (reemplaza a la de 008): lo mismo, más p_con_preventa
--    p_alcance = 'una'        -> solo p_funcion_id, en la fecha p_fechas[1]
--    p_alcance = 'siguientes' -> esa función y las siguientes de su serie (los días que se sacan se
--                                cancelan con compensación; los que existen se actualizan; los nuevos se crean)
--    Una función con entradas vendidas no puede cambiar de día, hora, película, formato ni idioma.
create or replace function modificar_funciones(
  p_funcion_id      uuid,
  p_alcance         text,
  p_fechas          date[],
  p_hora            time,
  p_pelicula_id     uuid,
  p_formato         text,
  p_idioma          text,
  p_precio_base     numeric,
  p_con_preventa    boolean default false
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
  v_preventa    boolean := coalesce(p_con_preventa, false);
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
                           p_idioma, p_precio_base, v_preventa, v_base.sala_id) then
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
                       p_idioma, p_precio_base, v_preventa, v_existente.sala_id) then
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
-- 4) Postergar el estreno de una película: las funciones que quedan antes de la nueva fecha se cancelan
--    (con compensación). resumen_postergar_estreno le muestra al admin qué pasaría antes de guardar.
-- ---------------------------------------------------------------------
create or replace function funciones_antes_del_estreno(p_pelicula_id uuid, p_estreno date)
returns uuid[]
language sql
stable
as $$
  select coalesce(array_agg(id), '{}')
    from funciones
   where pelicula_id = p_pelicula_id
     and activa
     and (inicio at time zone 'America/Argentina/Buenos_Aires')::date < p_estreno;
$$;

create or replace function resumen_postergar_estreno(p_pelicula_id uuid, p_nueva_fecha date)
returns jsonb
language plpgsql
stable
as $$
declare
  v_ids uuid[] := funciones_antes_del_estreno(p_pelicula_id, p_nueva_fecha);
begin
  return resumen_cancelacion(v_ids) || jsonb_build_object('funciones', coalesce(array_length(v_ids, 1), 0));
end;
$$;

create or replace function peliculas_estreno_postergado()
returns trigger
language plpgsql
as $$
declare
  v_f uuid;
begin
  if new.fecha_estreno::date > old.fecha_estreno::date then
    foreach v_f in array funciones_antes_del_estreno(new.id, new.fecha_estreno::date) loop
      perform desactivar_funcion(v_f);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists peliculas_estreno_postergado on peliculas;
create trigger peliculas_estreno_postergado
  after update of fecha_estreno on peliculas
  for each row execute function peliculas_estreno_postergado();

-- ---------------------------------------------------------------------
-- 5) reservar_butacas (reemplaza a la de 008): la preventa solo vale para funciones marcadas
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

  -- Precio base: antes del estreno solo se venden las funciones con preventa (desde estreno - días de preventa,
  -- al precio de preventa de la película); desde el estreno, el precio base de la función
  if v_hoy < v_p.fecha_estreno::date then
    if v_f.con_preventa and v_p.dias_preventa > 0 and v_hoy >= v_p.fecha_estreno::date - v_p.dias_preventa then
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
