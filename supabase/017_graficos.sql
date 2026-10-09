-- =====================================================================
-- 017 - Rankings para los gráficos del admin
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 016.
--
-- Tres funciones, solo para el admin, que devuelven el ranking (de mayor a menor) de un período. No agregan tablas.
--  * ranking_peliculas: entradas vendidas por película.
--  * ranking_productos: unidades vendidas por producto, SIN los que vienen dentro de un combo.
--  * ranking_combos:    unidades vendidas por combo.
--
-- Reglas:
--  * El período se mide por el DÍA DE LA FUNCIÓN (hora argentina): lo que la gente va a ver o ya vio ese período.
--  * Solo cuentan las compras pagadas y NO canceladas (si se cancela, sus entradas y productos dejan de contar).
--  * Los productos y combos se agrupan por el nombre que tenían al comprar: el histórico no cambia si se los renombra.
--  * Los productos canjeados con puntos también cuentan como vendidos.
--  * Si dos tienen la misma cantidad, se ordenan por nombre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ranking_peliculas
-- ---------------------------------------------------------------------
create or replace function ranking_peliculas(p_desde date, p_hasta date, p_limite int default 5)
returns table (nombre text, cantidad bigint)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
  v_zona constant text := 'America/Argentina/Buenos_Aires';
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'admin') then
    raise exception 'Solo el administrador puede ver los gráficos';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El rango de fechas no es válido';
  end if;

  return query
  select pel.nombre, count(*)::bigint
    from compras c
    join funciones f        on f.id = c.funcion_id
    join peliculas pel      on pel.id = f.pelicula_id
    join compra_butacas cb  on cb.compra_id = c.id
   where c.estado = 'pagada'
     and cb.estado = 'vendida'
     and (f.inicio at time zone v_zona)::date between p_desde and p_hasta
   group by pel.id, pel.nombre
   order by count(*) desc, pel.nombre
   limit greatest(p_limite, 1);
end;
$$;

-- ---------------------------------------------------------------------
-- 2) ranking_productos: solo los productos sueltos (los de un combo no cuentan acá)
-- ---------------------------------------------------------------------
create or replace function ranking_productos(p_desde date, p_hasta date, p_limite int default 5)
returns table (nombre text, cantidad bigint)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
  v_zona constant text := 'America/Argentina/Buenos_Aires';
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'admin') then
    raise exception 'Solo el administrador puede ver los gráficos';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El rango de fechas no es válido';
  end if;

  return query
  select i.nombre, sum(i.cantidad)::bigint
    from compra_items i
    join compras c    on c.id = i.compra_id
    join funciones f  on f.id = c.funcion_id
   where i.combo_nombre is null
     and c.estado = 'pagada'
     and (f.inicio at time zone v_zona)::date between p_desde and p_hasta
   group by i.nombre
   order by sum(i.cantidad) desc, i.nombre
   limit greatest(p_limite, 1);
end;
$$;

-- ---------------------------------------------------------------------
-- 3) ranking_combos
-- ---------------------------------------------------------------------
create or replace function ranking_combos(p_desde date, p_hasta date, p_limite int default 5)
returns table (nombre text, cantidad bigint)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
  v_zona constant text := 'America/Argentina/Buenos_Aires';
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'admin') then
    raise exception 'Solo el administrador puede ver los gráficos';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El rango de fechas no es válido';
  end if;

  return query
  select cc.nombre, sum(cc.cantidad)::bigint
    from compra_combos cc
    join compras c    on c.id = cc.compra_id
    join funciones f  on f.id = c.funcion_id
   where c.estado = 'pagada'
     and (f.inicio at time zone v_zona)::date between p_desde and p_hasta
   group by cc.nombre
   order by sum(cc.cantidad) desc, cc.nombre
   limit greatest(p_limite, 1);
end;
$$;
