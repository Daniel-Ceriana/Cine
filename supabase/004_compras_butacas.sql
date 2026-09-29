-- =====================================================================
-- 004 - Butacas (una sola distribución), configuración, compras y reservas
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 001, 002 y 003.
-- Supone que existen profiles(id, email, nombre, apellido, fecha_nacimiento).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Limpieza: reemplaza las tablas y funciones de compras que hubiera de antes.
--    CUIDADO: borra los datos que tengan. "cascade" también quita las claves
--    foráneas de otras tablas que apuntaran a estas (no borra esas tablas).
--    Se puede volver a ejecutar el script completo sin problema.
-- ---------------------------------------------------------------------
drop function if exists reservar_butacas(uuid, text[], text, text, boolean);
drop function if exists confirmar_pago(uuid);
drop function if exists liberar_compra(uuid);
drop function if exists liberar_reservas_vencidas(uuid);
drop table if exists compra_butacas cascade;
drop table if exists compras cascade;

-- ---------------------------------------------------------------------
-- 1) butacas: reemplaza a la tabla anterior (que repetía las butacas por sala).
--    Todas las salas tienen la misma distribución, así que hay una sola tabla.
--    Numeración absoluta por fila: 1-4, 6-25 y 27-30 (los pasillos son el 5 y el 26).
--    Tiene que coincidir con src/app/modelos/sala-plantilla.ts
-- ---------------------------------------------------------------------
drop table if exists butacas cascade;

create table butacas (
  codigo text primary key,                                   -- 'A6'
  fila   text not null,
  bloque smallint not null check (bloque between 1 and 3),  -- 1 izq, 2 centro, 3 der
  numero smallint not null check (numero > 0),
  tipo   text not null check (tipo in ('normal', 'accesible', 'vip')),
  unique (fila, numero)
);

-- Filas A-I y L-T (la K no existe), R-S-T son VIP
insert into butacas (codigo, fila, bloque, numero, tipo)
select t.fila || n.numero, t.fila, n.bloque, n.numero,
       case when t.fila in ('R', 'S', 'T') then 'vip' else 'normal' end
from unnest(array['A','B','C','D','E','F','G','H','I','L','M','N','O','P','Q','R','S','T']) as t(fila)
cross join (
  select 1 as bloque, generate_series(1, 4)   as numero
  union all select 2, generate_series(6, 25)
  union all select 3, generate_series(27, 30)
) n;

-- Fila J: accesible, solo 2 + 10 + 2 butacas
insert into butacas (codigo, fila, bloque, numero, tipo)
select 'J' || a.numero, 'J', a.bloque, a.numero, 'accesible'
from (
  select 1 as bloque, generate_series(2, 3)   as numero
  union all select 2, generate_series(11, 20)
  union all select 3, generate_series(28, 29)
) a;

-- Verificación: debería dar 518
-- select count(*) from butacas;

-- ---------------------------------------------------------------------
-- 2) configuracion: valores que el admin puede cambiar
-- ---------------------------------------------------------------------
create table if not exists configuracion (
  clave       text primary key,
  valor       numeric not null,
  descripcion text
);

insert into configuracion (clave, valor, descripcion) values
  ('recargo_vip',            1000, 'Monto que se suma al precio de una butaca VIP'),
  ('max_butacas_por_compra', 8,    'Cantidad máxima de butacas por compra'),
  ('minutos_reserva',        5,    'Minutos que se mantienen reservadas las butacas mientras se paga')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 3) compras: una por función. usuario_id es null si compró sin sesión.
-- ---------------------------------------------------------------------
create table compras (
  id                   uuid primary key default gen_random_uuid(),
  funcion_id           uuid not null references funciones(id) on delete restrict,
  usuario_id           uuid references profiles(id) on delete set null,
  email                text not null,
  nombre               text not null,
  estado               text not null default 'pendiente'
                         check (estado in ('pendiente', 'pagada', 'cancelada', 'vencida')),
  expira_at            timestamptz not null,              -- fin de la reserva de 5 minutos
  mayor_declarado      boolean not null default false,    -- casilla de edad (compradores sin sesión)
  subtotal             numeric(10,2) not null,
  descuento            numeric(10,2) not null default 0,  -- cupones, puntos y crédito: más adelante
  total                numeric(10,2) not null,
  qr_token             uuid not null unique default gen_random_uuid(), -- es lo que lleva el QR
  pagada_at            timestamptz,
  entrada_validada_at  timestamptz,
  entrada_validada_por uuid references profiles(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index compras_funcion_idx on compras (funcion_id);
create index compras_usuario_idx on compras (usuario_id);

-- ---------------------------------------------------------------------
-- 4) compra_butacas: una fila por butaca. El precio se guarda tal como se cobró.
-- ---------------------------------------------------------------------
create table compra_butacas (
  id              uuid primary key default gen_random_uuid(),
  compra_id       uuid not null references compras(id) on delete cascade,
  funcion_id      uuid not null references funciones(id) on delete restrict, -- repetido para el índice único
  butaca_codigo   text not null references butacas(codigo),
  precio          numeric(10,2) not null,
  estado          text not null default 'reservada'
                    check (estado in ('reservada', 'vendida', 'liberada')),
  reservada_hasta timestamptz,
  created_at      timestamptz not null default now()
);

-- GARANTÍA ANTI DOBLE COMPRA: en una función, cada butaca puede estar reservada o
-- vendida a lo sumo una vez. Si dos personas intentan a la vez, la base rechaza a la segunda.
create unique index compra_butacas_unica
  on compra_butacas (funcion_id, butaca_codigo)
  where estado in ('reservada', 'vendida');

create index compra_butacas_funcion_idx on compra_butacas (funcion_id);
create index compra_butacas_compra_idx  on compra_butacas (compra_id);

-- Tiempo real: la app se entera de cada cambio. "full" hace que también lleguen
-- los datos completos en los UPDATE.
alter table compra_butacas replica identity full;
-- (si al volver a ejecutar dice que la tabla ya está en la publicación, es normal: se puede ignorar)
alter publication supabase_realtime add table compra_butacas;

-- ---------------------------------------------------------------------
-- 5) liberar_reservas_vencidas: libera las reservas cuyo tiempo se cumplió
-- ---------------------------------------------------------------------
create or replace function liberar_reservas_vencidas(p_funcion_id uuid default null)
returns int
language plpgsql
as $$
declare
  v_liberadas int;
begin
  update compra_butacas
     set estado = 'liberada'
   where estado = 'reservada'
     and reservada_hasta < now()
     and (p_funcion_id is null or funcion_id = p_funcion_id);
  get diagnostics v_liberadas = row_count;

  update compras
     set estado = 'vencida'
   where estado = 'pendiente'
     and expira_at < now();

  return v_liberadas;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) reservar_butacas: crea una compra "pendiente" con las butacas reservadas
--    por 5 minutos. Todo o nada. Valida edad, cantidad, precio y disponibilidad.
-- ---------------------------------------------------------------------
create or replace function reservar_butacas(
  p_funcion_id      uuid,
  p_butacas         text[],
  p_email           text default null,
  p_nombre          text default null,
  p_mayor_declarado boolean default false
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
  v_total   numeric;
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

  -- Restricción de edad:
  --  * con cuenta: se verifica con la fecha de nacimiento y se PROHÍBE si no cumple
  --  * sin cuenta: no se puede verificar; tiene que declarar que cumple la edad (casilla)
  if v_p.restriccion_edad > 0 then
    if v_uid is not null then
      if date_part('year', age(v_hoy, v_perfil.fecha_nacimiento::date)) < v_p.restriccion_edad then
        raise exception 'Esta película es +%: tu cuenta no cumple la edad mínima para comprar la entrada', v_p.restriccion_edad;
      end if;
    elsif not coalesce(p_mayor_declarado, false) then
      raise exception 'Tenés que declarar que cumplís la edad mínima (+%) para comprar esta entrada', v_p.restriccion_edad;
    end if;
  end if;

  -- Precio base: preventa antes del estreno (si está configurada), precio normal desde el estreno
  if v_hoy < v_p.fecha_estreno::date then
    if v_f.dias_preventa > 0 and v_hoy >= v_p.fecha_estreno::date - v_f.dias_preventa then
      v_base := v_f.precio_preventa;
    else
      raise exception 'La venta de entradas para esta función todavía no está abierta';
    end if;
  else
    v_base := v_f.precio_base;
  end if;

  select coalesce(sum(v_base + case when tipo = 'vip' then v_recargo else 0 end), 0)
    into v_total
    from butacas
   where codigo = any (p_butacas);

  -- Antes de reservar, se liberan las reservas vencidas de esta función
  perform liberar_reservas_vencidas(p_funcion_id);

  insert into compras (funcion_id, usuario_id, email, nombre, expira_at, mayor_declarado, subtotal, total)
  values (p_funcion_id, v_uid, v_email, v_nombre, now() + make_interval(mins => v_minutos),
          coalesce(p_mayor_declarado, false), v_total, v_total)
  returning * into v_compra;

  foreach v_codigo in array p_butacas loop
    begin
      insert into compra_butacas (compra_id, funcion_id, butaca_codigo, precio, estado, reservada_hasta)
      select v_compra.id, p_funcion_id, b.codigo,
             v_base + case when b.tipo = 'vip' then v_recargo else 0 end,
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

-- ---------------------------------------------------------------------
-- 7) confirmar_pago: pago simulado. Pasa la compra a "pagada" si la reserva sigue vigente.
-- ---------------------------------------------------------------------
create or replace function confirmar_pago(p_compra_id uuid)
returns compras
language plpgsql
as $$
declare
  v_c compras%rowtype;
begin
  select * into v_c from compras where id = p_compra_id for update;
  if not found then
    raise exception 'La compra no existe';
  end if;

  if v_c.estado = 'pagada' then
    return v_c; -- ya estaba confirmada
  end if;
  if v_c.estado <> 'pendiente' or v_c.expira_at <= now() then
    raise exception 'La reserva venció. Volvé a elegir tus butacas';
  end if;

  update compras set estado = 'pagada', pagada_at = now()
   where id = p_compra_id
   returning * into v_c;

  update compra_butacas set estado = 'vendida', reservada_hasta = null
   where compra_id = p_compra_id and estado = 'reservada';

  return v_c;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) liberar_compra: el comprador abandona antes de pagar
-- ---------------------------------------------------------------------
create or replace function liberar_compra(p_compra_id uuid)
returns void
language plpgsql
as $$
begin
  update compras set estado = 'cancelada'
   where id = p_compra_id and estado = 'pendiente';

  update compra_butacas set estado = 'liberada'
   where compra_id = p_compra_id and estado = 'reservada';
end;
$$;

-- ---------------------------------------------------------------------
-- 9) Limpieza automática cada minuto (opcional).
--    Requiere activar la extensión pg_cron en Supabase > Database > Extensions.
--    Sin esto igual funciona: la app ignora las reservas vencidas y
--    reservar_butacas las libera antes de reservar.
-- ---------------------------------------------------------------------
-- select cron.schedule('liberar-reservas', '* * * * *', $$select liberar_reservas_vencidas()$$);
