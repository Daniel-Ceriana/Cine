-- =====================================================================
-- 011 - Candy en la compra
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 010.
--
-- Reglas:
--  * El candy se compra SIEMPRE junto con la entrada: una sola compra, un solo código y un solo QR.
--  * Los productos se eligen antes de reservar: entran en la misma reserva de 5 minutos.
--  * El cupón de descuento y el crédito valen para toda la compra (entradas + candy).
--  * Cada producto puede tener un costo en puntos (productos.costo_puntos; vacío = no se canjea).
--    Al comprar, algunas unidades se pagan con puntos y el resto en dinero.
--  * Los puntos ganados siguen siendo 1 por peso pagado en dinero (ahora también cuenta el candy).
--  * Cancelar una compra devuelve el total como crédito (candy incluido) y los puntos canjeados:
--    compensar_compra ya lo hace, porque compras.total y compras.puntos_usados incluyen el candy.
--    Si el candy ya se entregó, cancelar_compra no deja cancelar.
--  * compras.candy_subtotal y candy_descuento guardan la parte del candy para poder separarla
--    de lo recaudado en entradas (lo que se muestra por función).
--
-- Reemplaza reservar_butacas (nuevo parámetro), confirmar_pago y evaluar_codigo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Configuración: máximo de unidades de cada producto por compra
-- ---------------------------------------------------------------------
insert into configuracion (clave, valor, descripcion) values
  ('max_unidades_candy', 10, 'Máximo de unidades de cada producto del candy por compra')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 2) productos.costo_puntos: cuántos puntos cuesta una unidad (vacío = no se puede canjear)
--    Solo la primera vez que se ejecuta: deja canjeables algunos productos de ejemplo.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'productos' and column_name = 'costo_puntos') then
    alter table productos add column costo_puntos int check (costo_puntos > 0);

    update productos set costo_puntos = 600 where nombre = 'Pochoclos chicos';
    update productos set costo_puntos = 400 where nombre = 'Gaseosa';
    update productos set costo_puntos = 300 where nombre = 'Alfajor';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) compras: cuánto del total es candy (para separarlo de lo recaudado en entradas)
-- ---------------------------------------------------------------------
alter table compras add column if not exists candy_subtotal  numeric(10,2) not null default 0;
alter table compras add column if not exists candy_descuento numeric(10,2) not null default 0;

-- ---------------------------------------------------------------------
-- 4) compra_items: los productos de cada compra (con el nombre y el precio de ese momento)
--    Una parte puede pagarse en dinero (puntos_unitarios = 0) y otra con puntos (precio_unitario = 0).
-- ---------------------------------------------------------------------
create table if not exists compra_items (
  id                uuid primary key default gen_random_uuid(),
  compra_id         uuid not null references compras (id) on delete cascade,
  producto_id       uuid references productos (id) on delete set null,
  nombre            text not null,
  cantidad          int  not null check (cantidad > 0),
  precio_unitario   numeric(10,2) not null default 0 check (precio_unitario >= 0),
  puntos_unitarios  int  not null default 0 check (puntos_unitarios >= 0),
  created_at        timestamptz not null default now(),
  constraint compra_items_un_solo_medio check (precio_unitario = 0 or puntos_unitarios = 0)
);

create index if not exists compra_items_compra_idx on compra_items (compra_id);

-- ---------------------------------------------------------------------
-- 5) reservar_butacas: ahora recibe también los productos.
--    Cambia la lista de parámetros, así que se borra la versión anterior (si no, quedarían dos).
-- ---------------------------------------------------------------------
drop function if exists reservar_butacas(uuid, text[], text, text, boolean, text[], boolean);

create or replace function reservar_butacas(
  p_funcion_id          uuid,
  p_butacas             text[],
  p_email               text default null,
  p_nombre              text default null,
  p_mayor_declarado     boolean default false,
  p_butacas_con_puntos  text[] default '{}',
  p_usar_credito        boolean default false,
  p_productos           jsonb   default '[]'::jsonb  -- [{producto_id, cantidad, cantidad_con_puntos}]
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
  v_prods   jsonb := coalesce(p_productos, '[]'::jsonb);
  v_max_u   int;
  v_item    record;
  v_prod    record;
  v_n_items int := 0;
  v_candy_sub  numeric := 0;  -- candy pagado en dinero, antes del cupón
  v_candy_desc numeric := 0;  -- parte del descuento que le toca al candy
  v_candy_pts  int := 0;      -- puntos que cuesta el candy canjeado
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
  select valor::int into v_max_u   from configuracion where clave = 'max_unidades_candy';

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

  -- Candy: cada producto tiene que existir y estar activo (él y su categoría).
  -- Se puede pagar en dinero o canjear por puntos (si el producto tiene costo en puntos y hay cuenta).
  if jsonb_typeof(v_prods) <> 'array' then
    raise exception 'La lista de productos no es válida';
  end if;
  v_n_items := jsonb_array_length(v_prods);

  if v_n_items > 0 then
    if (select count(distinct e->>'producto_id') from jsonb_array_elements(v_prods) e) <> v_n_items then
      raise exception 'Hay productos repetidos en el pedido';
    end if;

    for v_item in
      select (e->>'producto_id')::uuid                     as producto_id,
             (e->>'cantidad')::int                         as cantidad,
             coalesce((e->>'cantidad_con_puntos')::int, 0) as con_puntos
        from jsonb_array_elements(v_prods) e
    loop
      select p.nombre, p.precio, p.costo_puntos into v_prod
        from productos p
        join categorias_producto c on c.id = p.categoria_id
       where p.id = v_item.producto_id and p.activo and c.activa;
      if not found then
        raise exception 'Alguno de los productos elegidos ya no está disponible';
      end if;

      if v_item.cantidad is null or v_item.cantidad < 1 or v_item.cantidad > v_max_u then
        raise exception 'Podés pedir de 1 a % unidades de cada producto', v_max_u;
      end if;
      if v_item.con_puntos < 0 or v_item.con_puntos > v_item.cantidad then
        raise exception 'La cantidad de unidades a canjear no es válida';
      end if;

      if v_item.con_puntos > 0 then
        if v_uid is null then
          raise exception 'Para canjear puntos tenés que iniciar sesión';
        end if;
        if v_prod.costo_puntos is null then
          raise exception '% no se puede canjear por puntos', v_prod.nombre;
        end if;
        v_candy_pts := v_candy_pts + v_item.con_puntos * v_prod.costo_puntos;
      end if;

      v_candy_sub := v_candy_sub + (v_item.cantidad - v_item.con_puntos) * v_prod.precio;
    end loop;

    -- los puntos del candy se suman a los de las entradas: el saldo tiene que alcanzar para todo
    v_puntos_necesarios := v_puntos_necesarios + v_candy_pts;
    if v_candy_pts > 0 and v_perfil.puntos < v_puntos_necesarios then
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

  -- El candy se suma al subtotal: el cupón y el crédito valen para toda la compra
  v_subtotal := v_subtotal + v_candy_sub;

  -- Cupón (solo con cuenta): el de mayor descuento que le corresponda, sobre lo que se paga en dinero
  v_cupon := cupon_aplicable(v_uid);
  if v_cupon is not null then
    v_pct := (v_cupon->>'porcentaje')::numeric;
    v_descuento := round(v_subtotal * v_pct / 100, 2);
    v_candy_desc := round(v_candy_sub * v_pct / 100, 2);
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
                       cupon_id, cupon_nombre, cupon_porcentaje, puntos_usados, credito_usado,
                       candy_subtotal, candy_descuento, tiene_candy)
  values (p_funcion_id, v_uid, v_email, v_nombre, now() + make_interval(mins => v_minutos),
          coalesce(p_mayor_declarado, false),
          v_subtotal, v_descuento, v_subtotal - v_descuento,
          (v_cupon->>'id')::uuid, v_cupon->>'nombre', case when v_cupon is null then null else v_pct end,
          v_puntos_necesarios, v_credito,
          v_candy_sub, v_candy_desc, v_n_items > 0)
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

  -- Los productos quedan guardados con el nombre y el precio de este momento.
  -- Si una parte se canjea con puntos, va en una fila aparte (precio 0 y puntos por unidad).
  if v_n_items > 0 then
    for v_item in
      select (e->>'producto_id')::uuid                     as producto_id,
             (e->>'cantidad')::int                         as cantidad,
             coalesce((e->>'cantidad_con_puntos')::int, 0) as con_puntos
        from jsonb_array_elements(v_prods) e
    loop
      select nombre, precio, costo_puntos into v_prod from productos where id = v_item.producto_id;

      if v_item.cantidad - v_item.con_puntos > 0 then
        insert into compra_items (compra_id, producto_id, nombre, cantidad, precio_unitario, puntos_unitarios)
        values (v_compra.id, v_item.producto_id, v_prod.nombre, v_item.cantidad - v_item.con_puntos, v_prod.precio, 0);
      end if;
      if v_item.con_puntos > 0 then
        insert into compra_items (compra_id, producto_id, nombre, cantidad, precio_unitario, puntos_unitarios)
        values (v_compra.id, v_item.producto_id, v_prod.nombre, v_item.con_puntos, 0, v_prod.costo_puntos);
      end if;
    end loop;
  end if;

  return v_compra;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) confirmar_pago: el canje y el aviso de la compra nombran también los productos
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
  v_unidades int;
  v_texto    text;
  v_credito  numeric;
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
    select coalesce(sum(cantidad), 0) into v_unidades from compra_items
     where compra_id = p_compra_id and puntos_unitarios > 0;

    -- '2 entradas', '1 producto' o '2 entradas y 1 producto'
    v_texto := concat_ws(' y ',
      case when v_cantidad > 0 then v_cantidad || case when v_cantidad = 1 then ' entrada' else ' entradas' end end,
      case when v_unidades > 0 then v_unidades || case when v_unidades = 1 then ' producto' else ' productos' end end);

    update profiles set puntos = puntos - v_c.puntos_usados where id = v_c.usuario_id;
    insert into puntos_movimientos (usuario_id, tipo, puntos, descripcion, compra_id)
    values (v_c.usuario_id, 'canje', -v_c.puntos_usados,
            'Canje de ' || v_texto || ' para ' || v_p.nombre,
            p_compra_id);
    insert into notificaciones (usuario_id, tipo, titulo, mensaje, compra_id)
    values (v_c.usuario_id, 'canje', 'Canje realizado',
            'Canjeaste ' || v_c.puntos_usados || ' puntos por ' || v_texto || ' para ' || v_p.nombre || '.',
            p_compra_id);
  end if;

  -- Crédito: se verifica el saldo y se descuenta (con el perfil bloqueado para evitar gastarlo dos veces)
  if v_c.usuario_id is not null and v_c.credito_usado > 0 then
    select credito into v_credito from profiles where id = v_c.usuario_id for update;
    if v_credito < v_c.credito_usado then
      raise exception 'No tenés crédito suficiente: necesitás % y tenés %', v_c.credito_usado, v_credito;
    end if;

    update profiles set credito = credito - v_c.credito_usado where id = v_c.usuario_id;
    insert into credito_movimientos (usuario_id, monto, descripcion, compra_id)
    values (v_c.usuario_id, -v_c.credito_usado, 'Pago de la compra para ' || v_p.nombre, p_compra_id);
  end if;

  update compras set estado = 'pagada', pagada_at = now()
   where id = p_compra_id
   returning * into v_c;

  update compra_butacas set estado = 'vendida', reservada_hasta = null
   where compra_id = p_compra_id and estado = 'reservada';

  -- Puntos ganados: 1 por cada peso pagado en dinero (con el descuento y sin contar el crédito), solo con cuenta
  if v_c.usuario_id is not null then
    v_ganados := floor(v_c.total - v_c.credito_usado);
    if v_ganados > 0 then
      update profiles set puntos = puntos + v_ganados where id = v_c.usuario_id;
      insert into puntos_movimientos (usuario_id, tipo, puntos, descripcion, compra_id)
      values (v_c.usuario_id, 'ganado', v_ganados, 'Compra para ' || v_p.nombre, p_compra_id);
    end if;

    insert into notificaciones (usuario_id, tipo, titulo, mensaje, compra_id)
    values (v_c.usuario_id, 'compra', 'Compra confirmada',
            'Tu entrada para ' || v_p.nombre || ' del ' || to_char(v_f.inicio at time zone v_zona, 'DD/MM "a las" HH24:MI')
              || ' está lista. Código: ' || v_c.codigo
              || case when v_c.tiene_candy then '. Con el mismo código retirás tus productos en el candy.' else '' end,
            p_compra_id);
  end if;

  return v_c;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) evaluar_codigo: además de las butacas, devuelve los productos a entregar
-- ---------------------------------------------------------------------
create or replace function evaluar_codigo(p_codigo text, p_seccion text)
returns jsonb
language plpgsql
as $$
declare
  v_zona     constant text := 'America/Argentina/Buenos_Aires';
  v_margen   constant interval := interval '60 minutes'; -- desde cuándo antes de la función se puede validar
  v_uid      uuid := auth.uid();
  v_rol      text;
  v_limpio   text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_codigo   text;
  v_c        compras%rowtype;
  v_f        funciones%rowtype;
  v_p        peliculas%rowtype;
  v_sala     salas%rowtype;
  v_fin      timestamptz;
  v_usado_at timestamptz;
  v_usado_por uuid;
  v_usado_nombre text;
  v_motivo   text := null;
  v_butacas  jsonb;
  v_productos jsonb;
begin
  if p_seccion not in ('entrada', 'candy') then
    raise exception 'Sección inválida';
  end if;

  -- Permisos: admin, o el empleado de la sección
  select rol into v_rol from profiles where id = v_uid;
  if v_rol is null
     or v_rol not in ('admin', case p_seccion when 'entrada' then 'empleado_entradas' else 'empleado_candy' end) then
    raise exception 'No tenés permiso para validar en esta sección';
  end if;

  -- El código se acepta con o sin guión, en mayúsculas o minúsculas
  if length(v_limpio) <> 8 then
    return jsonb_build_object('encontrada', false, 'puede_validar', false,
                              'motivo', 'El código tiene que tener 8 caracteres (ej.: K7Q2-9XMD)');
  end if;
  v_codigo := substr(v_limpio, 1, 4) || '-' || substr(v_limpio, 5, 4);

  select * into v_c from compras where codigo = v_codigo;
  if not found then
    return jsonb_build_object('encontrada', false, 'puede_validar', false,
                              'motivo', 'No existe ninguna compra con ese código');
  end if;

  select * into v_f    from funciones  where id = v_c.funcion_id;
  select * into v_p    from peliculas  where id = v_f.pelicula_id;
  select * into v_sala from salas      where id = v_f.sala_id;
  v_fin := v_f.inicio + make_interval(mins => v_p.duracion_minutos);

  if p_seccion = 'entrada' then
    v_usado_at := v_c.entrada_validada_at;  v_usado_por := v_c.entrada_validada_por;
  else
    v_usado_at := v_c.candy_entregado_at;   v_usado_por := v_c.candy_entregado_por;
  end if;
  if v_usado_por is not null then
    select trim(nombre || ' ' || apellido) into v_usado_nombre from profiles where id = v_usado_por;
  end if;

  -- Motivo por el que NO se puede validar (el primero que corresponda)
  if v_c.estado <> 'pagada' then
    v_motivo := 'La compra no está paga (estado: ' || v_c.estado || ')';
  elsif not v_f.activa then
    v_motivo := 'La función fue cancelada';
  elsif p_seccion = 'candy' and not v_c.tiene_candy then
    v_motivo := 'Esta compra no incluye productos del candy';
  elsif v_usado_at is not null then
    v_motivo := case p_seccion when 'entrada' then 'Esta entrada ya fue validada' else 'El candy ya fue entregado' end
             || ' el ' || to_char(v_usado_at at time zone v_zona, 'DD/MM/YYYY "a las" HH24:MI')
             || coalesce(' (' || v_usado_nombre || ')', '');
  elsif now() < v_f.inicio - v_margen then
    v_motivo := 'Todavía es pronto: se puede validar desde el '
             || to_char((v_f.inicio - v_margen) at time zone v_zona, 'DD/MM "a las" HH24:MI');
  elsif now() > v_fin then
    v_motivo := 'La función ya terminó';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('codigo', cb.butaca_codigo, 'tipo', b.tipo)
                            order by b.fila, b.numero), '[]'::jsonb)
    into v_butacas
    from compra_butacas cb
    join butacas b on b.codigo = cb.butaca_codigo
   where cb.compra_id = v_c.id and cb.estado = 'vendida';

  -- Productos del candy (un renglón por producto, sumando lo pagado en dinero y lo canjeado)
  select coalesce(jsonb_agg(jsonb_build_object('nombre', t.nombre, 'cantidad', t.cantidad) order by t.nombre),
                  '[]'::jsonb)
    into v_productos
    from (select nombre, sum(cantidad)::int as cantidad
            from compra_items where compra_id = v_c.id group by nombre) t;

  return jsonb_build_object(
    'encontrada',       true,
    'compra_id',        v_c.id,
    'codigo',           v_c.codigo,
    'comprador',        v_c.nombre,
    'estado_compra',    v_c.estado,
    'total',            v_c.total,
    'pelicula',         v_p.nombre,
    'restriccion_edad', v_p.restriccion_edad,
    'inicio',           v_f.inicio,
    'sala_numero',      v_sala.numero,
    'formato',          v_sala.formato,
    'idioma',           v_f.idioma,
    'butacas',          v_butacas,
    'tiene_candy',      v_c.tiene_candy,
    'productos',        v_productos,
    'usado_at',         v_usado_at,
    'usado_por',        v_usado_nombre,
    'puede_validar',    v_motivo is null,
    'motivo',           v_motivo
  );
end;
$$;
