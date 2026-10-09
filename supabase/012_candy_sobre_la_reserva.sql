-- =====================================================================
-- 012 - El candy se agrega sobre la reserva ya hecha
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 011.
--
-- Cambio de flujo respecto de la 011: la reserva (y su tiempo de 5 minutos) empieza apenas se
-- eligen las butacas. Después el cliente elige el candy, y puede volver a cambiarlo o a cambiar
-- las butacas sin perder lo que ya eligió.
--
--  * reservar_butacas vuelve a recibir solo butacas (se borra la versión con productos).
--  * definir_candy_compra(compra, productos, usar_credito): reemplaza los productos de una reserva
--    vigente y recalcula subtotal, cupón, puntos, crédito y total. Se puede llamar las veces que haga
--    falta mientras la reserva no venza ni se pague.
--  * validar_candy y guardar_candy son las piezas que usa definir_candy_compra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) reservar_butacas: otra vez solo butacas (la 011 le había sumado el parámetro de productos)
-- ---------------------------------------------------------------------
drop function if exists reservar_butacas(uuid, text[], text, text, boolean, text[], boolean, jsonb);

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

-- ---------------------------------------------------------------------
-- 2) validar_candy: controla los productos pedidos y devuelve cuánto suman.
--    Cada producto tiene que existir y estar activo (él y su categoría). Se puede pagar en dinero o
--    canjear por puntos (si el producto tiene costo en puntos y hay cuenta).
--    Devuelve {subtotal: dinero, puntos: puntos que cuesta lo canjeado, items: cantidad de productos}.
-- ---------------------------------------------------------------------
create or replace function validar_candy(p_productos jsonb, p_uid uuid)
returns jsonb
language plpgsql
as $$
declare
  v_prods   jsonb := coalesce(p_productos, '[]'::jsonb);
  v_max_u   int;
  v_n       int;
  v_item    record;
  v_prod    record;
  v_sub     numeric := 0;
  v_pts     int := 0;
begin
  select valor::int into v_max_u from configuracion where clave = 'max_unidades_candy';

  if jsonb_typeof(v_prods) <> 'array' then
    raise exception 'La lista de productos no es válida';
  end if;
  v_n := jsonb_array_length(v_prods);

  if v_n > 0 then
    if (select count(distinct e->>'producto_id') from jsonb_array_elements(v_prods) e) <> v_n then
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
        if p_uid is null then
          raise exception 'Para canjear puntos tenés que iniciar sesión';
        end if;
        if v_prod.costo_puntos is null then
          raise exception '% no se puede canjear por puntos', v_prod.nombre;
        end if;
        v_pts := v_pts + v_item.con_puntos * v_prod.costo_puntos;
      end if;

      v_sub := v_sub + (v_item.cantidad - v_item.con_puntos) * v_prod.precio;
    end loop;
  end if;

  return jsonb_build_object('subtotal', v_sub, 'puntos', v_pts, 'items', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- 3) guardar_candy: reemplaza los productos de la compra (con el nombre y el precio de este momento).
--    Si una parte se canjea con puntos, va en una fila aparte (precio 0 y puntos por unidad).
-- ---------------------------------------------------------------------
create or replace function guardar_candy(p_compra_id uuid, p_productos jsonb)
returns void
language plpgsql
as $$
declare
  v_prods jsonb := coalesce(p_productos, '[]'::jsonb);
  v_item  record;
  v_prod  record;
begin
  delete from compra_items where compra_id = p_compra_id;

  for v_item in
    select (e->>'producto_id')::uuid                     as producto_id,
           (e->>'cantidad')::int                         as cantidad,
           coalesce((e->>'cantidad_con_puntos')::int, 0) as con_puntos
      from jsonb_array_elements(v_prods) e
  loop
    select nombre, precio, costo_puntos into v_prod from productos where id = v_item.producto_id;

    if v_item.cantidad - v_item.con_puntos > 0 then
      insert into compra_items (compra_id, producto_id, nombre, cantidad, precio_unitario, puntos_unitarios)
      values (p_compra_id, v_item.producto_id, v_prod.nombre, v_item.cantidad - v_item.con_puntos, v_prod.precio, 0);
    end if;
    if v_item.con_puntos > 0 then
      insert into compra_items (compra_id, producto_id, nombre, cantidad, precio_unitario, puntos_unitarios)
      values (p_compra_id, v_item.producto_id, v_prod.nombre, v_item.con_puntos, 0, v_prod.costo_puntos);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) definir_candy_compra: deja en la reserva exactamente los productos pedidos (lista vacía = sin candy)
--    y recalcula los totales. No cambia el vencimiento: el tiempo de la reserva sigue corriendo.
--    El cupón es el que ya se aplicó al reservar; el crédito se vuelve a calcular sobre el nuevo total.
--    Los puntos de las entradas canjeadas no cambian (se eligieron al reservar); se les suman los del candy.
-- ---------------------------------------------------------------------
create or replace function definir_candy_compra(
  p_compra_id    uuid,
  p_productos    jsonb   default '[]'::jsonb,
  p_usar_credito boolean default false
)
returns compras
language plpgsql
as $$
declare
  v_uid          uuid := auth.uid();
  v_c            compras%rowtype;
  v_saldo_pts    int;
  v_saldo_cred   numeric;
  v_candy        jsonb;
  v_candy_sub    numeric;
  v_candy_pts    int;
  v_pts_entradas int;
  v_subtotal     numeric;
  v_pct          numeric;
  v_descuento    numeric;
  v_candy_desc   numeric;
  v_credito      numeric := 0;
begin
  select * into v_c from compras where id = p_compra_id for update;
  if not found then
    raise exception 'La compra no existe';
  end if;
  if v_c.usuario_id is not null and v_c.usuario_id is distinct from v_uid then
    raise exception 'La compra no existe';
  end if;
  if v_c.estado <> 'pendiente' or v_c.expira_at <= now() then
    raise exception 'La reserva venció. Volvé a elegir tus butacas';
  end if;

  v_candy     := validar_candy(p_productos, v_c.usuario_id);
  v_candy_sub := (v_candy->>'subtotal')::numeric;
  v_candy_pts := (v_candy->>'puntos')::int;

  -- puntos de las entradas canjeadas = lo que ya figuraba menos lo que costaba el candy anterior
  select v_c.puntos_usados - coalesce(sum(cantidad * puntos_unitarios), 0) into v_pts_entradas
    from compra_items where compra_id = p_compra_id;

  if v_c.usuario_id is not null then
    select puntos, credito into v_saldo_pts, v_saldo_cred from profiles where id = v_c.usuario_id;
    if v_pts_entradas + v_candy_pts > v_saldo_pts then
      raise exception 'No tenés puntos suficientes: necesitás % y tenés %', v_pts_entradas + v_candy_pts, v_saldo_pts;
    end if;
  end if;

  v_subtotal   := (v_c.subtotal - v_c.candy_subtotal) + v_candy_sub;
  v_pct        := coalesce(v_c.cupon_porcentaje, 0);
  v_descuento  := round(v_subtotal * v_pct / 100, 2);
  v_candy_desc := round(v_candy_sub * v_pct / 100, 2);

  if coalesce(p_usar_credito, false) and v_c.usuario_id is not null then
    v_credito := least(v_saldo_cred, v_subtotal - v_descuento);
  end if;

  perform guardar_candy(p_compra_id, p_productos);

  update compras
     set subtotal        = v_subtotal,
         descuento       = v_descuento,
         total           = v_subtotal - v_descuento,
         puntos_usados   = v_pts_entradas + v_candy_pts,
         credito_usado   = v_credito,
         candy_subtotal  = v_candy_sub,
         candy_descuento = v_candy_desc,
         tiene_candy     = (v_candy->>'items')::int > 0
   where id = p_compra_id
   returning * into v_c;

  return v_c;
end;
$$;
