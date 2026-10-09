-- =====================================================================
-- 014 - Reseñas y "Mis películas"
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 013.
--
-- Reglas (todas en la base, Angular solo muestra y avisa):
--  * Reseña: de 1 a 5 estrellas y un comentario opcional de hasta 300 caracteres.
--  * Una reseña por persona y por película: se puede modificar y borrar. No hay moderación.
--  * Solo puede reseñar quien la VIO: una compra pagada (no cancelada) de una función de esa película que
--    ya empezó. (No se exige que se haya validado el QR en la puerta.)
--  * Las reseñas se leen directo de la tabla; se escriben con guardar_resenia y eliminar_resenia,
--    que son las que controlan quién es la persona y si vio la película.
--  * El promedio y la cantidad salen de la vista peliculas_puntuacion.
--  * mis_peliculas() lista lo que vio la cuenta, con su reseña si hizo una (pestaña "Mis películas" del perfil).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Si de antes quedó una tabla "resenias" con otra estructura (sin la columna "estrellas"), se reemplaza.
--    CUIDADO: la vieja se borra con sus datos (no se usaba). Si ya tiene la estructura nueva, no se toca.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'resenias')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'resenias' and column_name = 'estrellas') then
    drop table resenias cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) resenias
-- ---------------------------------------------------------------------
create table if not exists resenias (
  id           uuid primary key default gen_random_uuid(),
  pelicula_id  uuid not null references peliculas (id) on delete cascade,
  usuario_id   uuid not null references profiles (id) on delete cascade,
  estrellas    int  not null check (estrellas between 1 and 5),
  comentario   text check (comentario is null or length(comentario) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint resenias_una_por_persona unique (pelicula_id, usuario_id)
);

create index if not exists resenias_pelicula_idx on resenias (pelicula_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2) puntuación de cada película: promedio (con un decimal) y cantidad de reseñas
-- ---------------------------------------------------------------------
create or replace view peliculas_puntuacion as
select pelicula_id,
       round(avg(estrellas)::numeric, 1) as promedio,
       count(*)::int                     as cantidad
  from resenias
 group by pelicula_id;

-- ---------------------------------------------------------------------
-- 3) puede_resenar: ¿esta cuenta vio la película?
--    Vio = tiene una compra pagada (no cancelada) de una función de la película que ya empezó.
-- ---------------------------------------------------------------------
create or replace function puede_resenar(p_pelicula_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
     and exists (
       select 1
         from compras c
         join funciones f on f.id = c.funcion_id
        where c.usuario_id = auth.uid()
          and c.estado = 'pagada'
          and f.pelicula_id = p_pelicula_id
          and f.inicio <= now()
     );
$$;

-- ---------------------------------------------------------------------
-- 4) guardar_resenia: crea la reseña de la cuenta o modifica la que ya tenía
-- ---------------------------------------------------------------------
create or replace function guardar_resenia(p_pelicula_id uuid, p_estrellas int, p_comentario text default null)
returns resenias
language plpgsql
as $$
declare
  v_uid        uuid := auth.uid();
  v_comentario text := nullif(trim(p_comentario), '');
  v_resenia    resenias%rowtype;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión para dejar una reseña';
  end if;
  if not puede_resenar(p_pelicula_id) then
    raise exception 'Solo podés reseñar una película después de verla';
  end if;
  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 5 then
    raise exception 'Elegí de 1 a 5 estrellas';
  end if;
  if v_comentario is not null and length(v_comentario) > 300 then
    raise exception 'El comentario puede tener hasta 300 caracteres';
  end if;

  insert into resenias (pelicula_id, usuario_id, estrellas, comentario)
  values (p_pelicula_id, v_uid, p_estrellas, v_comentario)
  on conflict (pelicula_id, usuario_id)
  do update set estrellas = excluded.estrellas, comentario = excluded.comentario, updated_at = now()
  returning * into v_resenia;

  return v_resenia;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) eliminar_resenia: borra la reseña de la cuenta (solo la propia)
-- ---------------------------------------------------------------------
create or replace function eliminar_resenia(p_pelicula_id uuid)
returns void
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  delete from resenias where pelicula_id = p_pelicula_id and usuario_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- 6) mis_peliculas: las películas que vio la cuenta (una fila por película), la última función que vio y su reseña
--    si la hizo. De la más reciente a la más vieja.
-- ---------------------------------------------------------------------
create or replace function mis_peliculas()
returns table (
  pelicula_id    uuid,
  ultima_funcion timestamptz,
  resenia_id     uuid,
  estrellas      int,
  comentario     text,
  resenia_fecha  timestamptz
)
language sql
stable
as $$
  select v.pelicula_id, v.ultima_funcion, r.id, r.estrellas, r.comentario, r.updated_at
    from (
      select f.pelicula_id, max(f.inicio) as ultima_funcion
        from compras c
        join funciones f on f.id = c.funcion_id
       where c.usuario_id = auth.uid()
         and c.estado = 'pagada'
         and f.inicio <= now()
       group by f.pelicula_id
    ) v
    left join resenias r on r.pelicula_id = v.pelicula_id and r.usuario_id = auth.uid()
   order by v.ultima_funcion desc;
$$;
