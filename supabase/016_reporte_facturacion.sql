-- =====================================================================
-- 016 - Reporte de facturación por día
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 015.
--
-- reporte_facturacion(desde, hasta): una fila por día CON MOVIMIENTO (ventas o cancelaciones), en hora argentina.
-- Solo la puede usar el admin. No agrega tablas.
--
-- Reglas:
--  * Una compra cuenta como VENTA el día en que se pagó (pagada_at). Las reservas que nunca se pagaron no cuentan.
--  * Una compra pagada y después cancelada (por el cliente o por el cine) cuenta como CANCELACIÓN el día en que se
--    canceló (cancelada_at), con su total original, que se devolvió como crédito. Neto = ventas - cancelado.
--  * Candy = compras.candy_subtotal - candy_descuento (el valor de las entradas de los combos cuenta como entradas).
--    Ventas en entradas = ventas totales - candy.
--  * El crédito usado como medio de pago no es dinero nuevo: Cobrado en dinero = ventas totales - crédito usado.
--  * Las entradas canjeadas con puntos cuentan como vendidas, pero se informan aparte (no son dinero).
-- =====================================================================

create or replace function reporte_facturacion(p_desde date, p_hasta date)
returns table (
  dia                 date,
  compras             int,
  entradas            int,
  entradas_con_puntos int,
  ventas_entradas     numeric,
  ventas_candy        numeric,
  ventas_total        numeric,
  credito_usado       numeric,
  cobrado_dinero      numeric,
  canceladas          int,
  entradas_canceladas int,
  cancelado           numeric,
  neto                numeric
)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
  v_zona constant text := 'America/Argentina/Buenos_Aires';
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'admin') then
    raise exception 'Solo el administrador puede ver el reporte';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El rango de fechas no es válido';
  end if;

  return query
  with
  -- ventas: compras pagadas ese día
  v as (
    select (c.pagada_at at time zone v_zona)::date as d,
           count(*)::int                                  as n,
           sum(c.total)                                   as total,
           sum(c.candy_subtotal - c.candy_descuento)      as candy,
           sum(c.credito_usado)                           as credito
      from compras c
     where c.pagada_at is not null
       and (c.pagada_at at time zone v_zona)::date between p_desde and p_hasta
     group by 1
  ),
  -- las butacas de esas compras (vendidas, o liberadas si después se cancelaron)
  vb as (
    select (c.pagada_at at time zone v_zona)::date as d,
           count(*)::int                           as n,
           (count(*) filter (where cb.con_puntos))::int as con_puntos
      from compras c
      join compra_butacas cb on cb.compra_id = c.id
     where c.pagada_at is not null
       and cb.estado in ('vendida', 'liberada')
       and (c.pagada_at at time zone v_zona)::date between p_desde and p_hasta
     group by 1
  ),
  -- cancelaciones: compras pagadas que se cancelaron ese día
  x as (
    select (c.cancelada_at at time zone v_zona)::date as d,
           count(*)::int as n,
           sum(c.total)  as total
      from compras c
     where c.pagada_at is not null
       and c.cancelada_at is not null
       and (c.cancelada_at at time zone v_zona)::date between p_desde and p_hasta
     group by 1
  ),
  xb as (
    select (c.cancelada_at at time zone v_zona)::date as d,
           count(*)::int as n
      from compras c
      join compra_butacas cb on cb.compra_id = c.id
     where c.pagada_at is not null
       and c.cancelada_at is not null
       and cb.estado in ('vendida', 'liberada')
       and (c.cancelada_at at time zone v_zona)::date between p_desde and p_hasta
     group by 1
  ),
  dias as (
    select v.d from v
    union
    select x.d from x
  )
  select dias.d,
         coalesce(v.n, 0),
         coalesce(vb.n, 0),
         coalesce(vb.con_puntos, 0),
         coalesce(v.total, 0) - coalesce(v.candy, 0),
         coalesce(v.candy, 0),
         coalesce(v.total, 0),
         coalesce(v.credito, 0),
         coalesce(v.total, 0) - coalesce(v.credito, 0),
         coalesce(x.n, 0),
         coalesce(xb.n, 0),
         coalesce(x.total, 0),
         coalesce(v.total, 0) - coalesce(x.total, 0)
    from dias
    left join v  on v.d  = dias.d
    left join vb on vb.d = dias.d
    left join x  on x.d  = dias.d
    left join xb on xb.d = dias.d
   order by dias.d;
end;
$$;
