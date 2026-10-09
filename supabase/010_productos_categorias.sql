-- =====================================================================
-- 010 - Catálogo del candy: categorías y productos
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 009.
--
-- Reglas (todas en la base, Angular solo muestra y avisa):
--  * Una categoría tiene nombre único (sin importar mayúsculas), un orden y puede estar activa o inactiva.
--  * Un producto pertenece a una categoría, tiene precio mayor a 0 e IMAGEN OBLIGATORIA.
--    El nombre no se repite dentro de la misma categoría.
--  * No se puede borrar una categoría que tenga productos (on delete restrict): se la desactiva.
--  * El cliente ve un producto solo si él está activo Y su categoría está activa (lo filtra el servicio).
--  * Las imágenes nuevas van al bucket "imagenes", carpeta productos/. Los productos de ejemplo usan
--    imágenes del propio proyecto (public/productos/*.svg), que el admin puede reemplazar al modificarlos.
--
-- Se puede volver a ejecutar: no pisa lo que ya exista ni repite los datos de ejemplo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Si de antes existían tablas con estos nombres pero con otra estructura (sin la columna "orden"),
--    se renombran a *_vieja para no perder sus datos y poder crear las nuevas.
--    Si ya tienen la estructura nueva (por ejemplo, al volver a ejecutar el script), no se toca nada.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'productos')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'productos' and column_name = 'orden') then
    alter table productos rename to productos_vieja;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'categorias_producto')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'categorias_producto' and column_name = 'orden') then
    alter table categorias_producto rename to categorias_producto_vieja;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) categorias_producto
-- ---------------------------------------------------------------------
create table if not exists categorias_producto (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(trim(nombre)) > 0),
  orden       int  not null default 0 check (orden >= 0),
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists categorias_producto_nombre_unico
  on categorias_producto (lower(nombre));

-- ---------------------------------------------------------------------
-- 2) productos
-- ---------------------------------------------------------------------
create table if not exists productos (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references categorias_producto (id) on delete restrict,
  nombre        text not null check (length(trim(nombre)) > 0),
  descripcion   text,
  precio        numeric(10,2) not null check (precio > 0),
  imagen_url    text not null check (length(trim(imagen_url)) > 0),
  orden         int  not null default 0 check (orden >= 0),
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists productos_nombre_por_categoria_unico
  on productos (categoria_id, lower(nombre));

create index if not exists productos_categoria_idx on productos (categoria_id);

-- ---------------------------------------------------------------------
-- 3) Datos de ejemplo (solo si no existen)
-- ---------------------------------------------------------------------
insert into categorias_producto (nombre, orden) values
  ('Pochoclos', 1),
  ('Bebidas',   2),
  ('Golosinas', 3)
on conflict do nothing;

insert into productos (categoria_id, nombre, descripcion, precio, imagen_url, orden)
select c.id, p.nombre, p.descripcion, p.precio, p.imagen_url, p.orden
from (values
  ('Pochoclos', 'Pochoclos chicos',   'Porción individual de pochoclos salados.',  4500,  '/productos/pochoclos.svg',  1),
  ('Pochoclos', 'Pochoclos medianos', 'Ideal para compartir de a dos.',            6500,  '/productos/pochoclos.svg',  2),
  ('Pochoclos', 'Pochoclos grandes',  'El balde clásico del cine.',                8500,  '/productos/pochoclos.svg',  3),
  ('Bebidas',   'Gaseosa',            'Vaso de 500 cc, con hielo.',                3500,  '/productos/gaseosa.svg',    1),
  ('Bebidas',   'Agua mineral',       'Botella de 500 cc.',                        2500,  '/productos/agua.svg',       2),
  ('Golosinas', 'Chocolate',          'Barra de chocolate con leche.',             2800,  '/productos/chocolate.svg',  1),
  ('Golosinas', 'Alfajor',            'Alfajor triple de dulce de leche.',         2000,  '/productos/alfajor.svg',    2),
  ('Golosinas', 'Caramelos',          'Bolsita de caramelos surtidos.',            1800,  '/productos/caramelos.svg',  3)
) as p (categoria, nombre, descripcion, precio, imagen_url, orden)
join categorias_producto c on lower(c.nombre) = lower(p.categoria)
on conflict do nothing;
