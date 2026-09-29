-- =====================================================================
-- 002 - El formato (2D/3D/4D/5D) pasa a la sala + series de funciones
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 001.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) salas.formato (las salas existentes quedan en 2D; cambiarlas a mano si hace falta)
-- ---------------------------------------------------------------------
alter table salas
  add column formato text not null default '2D'
  check (formato in ('2D', '3D', '4D', '5D'));

alter table salas alter column formato drop default;

-- ---------------------------------------------------------------------
-- 2) funciones: sin formato (lo determina la sala) y con serie_id.
--    Las funciones creadas juntas comparten serie_id, así se pueden
--    modificar todas a la vez.
-- ---------------------------------------------------------------------
alter table funciones drop column formato;
alter table funciones add column serie_id uuid;
create index funciones_serie_idx on funciones (serie_id);

drop function if exists crear_funciones(uuid, date[], time, text, text, numeric, numeric, int);

-- ---------------------------------------------------------------------
-- 3) colocar_funcion: inserta (p_id null) o actualiza (p_id con valor) una función
--    buscando sala del formato pedido. Si la sala actual sirve, se prefiere esa;
--    si no, prueba las demás por número. Devuelve false si ninguna está libre.
-- ---------------------------------------------------------------------
create or replace function colocar_funcion(
  p_id              uuid,
  p_serie_id        uuid,
  p_pelicula_id     uuid,
  p_inicio          timestamptz,
  p_formato         text,
  p_idioma          text,
  p_precio_base     numeric,
  p_precio_preventa numeric,
  p_dias_preventa   int,
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
        insert into funciones (pelicula_id, sala_id, inicio, idioma,
                               precio_base, precio_preventa, dias_preventa, serie_id)
        values (p_pelicula_id, v_sala, p_inicio, p_idioma,
                p_precio_base, p_precio_preventa, p_dias_preventa, p_serie_id);
      else
        update funciones
           set pelicula_id = p_pelicula_id, sala_id = v_sala, inicio = p_inicio,
               idioma = p_idioma, precio_base = p_precio_base,
               precio_preventa = p_precio_preventa, dias_preventa = p_dias_preventa
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

-- ---------------------------------------------------------------------
-- 4) crear_funciones: varias fechas, una hora, todas en la misma serie.
--    Todo o nada; el error indica los días sin sala libre.
-- ---------------------------------------------------------------------
create or replace function crear_funciones(
  p_pelicula_id     uuid,
  p_fechas          date[],
  p_hora            time,
  p_formato         text,
  p_idioma          text,
  p_precio_base     numeric,
  p_precio_preventa numeric,
  p_dias_preventa   int
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
                       p_precio_base, p_precio_preventa, p_dias_preventa, null) then
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
-- 5) modificar_funciones
--    p_alcance = 'una'        -> solo p_funcion_id, en la fecha p_fechas[1]
--    p_alcance = 'siguientes' -> esa función y las siguientes de su serie:
--        * días de la serie que ya no están en p_fechas -> se cancelan (activa = false)
--        * días que ya existían                          -> se actualizan
--        * días nuevos                                    -> se crean en la misma serie
--    Todo o nada, igual que crear_funciones.
-- ---------------------------------------------------------------------
create or replace function modificar_funciones(
  p_funcion_id      uuid,
  p_alcance         text,
  p_fechas          date[],
  p_hora            time,
  p_pelicula_id     uuid,
  p_formato         text,
  p_idioma          text,
  p_precio_base     numeric,
  p_precio_preventa numeric,
  p_dias_preventa   int
)
returns int
language plpgsql
as $$
declare
  v_zona        constant text := 'America/Argentina/Buenos_Aires';
  v_base        funciones%rowtype;
  v_existente   funciones%rowtype;
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

    if not colocar_funcion(v_base.id, v_base.serie_id, p_pelicula_id, v_inicio, p_formato,
                           p_idioma, p_precio_base, p_precio_preventa, p_dias_preventa,
                           v_base.sala_id) then
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

  -- (TODO cuando existan las entradas: avisar si las canceladas tienen tickets vendidos)
  update funciones
     set activa = false
   where serie_id = v_base.serie_id
     and activa
     and (inicio at time zone v_zona)::date >= v_fecha_base
     and not ((inicio at time zone v_zona)::date = any (p_fechas));

  foreach v_fecha in array p_fechas loop
    v_inicio := (v_fecha + p_hora) at time zone v_zona;

    -- ¿ya existe una función de la serie ese día? (si no, v_existente.id queda null y se crea)
    select * into v_existente
      from funciones
     where serie_id = v_base.serie_id
       and activa
       and (inicio at time zone v_zona)::date = v_fecha
     limit 1;

    if colocar_funcion(v_existente.id, v_base.serie_id, p_pelicula_id, v_inicio, p_formato,
                       p_idioma, p_precio_base, p_precio_preventa, p_dias_preventa,
                       v_existente.sala_id) then
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
