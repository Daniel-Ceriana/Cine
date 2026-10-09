-- =====================================================================
-- 006 - Cupones, puntos de fidelización, canje y notificaciones
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 005.
-- Reemplaza reservar_butacas y confirmar_pago (ahora aplican cupón y canje, y acreditan puntos).
--
-- Reglas:
--  * El cupón se aplica solo, y solo a usuarios con cuenta: si le corresponden varios, el de mayor descuento.
--      - primera_compra: la cuenta no tiene ninguna compra pagada. Es único; el admin cambia su porcentaje.
--      - rango_edad: la edad de la cuenta está entre edad_min y edad_max (inclusive; sin tope si edad_max es null).
--  * 1 punto por cada peso efectivamente pagado (ya con el descuento). Se acreditan al confirmar el pago.
--  * Canje: al comprar, cada butaca se puede pagar con puntos (el admin define el costo).
--    Los puntos cubren el precio de la entrada; el recargo VIP, si lo hay, se paga en dinero.
--    Los puntos se descuentan al CONFIRMAR el pago, no al reservar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) profiles: saldo de puntos y crédito (si todavía no existían)
-- ---------------------------------------------------------------------
alter table profiles add column if not exists puntos  int           not null default 0;
alter table profiles add column if not exists credito numeric(10,2) not null default 0;

-- ---------------------------------------------------------------------
-- 0.5) Limpieza: reemplaza las tablas de cupones, recompensas, puntos y notificaciones
--      que hubiera de antes (con otra estructura). CUIDADO: borra los datos que tengan.
--      Por eso, si se vuelve a ejecutar este script, se pierden los cupones, el historial
--      de puntos y las notificaciones cargados hasta ese momento.
-- ---------------------------------------------------------------------
drop table if exists puntos_movimientos cascade;
drop table if exists notificaciones cascade;
drop table if exists recompensas cascade;
alter table compras drop column if exists cupon_id;
drop table if exists cupones cascade;

-- ---------------------------------------------------------------------
-- 1) cupones
-- ---------------------------------------------------------------------
create table cupones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  tipo        text not null check (tipo in ('primera_compra', 'rango_edad')),
  porcentaje  numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  edad_min    int check (edad_min >= 0),
  edad_max    int,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),

  -- primera_compra no usa edades; rango_edad necesita al menos la edad mínima y un tope coherente
  constraint cupones_condicion check (
    (tipo = 'primera_compra' and edad_min is null and edad_max is null)
    or (tipo = 'rango_edad' and edad_min is not null and (edad_max is null or edad_max >= edad_min))
  )
);

-- El cupón de primera compra es único (solo se le cambia el porcentaje)
create unique index if not exists cupones_primera_compra_unico
  on cupones (tipo) where tipo = 'primera_compra';

insert into cupones (nombre, tipo, porcentaje)
select 'Primera compra', 'primera_compra', 20
where not exists (select 1 from cupones where tipo = 'primera_compra');

-- ---------------------------------------------------------------------
-- 2) recompensas: cuántos puntos cuesta canjear cada cosa (el admin lo configura)
--    Por ahora solo la entrada; los productos del candy se suman cuando exista el candy.
-- ---------------------------------------------------------------------
create table recompensas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  tipo          text not null check (tipo in ('entrada', 'producto')),
  costo_puntos  int not null check (costo_puntos > 0),
  activa        boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists recompensas_entrada_unica
  on recompensas (tipo) where tipo = 'entrada';

insert into recompensas (nombre, tipo, costo_puntos)
select 'Entrada', 'entrada', 500
where not exists (select 1 from recompensas where tipo = 'entrada');

-- ---------------------------------------------------------------------
-- 3) puntos_movimientos: historial de puntos ganados y canjeados
-- ---------------------------------------------------------------------
create table puntos_movimientos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references profiles(id) on delete cascade,
  tipo        text not null check (tipo in ('ganado', 'canje')),
  puntos      int  not null,                -- positivo si suma, negativo si se gasta
  descripcion text not null,
  compra_id   uuid references compras(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists puntos_movimientos_usuario_idx on puntos_movimientos (usuario_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4) notificaciones: los avisos que se ven en "Mi perfil" (el sistema no envía mails)
-- ---------------------------------------------------------------------
create table notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references profiles(id) on delete cascade,
  tipo        text not null check (tipo in ('compra', 'canje', 'sistema')),
  titulo      text not null,
  mensaje     text not null,
  compra_id   uuid references compras(id) on delete set null,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notificaciones_usuario_idx on notificaciones (usuario_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5) compras y compra_butacas: qué cupón se aplicó y qué se pagó con puntos
--    compra_butacas.precio pasa a ser lo que se cobra EN DINERO por esa butaca
--    (antes del cupón): 0 si se pagó con puntos, o solo el recargo VIP si lo tiene.
-- ---------------------------------------------------------------------
alter table compras add column if not exists cupon_id         uuid references cupones(id) on delete set null;
alter table compras add column if not exists cupon_nombre     text;
alter table compras add column if not exists cupon_porcentaje numeric(5,2);
alter table compras add column if not exists puntos_usados    int not null default 0;

alter table compra_butacas add column if not exists con_puntos boolean not null default false;

-- ---------------------------------------------------------------------
-- 6) cupon_aplicable: el mejor cupón que le corresponde a un usuario (o null)
-- ---------------------------------------------------------------------
create or replace function cupon_aplicable(p_usuario uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_zona constant text := 'America/Argentina/Buenos_Aires';
  v_edad int;
  v_c    cupones%rowtype;
begin
  if p_usuario is null then
    return null; -- sin cuenta no hay cupones
  end if;

  select date_part('year', age((now() at time zone v_zona)::date, fecha_nacimiento::date))::int
    into v_edad
    from profiles where id = p_usuario;

  select * into v_c
    from cupones c
   where c.activo
     and (
           (c.tipo = 'primera_compra'
              and not exists (select 1 from compras x where x.usuario_id = p_usuario and x.estado = 'pagada'))
        or (c.tipo = 'rango_edad'
              and v_edad is not null
              and v_edad >= c.edad_min
              and (c.edad_max is null or v_edad <= c.edad_max))
         )
   order by c.porcentaje desc, c.created_at
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object('id', v_c.id, 'nombre', v_c.nombre, 'tipo', v_c.tipo, 'porcentaje', v_c.porcentaje);
end;
$$;

-- El cupón de quien tiene la sesión iniciada (para mostrarlo antes de comprar)
create or replace function mi_cupon()
returns jsonb
language sql
stable
as $$
  select cupon_aplicable(auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 7) reservar_butacas (reemplaza a la de 004): ahora con cupón y canje de puntos
-- ---------------------------------------------------------------------
drop function if exists reservar_butacas(uuid, text[], text, text, boolean);

create or replace function reservar_butacas(
  p_funcion_id          uuid,
  p_butacas             text[],
  p_email               text default null,
  p_nombre              text default null,
  p_mayor_declarado     boolean default false,
  p_butacas_con_puntos  text[] default '{}'
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

  -- Antes de reservar, se liberan las reservas vencidas de esta función
  perform liberar_reservas_vencidas(p_funcion_id);

  insert into compras (funcion_id, usuario_id, email, nombre, expira_at, mayor_declarado,
                       subtotal, descuento, total,
                       cupon_id, cupon_nombre, cupon_porcentaje, puntos_usados)
  values (p_funcion_id, v_uid, v_email, v_nombre, now() + make_interval(mins => v_minutos),
          coalesce(p_mayor_declarado, false),
          v_subtotal, v_descuento, v_subtotal - v_descuento,
          (v_cupon->>'id')::uuid, v_cupon->>'nombre', case when v_cupon is null then null else v_pct end,
          v_puntos_necesarios)
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

-- ---------------------------------------------------------------------
-- 8) confirmar_pago (reemplaza a la de 004): descuenta el canje, acredita los puntos ganados
--    y crea las notificaciones del usuario. Todo en una sola transacción.
-- ---------------------------------------------------------------------
create or replace function confirmar_pago(p_compra_id uuid)
returns compras
language plpgsql
as $$
declare
  v_zona     constant text := 'America/Argentina/Buenos_Aires';
  v_c        compras%rowtype;
  v_f        funciones%rowtype;
  v_p        peliculas%rowtype;
  v_puntos   int;
  v_ganados  int;
  v_cantidad int;
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

  select * into v_f from funciones where id = v_c.funcion_id;
  select * into v_p from peliculas where id = v_f.pelicula_id;

  -- Canje: se verifica el saldo y se descuenta (con el perfil bloqueado para evitar gastar dos veces)
  if v_c.usuario_id is not null and v_c.puntos_usados > 0 then
    select puntos into v_puntos from profiles where id = v_c.usuario_id for update;
    if v_puntos < v_c.puntos_usados then
      raise exception 'No tenés puntos suficientes para este canje: necesitás % y tenés %', v_c.puntos_usados, v_puntos;
    end if;

    select count(*) into v_cantidad from compra_butacas where compra_id = p_compra_id and con_puntos;

    update profiles set puntos = puntos - v_c.puntos_usados where id = v_c.usuario_id;
    insert into puntos_movimientos (usuario_id, tipo, puntos, descripcion, compra_id)
    values (v_c.usuario_id, 'canje', -v_c.puntos_usados,
            'Canje de ' || v_cantidad || case when v_cantidad = 1 then ' entrada' else ' entradas' end
              || ' para ' || v_p.nombre,
            p_compra_id);
    insert into notificaciones (usuario_id, tipo, titulo, mensaje, compra_id)
    values (v_c.usuario_id, 'canje', 'Canje realizado',
            'Canjeaste ' || v_c.puntos_usados || ' puntos por ' || v_cantidad
              || case when v_cantidad = 1 then ' entrada' else ' entradas' end || ' para ' || v_p.nombre || '.',
            p_compra_id);
  end if;

  update compras set estado = 'pagada', pagada_at = now()
   where id = p_compra_id
   returning * into v_c;

  update compra_butacas set estado = 'vendida', reservada_hasta = null
   where compra_id = p_compra_id and estado = 'reservada';

  -- Puntos ganados: 1 por cada peso pagado (ya con el descuento), solo con cuenta
  if v_c.usuario_id is not null then
    v_ganados := floor(v_c.total);
    if v_ganados > 0 then
      update profiles set puntos = puntos + v_ganados where id = v_c.usuario_id;
      insert into puntos_movimientos (usuario_id, tipo, puntos, descripcion, compra_id)
      values (v_c.usuario_id, 'ganado', v_ganados, 'Compra para ' || v_p.nombre, p_compra_id);
    end if;

    insert into notificaciones (usuario_id, tipo, titulo, mensaje, compra_id)
    values (v_c.usuario_id, 'compra', 'Compra confirmada',
            'Tu entrada para ' || v_p.nombre || ' del ' || to_char(v_f.inicio at time zone v_zona, 'DD/MM "a las" HH24:MI')
              || ' está lista. Código: ' || v_c.codigo,
            p_compra_id);
  end if;

  return v_c;
end;
$$;
