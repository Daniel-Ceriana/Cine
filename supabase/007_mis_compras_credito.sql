-- =====================================================================
-- 007 - Mis compras, crédito y cancelación
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 006.
-- Agrega: crédito (saldo + historial), cancelación de compras hasta 2 horas antes,
-- recuperación de la entrada para quien compró sin cuenta y ranking de más vendidas.
-- Reemplaza reservar_butacas y confirmar_pago (ahora aceptan crédito).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Configuración: cuántas horas antes de la función se puede cancelar
-- ---------------------------------------------------------------------
insert into configuracion (clave, valor, descripcion) values
  ('horas_cancelacion', 2, 'Horas antes de la función hasta las que se puede cancelar una compra')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 2) Tipos nuevos en el historial de puntos y en las notificaciones
-- ---------------------------------------------------------------------
alter table puntos_movimientos drop constraint if exists puntos_movimientos_tipo_check;
alter table puntos_movimientos add constraint puntos_movimientos_tipo_check
  check (tipo in ('ganado', 'canje', 'devolucion', 'ajuste'));

alter table notificaciones drop constraint if exists notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('compra', 'canje', 'sistema', 'cancelacion'));

-- ---------------------------------------------------------------------
-- 3) Crédito: historial (el saldo es profiles.credito, que ya existe).
--    El crédito NO es lo mismo que los puntos: se acredita al cancelar y se usa para pagar.
-- ---------------------------------------------------------------------
create table if not exists credito_movimientos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references profiles(id) on delete cascade,
  monto       numeric(10,2) not null,       -- positivo si se acredita, negativo si se usa
  descripcion text not null,
  compra_id   uuid references compras(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists credito_movimientos_usuario_idx on credito_movimientos (usuario_id, created_at desc);

alter table compras add column if not exists credito_usado numeric(10,2) not null default 0;
alter table compras add column if not exists cancelada_at  timestamptz;

-- ---------------------------------------------------------------------
-- 4) reservar_butacas y confirmar_pago (reemplazan a las de 006): ahora con crédito.
--    El crédito cubre parte del total (credito_usado); el resto se paga con el medio de pago.
-- ---------------------------------------------------------------------
drop function if exists reservar_butacas(uuid, text[], text, text, boolean, text[]);

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
              || ' está lista. Código: ' || v_c.codigo,
            p_compra_id);
  end if;

  return v_c;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) cancelar_compra: hasta N horas antes de la función (configuracion.horas_cancelacion).
--    No se devuelve dinero: se acredita CRÉDITO por el total de la compra (incluye el crédito
--    que se había usado). Se liberan las butacas, se quitan los puntos ganados y se devuelven
--    los canjeados. El cupón de primera compra vuelve a estar disponible porque cupon_aplicable
--    solo mira compras 'pagada'. Solo la puede cancelar su dueño (con cuenta).
-- ---------------------------------------------------------------------
create or replace function cancelar_compra(p_compra_id uuid)
returns compras
language plpgsql
as $$
declare
  v_zona    constant text := 'America/Argentina/Buenos_Aires';
  v_uid     uuid := auth.uid();
  v_c       compras%rowtype;
  v_f       funciones%rowtype;
  v_p       peliculas%rowtype;
  v_horas   int;
  v_ganados int;
  v_saldo   int;
  v_quitar  int;
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
  select * into v_p from peliculas where id = v_f.pelicula_id;
  select valor::int into v_horas from configuracion where clave = 'horas_cancelacion';

  if v_f.inicio - make_interval(hours => v_horas) <= now() then
    raise exception 'Solo podés cancelar hasta % horas antes de la función', v_horas;
  end if;

  update compras set estado = 'cancelada', cancelada_at = now()
   where id = p_compra_id
   returning * into v_c;

  update compra_butacas set estado = 'liberada'
   where compra_id = p_compra_id and estado = 'vendida';

  -- Crédito por el total de la compra
  if v_c.total > 0 then
    update profiles set credito = credito + v_c.total where id = v_uid;
    insert into credito_movimientos (usuario_id, monto, descripcion, compra_id)
    values (v_uid, v_c.total, 'Cancelación de la compra para ' || v_p.nombre, p_compra_id);
  end if;

  -- Puntos ganados con esta compra: se quitan (sin dejar el saldo en negativo)
  v_ganados := floor(v_c.total - v_c.credito_usado);
  if v_ganados > 0 then
    select puntos into v_saldo from profiles where id = v_uid for update;
    v_quitar := least(v_ganados, v_saldo);
    if v_quitar > 0 then
      update profiles set puntos = puntos - v_quitar where id = v_uid;
      insert into puntos_movimientos (usuario_id, tipo, puntos, descripcion, compra_id)
      values (v_uid, 'ajuste', -v_quitar, 'Cancelación de la compra para ' || v_p.nombre, p_compra_id);
    end if;
  end if;

  -- Puntos canjeados: se devuelven
  if v_c.puntos_usados > 0 then
    update profiles set puntos = puntos + v_c.puntos_usados where id = v_uid;
    insert into puntos_movimientos (usuario_id, tipo, puntos, descripcion, compra_id)
    values (v_uid, 'devolucion', v_c.puntos_usados, 'Devolución por cancelar la compra para ' || v_p.nombre, p_compra_id);
  end if;

  insert into notificaciones (usuario_id, tipo, titulo, mensaje, compra_id)
  values (v_uid, 'cancelacion', 'Compra cancelada',
          'Cancelaste tu compra para ' || v_p.nombre || ' del '
            || to_char(v_f.inicio at time zone v_zona, 'DD/MM "a las" HH24:MI')
            || '. Se acreditaron $' || v_c.total || ' de crédito en tu cuenta.',
          p_compra_id);

  return v_c;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) buscar_entrada: quien compró sin cuenta recupera su entrada con código + email.
--    Si no coinciden ambos datos, el mensaje es siempre el mismo (no se revela si el código existe).
--    Devuelve el id de la compra; la app lo usa para leer los datos.
-- ---------------------------------------------------------------------
create or replace function buscar_entrada(p_codigo text, p_email text)
returns uuid
language plpgsql
stable
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from compras
   where replace(codigo, '-', '') = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
     and lower(email) = lower(trim(coalesce(p_email, '')))
     and pagada_at is not null
     and estado in ('pagada', 'cancelada');

  if v_id is null then
    raise exception 'No encontramos una entrada con esos datos';
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) peliculas_mas_vendidas: ranking por entradas vendidas en los últimos N días.
--    Las compras canceladas no cuentan (sus butacas quedan 'liberada').
-- ---------------------------------------------------------------------
create or replace function peliculas_mas_vendidas(p_dias int default 30, p_limite int default 3)
returns table (pelicula_id uuid, entradas bigint)
language sql
stable
as $$
  select f.pelicula_id, count(*) as entradas
    from compra_butacas cb
    join compras c   on c.id = cb.compra_id
    join funciones f on f.id = cb.funcion_id
   where cb.estado = 'vendida'
     and c.estado = 'pagada'
     and c.pagada_at >= now() - make_interval(days => p_dias)
   group by f.pelicula_id
   order by entradas desc
   limit p_limite;
$$;
