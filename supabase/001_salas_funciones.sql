-- =====================================================================
-- 001 - Salas, butacas y funciones
-- Ejecutar completo en Supabase > SQL Editor.
-- Supone que peliculas.id es uuid. Si es otro tipo, cambiar pelicula_id.
-- =====================================================================

-- Necesaria para poder usar "=" (sala_id) junto con "&&" (rangos) en un EXCLUDE
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- 1) peliculas: precios y preventa pasan a funciones; idioma también
-- ---------------------------------------------------------------------
alter table peliculas
  drop column if exists precio_base,
  drop column if exists precio_preventa,
  drop column if exists dias_preventa,
  drop column if exists idioma,
  drop column if exists formato;

-- ---------------------------------------------------------------------
-- 2) salas
-- ---------------------------------------------------------------------
create table salas (
  id         uuid primary key default gen_random_uuid(),
  numero     int  not null unique check (numero > 0),
  nombre     text not null,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) butacas (las genera la app al crear la sala, ver sala-plantilla.ts)
-- ---------------------------------------------------------------------
create table butacas (
  id      uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas(id) on delete cascade,
  fila    text not null,
  bloque  smallint not null check (bloque between 1 and 3), -- 1 izq, 2 centro, 3 der
  numero  smallint not null check (numero > 0),
  tipo    text not null default 'normal' check (tipo in ('normal', 'accesible', 'vip')),
  unique (sala_id, fila, bloque, numero)
);

-- ---------------------------------------------------------------------
-- 4) funciones
-- ---------------------------------------------------------------------
create table funciones (
  id              uuid primary key default gen_random_uuid(),
  pelicula_id     uuid not null references peliculas(id) on delete restrict,
  sala_id         uuid not null references salas(id) on delete restrict,
  inicio          timestamptz not null,
  -- fin de la película + 30 min, redondeado hacia arriba a múltiplo de 5 min.
  -- La sala queda ocupada desde inicio hasta fin_bloqueo. Lo calcula el trigger.
  fin_bloqueo     timestamptz not null,
  formato         text not null check (formato in ('2D', '3D', '4D', '5D')),
  idioma          text not null check (idioma in ('castellano', 'subtitulada')),
  precio_base     numeric(10,2) not null check (precio_base > 0),
  precio_preventa numeric(10,2) not null default 0 check (precio_preventa >= 0),
  dias_preventa   int not null default 0 check (dias_preventa >= 0),
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),

  -- el inicio siempre en múltiplo de 5 minutos y sin segundos
  constraint funciones_inicio_multiplo_5
    check (extract(minute from inicio)::int % 5 = 0 and extract(second from inicio) = 0),

  -- Garantía final: dos funciones activas de la misma sala no pueden solaparse.
  -- Los rangos son [inicio, fin_bloqueo): una puede empezar justo cuando la otra termina de bloquear.
  constraint funciones_sin_solapamiento
    exclude using gist (sala_id with =, tstzrange(inicio, fin_bloqueo) with &&)
    where (activa)
);

create index funciones_inicio_idx on funciones (inicio);

-- ---------------------------------------------------------------------
-- 5) trigger: calcula fin_bloqueo a partir de la duración de la película
-- ---------------------------------------------------------------------
create or replace function funciones_calcular_fin_bloqueo()
returns trigger
language plpgsql
as $$
declare
  v_duracion int;
  v_fin      timestamptz;
begin
  select duracion_minutos into v_duracion from peliculas where id = new.pelicula_id;

  v_fin := new.inicio + make_interval(mins => v_duracion + 30);

  -- 300 segundos = 5 minutos. ceil() redondea hacia arriba: 21:01 -> 21:05
  new.fin_bloqueo := to_timestamp(ceil(extract(epoch from v_fin) / 300) * 300);
  return new;
end;
$$;

create trigger funciones_fin_bloqueo
  before insert or update of inicio, pelicula_id on funciones
  for each row execute function funciones_calcular_fin_bloqueo();

-- ---------------------------------------------------------------------
-- 6) crear_funciones: crea varias funciones asignando sala automáticamente
--    Es todo o nada: si en alguna fecha no hay sala libre, no se crea ninguna
--    y el error indica qué fechas fallaron.
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
  v_fecha    date;
  v_inicio   timestamptz;
  v_sala     uuid;
  v_ok       boolean;
  v_creadas  int := 0;
  v_fallidas text[] := '{}';
begin
  if not exists (select 1 from peliculas where id = p_pelicula_id) then
    raise exception 'La película no existe';
  end if;

  foreach v_fecha in array p_fechas loop
    v_inicio := (v_fecha + p_hora) at time zone v_zona;
    v_ok := false;

    -- Salas activas en orden; se usa la primera donde el insert no choque
    for v_sala in select id from salas where activa order by numero loop
      begin
        insert into funciones (pelicula_id, sala_id, inicio, formato, idioma,
                               precio_base, precio_preventa, dias_preventa)
        values (p_pelicula_id, v_sala, v_inicio, p_formato, p_idioma,
                p_precio_base, p_precio_preventa, p_dias_preventa);
        v_ok := true;
        v_creadas := v_creadas + 1;
        exit;
      exception when exclusion_violation then
        null; -- sala ocupada en ese horario, probar la siguiente
      end;
    end loop;

    if not v_ok then
      v_fallidas := v_fallidas || to_char(v_inicio at time zone v_zona, 'DD/MM/YYYY HH24:MI');
    end if;
  end loop;

  if array_length(v_fallidas, 1) > 0 then
    -- el raise deshace también las funciones ya insertadas en este llamado
    raise exception 'No hay sala disponible el/los día(s): %', array_to_string(v_fallidas, ', ');
  end if;

  return v_creadas;
end;
$$;
