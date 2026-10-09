-- =====================================================================
-- 013 - Combos
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 012.
--
-- Un combo es un precio fijo que incluye N entradas y unos productos del candy.
--  * El admin los crea con imagen obligatoria; pueden estar activos o no y destacados.
--  * El precio del combo REEMPLAZA el valor de las entradas que incluye (al precio vigente de la función,
--    preventa incluida) y el de sus productos. El recargo VIP de cada butaca se paga aparte.
--  * Se elige en el paso del candy, sobre la reserva ya hecha. Cubre entradas de las butacas elegidas que
--    no se paguen con puntos. El combo no se puede pagar con puntos; el cupón sí vale sobre toda la compra.
--  * Para el reporte: de lo que paga el cliente por un combo, el valor de las entradas cuenta como entradas
--    y lo que sobra cuenta como candy (compras.candy_subtotal). Así "Recaudado en entradas" sigue limpio.
--  * Los productos del combo quedan en compra_items (precio 0, con el nombre del combo) para que el
--    empleado de candy los vea; los combos vendidos quedan en compra_combos.
--
-- Reemplaza reservar_butacas (guarda el precio de entrada), guardar_candy, definir_candy_compra y evaluar_codigo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Si de antes quedaron tablas sueltas con estos nombres pero con otra estructura, se reemplazan.
--    Si ya tienen la estructura nueva (por ejemplo, al volver a ejecutar el script), no se toca nada.
--    CUIDADO: las viejas se borran con sus datos (no se usaban).
-- ---------------------------------------------------------------------
do $$
declare
  v_vieja boolean := false;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'combos')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'combos' and column_name = 'cantidad_entradas') then
    v_vieja := true;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'combo_items')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'combo_items' and column_name = 'producto_id') then
    v_vieja := true;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'compra_combos')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'compra_combos' and column_name = 'precio_unitario') then
    v_vieja := true;
  end if;

  if v_vieja then
    drop table if exists compra_combos cascade;
    drop table if exists combo_items cascade;
    drop table if exists combos cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) combos y combo_items
-- ---------------------------------------------------------------------
create table if not exists combos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null check (length(trim(nombre)) > 0),
  descripcion       text,
  imagen_url        text not null check (length(trim(imagen_url)) > 0),
  precio            numeric(10,2) not null check (precio > 0),
  cantidad_entradas int  not null check (cantidad_entradas >= 1),
  orden             int  not null default 0 check (orden >= 0),
  activo            boolean not null default true,
  destacado         boolean not null default false,
  created_at        timestamptz not null default now()
);

create unique index if not exists combos_nombre_unico on combos (lower(nombre));

-- Qué productos trae cada combo. No se puede borrar un producto que esté en un combo (se lo desactiva).
create table if not exists combo_items (
  combo_id     uuid not null references combos (id) on delete cascade,
  producto_id  uuid not null references productos (id) on delete restrict,
  cantidad     int  not null check (cantidad > 0),
  primary key (combo_id, producto_id)
);

-- ---------------------------------------------------------------------
-- 2) En la compra: los combos vendidos, el origen de cada producto y el precio de entrada del momento
-- ---------------------------------------------------------------------
create table if not exists compra_combos (
  id                 uuid primary key default gen_random_uuid(),
  compra_id          uuid not null references compras (id) on delete cascade,
  combo_id           uuid references combos (id) on delete set null,
  nombre             text not null,
  cantidad           int  not null check (cantidad > 0),
  cantidad_entradas  int  not null check (cantidad_entradas >= 1),   -- entradas por cada combo
  precio_unitario    numeric(10,2) not null check (precio_unitario > 0),
  created_at         timestamptz not null default now()
);
create index if not exists compra_combos_compra_idx on compra_combos (compra_id);

-- combo_nombre: si el producto vino dentro de un combo (precio 0: ya está en el precio del combo)
alter table compra_items add column if not exists combo_nombre text;

-- precio de la entrada al reservar (sin recargo VIP): sirve para valorar las entradas que cubre un combo
alter table compras add column if not exists precio_entrada numeric(10,2);

-- ---------------------------------------------------------------------
-- 3) guardar_combo: crea o modifica un combo y sus productos en una sola transacción.
--    p_datos: {nombre, descripcion, imagen_url, precio, cantidad_entradas, orden, activo, destacado}
--    p_items: [{producto_id, cantidad}]  (al menos uno, sin repetir)
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

  delete from combo_items where combo_id = v_combo.id;
  insert into combo_items (combo_id, producto_id, cantidad)
  select v_combo.id, (e->>'producto_id')::uuid, (e->>'cantidad')::int
    from jsonb_array_elements(p_items) e;

  return v_combo;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) reservar_butacas: ahora también guarda el precio de la entrada de ese momento
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
                       cupon_id, cupon_nombre, cupon_porcentaje, puntos_usados, credito_usado,
                       precio_entrada)
  values (p_funcion_id, v_uid, v_email, v_nombre, now() + make_interval(mins => v_minutos),
          coalesce(p_mayor_declarado, false),
          v_subtotal, v_descuento, v_subtotal - v_descuento,
          (v_cupon->>'id')::uuid, v_cupon->>'nombre', case when v_cupon is null then null else v_pct end,
          v_puntos_necesarios, v_credito,
          v_base)
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
-- 5) validar_combos: controla los combos pedidos y devuelve cuánto suman.
--    p_combos: [{combo_id, cantidad}]. Cada combo tiene que estar activo y con todos sus productos
--    (y las categorías de esos productos) activos. Devuelve {precio, entradas, items}.
-- ---------------------------------------------------------------------
create or replace function validar_combos(p_combos jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_combos   jsonb := coalesce(p_combos, '[]'::jsonb);
  v_max_u    int;
  v_n        int;
  v_item     record;
  v_combo    record;
  v_precio   numeric := 0;
  v_entradas int := 0;
begin
  select valor::int into v_max_u from configuracion where clave = 'max_unidades_candy';

  if jsonb_typeof(v_combos) <> 'array' then
    raise exception 'La lista de combos no es válida';
  end if;
  v_n := jsonb_array_length(v_combos);

  if v_n > 0 then
    if (select count(distinct e->>'combo_id') from jsonb_array_elements(v_combos) e) <> v_n then
      raise exception 'Hay combos repetidos en el pedido';
    end if;

    for v_item in
      select (e->>'combo_id')::uuid as combo_id, (e->>'cantidad')::int as cantidad
        from jsonb_array_elements(v_combos) e
    loop
      select c.precio, c.cantidad_entradas into v_combo from combos c
       where c.id = v_item.combo_id and c.activo
         and exists (select 1 from combo_items ci where ci.combo_id = c.id)
         and not exists (select 1 from combo_items ci
                           join productos p on p.id = ci.producto_id
                           join categorias_producto cat on cat.id = p.categoria_id
                          where ci.combo_id = c.id and not (p.activo and cat.activa));
      if not found then
        raise exception 'Alguno de los combos elegidos ya no está disponible';
      end if;

      if v_item.cantidad is null or v_item.cantidad < 1 or v_item.cantidad > v_max_u then
        raise exception 'Podés pedir de 1 a % unidades de cada combo', v_max_u;
      end if;

      v_precio   := v_precio   + v_item.cantidad * v_combo.precio;
      v_entradas := v_entradas + v_item.cantidad * v_combo.cantidad_entradas;
    end loop;
  end if;

  return jsonb_build_object('precio', v_precio, 'entradas', v_entradas, 'items', v_n);
end;
$$;

-- ---------------------------------------------------------------------
-- 6) guardar_candy: reemplaza los productos y los combos de la compra (con nombre y precio de este momento).
--    Los productos de un combo se agregan con precio 0 y el nombre del combo.
--    Cambia la lista de parámetros: se borra la versión anterior.
-- ---------------------------------------------------------------------
drop function if exists guardar_candy(uuid, jsonb);

create or replace function guardar_candy(p_compra_id uuid, p_productos jsonb, p_combos jsonb)
returns void
language plpgsql
as $$
declare
  v_prods  jsonb := coalesce(p_productos, '[]'::jsonb);
  v_combos jsonb := coalesce(p_combos, '[]'::jsonb);
  v_item   record;
  v_prod   record;
  v_combo  record;
begin
  delete from compra_items  where compra_id = p_compra_id;
  delete from compra_combos where compra_id = p_compra_id;

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

  for v_item in
    select (e->>'combo_id')::uuid as combo_id, (e->>'cantidad')::int as cantidad
      from jsonb_array_elements(v_combos) e
  loop
    select nombre, precio, cantidad_entradas into v_combo from combos where id = v_item.combo_id;

    insert into compra_combos (compra_id, combo_id, nombre, cantidad, cantidad_entradas, precio_unitario)
    values (p_compra_id, v_item.combo_id, v_combo.nombre, v_item.cantidad, v_combo.cantidad_entradas, v_combo.precio);

    insert into compra_items (compra_id, producto_id, nombre, cantidad, precio_unitario, puntos_unitarios, combo_nombre)
    select p_compra_id, ci.producto_id, p.nombre, ci.cantidad * v_item.cantidad, 0, 0, v_combo.nombre
      from combo_items ci
      join productos p on p.id = ci.producto_id
     where ci.combo_id = v_item.combo_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) definir_candy_compra: deja en la reserva exactamente los productos y combos pedidos (listas vacías =
--    sin candy) y recalcula los totales. No cambia el vencimiento.
--    Subtotal = butacas - valor de las entradas que cubren los combos + precio de los combos + productos sueltos.
--    Los combos cubren butacas que no se paguen con puntos.
--    Cambia la lista de parámetros: se borra la versión anterior.
-- ---------------------------------------------------------------------
drop function if exists definir_candy_compra(uuid, jsonb, boolean);

create or replace function definir_candy_compra(
  p_compra_id    uuid,
  p_productos    jsonb   default '[]'::jsonb,
  p_combos       jsonb   default '[]'::jsonb,
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
  v_combos       jsonb;
  v_candy_sub    numeric;
  v_candy_pts    int;
  v_pts_entradas int;
  v_butacas_sub  numeric;
  v_n_butacas    int;
  v_n_con_puntos int;
  v_cubierto     numeric;
  v_combos_prec  numeric;
  v_combos_entr  int;
  v_candy_parte  numeric;
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

  v_candy        := validar_candy(p_productos, v_c.usuario_id);
  v_candy_sub    := (v_candy->>'subtotal')::numeric;
  v_candy_pts    := (v_candy->>'puntos')::int;
  v_combos       := validar_combos(p_combos);
  v_combos_prec  := (v_combos->>'precio')::numeric;
  v_combos_entr  := (v_combos->>'entradas')::int;

  -- Las butacas de esta reserva: cuánto suman y cuántas se pagan con puntos (esas no las puede cubrir un combo)
  select coalesce(sum(precio), 0), count(*), count(*) filter (where con_puntos)
    into v_butacas_sub, v_n_butacas, v_n_con_puntos
    from compra_butacas where compra_id = p_compra_id and estado = 'reservada';

  if v_combos_entr > v_n_butacas - v_n_con_puntos then
    raise exception 'Los combos incluyen % entradas y solo hay % butacas para cubrir', v_combos_entr, v_n_butacas - v_n_con_puntos;
  end if;

  -- puntos de las entradas canjeadas = lo que ya figuraba menos lo que costaba el candy anterior
  select v_c.puntos_usados - coalesce(sum(cantidad * puntos_unitarios), 0) into v_pts_entradas
    from compra_items where compra_id = p_compra_id;

  if v_c.usuario_id is not null then
    select puntos, credito into v_saldo_pts, v_saldo_cred from profiles where id = v_c.usuario_id;
    if v_pts_entradas + v_candy_pts > v_saldo_pts then
      raise exception 'No tenés puntos suficientes: necesitás % y tenés %', v_pts_entradas + v_candy_pts, v_saldo_pts;
    end if;
  end if;

  v_cubierto    := v_combos_entr * coalesce(v_c.precio_entrada, 0);
  v_subtotal    := v_butacas_sub - v_cubierto + v_combos_prec + v_candy_sub;
  -- para el reporte: lo que el combo cobra de más sobre el valor de sus entradas cuenta como candy
  v_candy_parte := v_candy_sub + greatest(0, v_combos_prec - v_cubierto);

  v_pct        := coalesce(v_c.cupon_porcentaje, 0);
  v_descuento  := round(v_subtotal * v_pct / 100, 2);
  v_candy_desc := round(v_candy_parte * v_pct / 100, 2);

  if coalesce(p_usar_credito, false) and v_c.usuario_id is not null then
    v_credito := least(v_saldo_cred, v_subtotal - v_descuento);
  end if;

  perform guardar_candy(p_compra_id, p_productos, p_combos);

  update compras
     set subtotal        = v_subtotal,
         descuento       = v_descuento,
         total           = v_subtotal - v_descuento,
         puntos_usados   = v_pts_entradas + v_candy_pts,
         credito_usado   = v_credito,
         candy_subtotal  = v_candy_parte,
         candy_descuento = v_candy_desc,
         tiene_candy     = (v_candy->>'items')::int > 0 or (v_combos->>'items')::int > 0
   where id = p_compra_id
   returning * into v_c;

  return v_c;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) evaluar_codigo: además de las butacas y los productos, devuelve los combos
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
  v_combos    jsonb;
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

  -- Combos de la compra (sus productos ya están sumados en la lista de productos)
  select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'cantidad', cantidad) order by nombre),
                  '[]'::jsonb)
    into v_combos
    from compra_combos where compra_id = v_c.id;

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
    'combos',           v_combos,
    'usado_at',         v_usado_at,
    'usado_por',        v_usado_nombre,
    'puede_validar',    v_motivo is null,
    'motivo',           v_motivo
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9) Combos de ejemplo (solo si no existen). Usan imágenes del proyecto (public/combos/*.svg).
-- ---------------------------------------------------------------------
insert into combos (nombre, descripcion, imagen_url, precio, cantidad_entradas, orden, destacado) values
  ('Combo Clásico', '1 entrada, pochoclos medianos y una gaseosa.',                '/combos/clasico.svg', 14000, 1, 1, true),
  ('Combo Pareja',  '2 entradas, pochoclos grandes y 2 gaseosas para compartir.',  '/combos/pareja.svg',  27000, 2, 2, true),
  ('Combo Dulce',   '1 entrada, pochoclos chicos, un alfajor y agua mineral.',      '/combos/dulce.svg',   12500, 1, 3, false)
on conflict do nothing;

insert into combo_items (combo_id, producto_id, cantidad)
select c.id, p.id, i.cantidad
from (values
  ('Combo Clásico', 'Pochoclos medianos', 1),
  ('Combo Clásico', 'Gaseosa',            1),
  ('Combo Pareja',  'Pochoclos grandes',  1),
  ('Combo Pareja',  'Gaseosa',            2),
  ('Combo Dulce',   'Pochoclos chicos',   1),
  ('Combo Dulce',   'Alfajor',            1),
  ('Combo Dulce',   'Agua mineral',       1)
) as i (combo, producto, cantidad)
join combos c    on lower(c.nombre) = lower(i.combo)
join productos p on lower(p.nombre) = lower(i.producto)
on conflict do nothing;
