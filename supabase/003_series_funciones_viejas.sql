-- =====================================================================
-- 003 - Asigna serie_id a las funciones creadas antes de la migración 002
-- Las funciones creadas en una misma llamada a crear_funciones comparten
-- created_at (now() no cambia dentro de una transacción) y película,
-- así que se agrupan por esos dos valores.
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- =====================================================================

update funciones f
   set serie_id = g.serie
  from (
    select pelicula_id, created_at, gen_random_uuid() as serie
      from funciones
     where serie_id is null
     group by pelicula_id, created_at
  ) g
 where f.serie_id is null
   and f.pelicula_id = g.pelicula_id
   and f.created_at = g.created_at;

-- Verificación: no debería quedar ninguna sin serie
-- select count(*) from funciones where serie_id is null;
