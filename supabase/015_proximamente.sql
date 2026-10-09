-- =====================================================================
-- 015 - Próximamente y alertas de estreno
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 014.
--
-- Reglas (todas en la base, Angular solo muestra y avisa):
--  * "Próximamente": películas activas con estreno futuro cuya venta todavía no abrió.
--  * Una cuenta puede pedir que le avisen cuando abra la venta de una película próxima (alertas_estreno).
--  * La venta "abre" cuando se puede comprar por primera vez una función de la película: desde el estreno, o
--    antes si la función está marcada "con preventa" y ya rige la preventa (la misma regla que reservar_butacas).
--  * El sistema no envía mails ni tiene tareas programadas: el aviso se genera la primera vez que la persona entra a la
--    app después de que la venta abrió (revisar_alertas) y llega a "Mi perfil > Notificaciones".
--  * Cada alerta avisa una sola vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Si de antes quedó una tabla "alertas_estreno" con otra estructura (sin la columna "avisada_at"), se reemplaza.
--    CUIDADO: la vieja se borra con sus datos (no se usaba). Si ya tiene la estructura nueva, no se toca.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'alertas_estreno')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'alertas_estreno' and column_name = 'avisada_at') then
    drop table alertas_estreno cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) alertas_estreno: una por persona y por película
-- ---------------------------------------------------------------------
create table if not exists alertas_estreno (
  id           uuid primary key default gen_random_uuid(),
  pelicula_id  uuid not null references peliculas (id) on delete cascade,
  usuario_id   uuid not null references profiles (id) on delete cascade,
  avisada      boolean not null default false,
  avisada_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint alertas_estreno_una_por_persona unique (pelicula_id, usuario_id)
);

create index if not exists alertas_estreno_usuario_idx on alertas_estreno (usuario_id) where not avisada;

-- ---------------------------------------------------------------------
-- 2) notificaciones: tipo "estreno" y la película a la que se refiere (para poder ir a verla)
-- ---------------------------------------------------------------------
alter table notificaciones add column if not exists pelicula_id uuid references peliculas (id) on delete set null;

alter table notificaciones drop constraint if exists notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('compra', 'canje', 'sistema', 'cancelacion', 'estreno'));

-- ---------------------------------------------------------------------
-- 3) pelicula_con_venta_abierta: ¿hoy se puede comprar alguna función futura de la película?
--    Es la misma regla de precio de reservar_butacas: desde el estreno, o en preventa para las funciones marcadas.
-- ---------------------------------------------------------------------
create or replace function pelicula_con_venta_abierta(p_pelicula_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from funciones f
      join peliculas p on p.id = f.pelicula_id
     where p.id = p_pelicula_id
       and p.activa
       and f.activa
       and f.inicio > now()
       and (
         (now() at time zone 'America/Argentina/Buenos_Aires')::date >= p.fecha_estreno::date
         or (f.con_preventa
             and p.dias_preventa > 0
             and (now() at time zone 'America/Argentina/Buenos_Aires')::date >= p.fecha_estreno::date - p.dias_preventa)
       )
  );
$$;

-- ---------------------------------------------------------------------
-- 4) activar_alerta: la cuenta pide que le avisen cuando abra la venta (solo de una película próxima)
-- ---------------------------------------------------------------------
create or replace function activar_alerta(p_pelicula_id uuid)
returns void
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_p   peliculas%rowtype;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión para activar un aviso';
  end if;

  select * into v_p from peliculas where id = p_pelicula_id and activa;
  if not found then
    raise exception 'La película no existe';
  end if;
  if v_p.fecha_estreno::date <= v_hoy or pelicula_con_venta_abierta(p_pelicula_id) then
    raise exception 'La venta de esta película ya está abierta: no hace falta el aviso';
  end if;

  -- si ya existía (por ejemplo, ya avisada de una apertura anterior), vuelve a quedar pendiente
  insert into alertas_estreno (pelicula_id, usuario_id)
  values (p_pelicula_id, v_uid)
  on conflict (pelicula_id, usuario_id) do update set avisada = false, avisada_at = null;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) quitar_alerta: la cuenta deja de querer el aviso
-- ---------------------------------------------------------------------
create or replace function quitar_alerta(p_pelicula_id uuid)
returns void
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  delete from alertas_estreno where pelicula_id = p_pelicula_id and usuario_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- 6) revisar_alertas: genera las notificaciones de las alertas de la cuenta cuya venta ya abrió.
--    La app la llama al entrar. Devuelve cuántos avisos generó. Cada alerta avisa una sola vez.
-- ---------------------------------------------------------------------
create or replace function revisar_alertas()
returns int
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_a   record;
  v_n   int := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  for v_a in
    select a.id, a.pelicula_id, p.nombre
      from alertas_estreno a
      join peliculas p on p.id = a.pelicula_id
     where a.usuario_id = v_uid
       and not a.avisada
       and p.activa
       and pelicula_con_venta_abierta(a.pelicula_id)
  loop
    -- el "where not avisada" evita avisar dos veces si se revisa desde dos pantallas a la vez
    update alertas_estreno set avisada = true, avisada_at = now() where id = v_a.id and not avisada;
    if found then
      insert into notificaciones (usuario_id, tipo, titulo, mensaje, pelicula_id)
      values (v_uid, 'estreno', 'Ya se pueden comprar entradas',
              'Se abrió la venta de ' || v_a.nombre || '. ¡Elegí tu función!', v_a.pelicula_id);
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$$;
