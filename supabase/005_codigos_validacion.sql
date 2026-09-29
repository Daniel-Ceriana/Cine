-- =====================================================================
-- 005 - Código de la compra (el que lleva el QR) y validación en el cine
-- Ejecutar completo en Supabase > SQL Editor, DESPUÉS de 004.
--
-- Cada compra tiene UN código corto (ej.: K7Q2-9XMD). El QR contiene ese mismo código y
-- el empleado también puede escribirlo a mano. Sirve para dos secciones que se validan
-- por separado y una sola vez cada una: la ENTRADA (ingreso a la sala) y el CANDY.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Generador de códigos: 8 caracteres sin ambiguos (sin 0, O, 1, I, L), formato XXXX-XXXX.
--    31 símbolos ^ 8 posiciones = más de 850 mil millones de combinaciones.
--    Usa gen_random_uuid() como fuente de azar (es aleatorio seguro y no requiere extensiones).
-- ---------------------------------------------------------------------
create or replace function generar_codigo_compra()
returns text
language plpgsql
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_codigo   text;
  v_hex      text;
  v_i        int;
begin
  loop
    v_hex := replace(gen_random_uuid()::text, '-', '');
    v_codigo := '';

    for v_i in 0..7 loop
      -- cada par de caracteres hexadecimales es un byte; se lo reduce al tamaño del alfabeto
      v_codigo := v_codigo || substr(
        v_alfabeto,
        1 + (('x' || substr(v_hex, v_i * 2 + 1, 2))::bit(8)::int % length(v_alfabeto)),
        1
      );
    end loop;

    v_codigo := substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4);
    exit when not exists (select 1 from compras where codigo = v_codigo);
  end loop;

  return v_codigo;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) compras: código, candy y quién lo entregó
--    (qr_token se reemplaza por el código corto)
-- ---------------------------------------------------------------------
alter table compras add column if not exists codigo text;
update compras set codigo = generar_codigo_compra() where codigo is null;
alter table compras alter column codigo set not null;
alter table compras alter column codigo set default generar_codigo_compra();
create unique index if not exists compras_codigo_unico on compras (codigo);

alter table compras drop column if exists qr_token;

-- Cuando exista el candy, la compra marcará si incluye productos.
-- Mientras tanto queda en false: la pantalla de candy avisa que la compra no tiene productos.
alter table compras add column if not exists tiene_candy boolean not null default false;
alter table compras add column if not exists candy_entregado_at  timestamptz;
alter table compras add column if not exists candy_entregado_por uuid references profiles(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3) evaluar_codigo: dice qué compra es, qué tiene y si se puede validar ahora.
--    p_seccion = 'entrada' | 'candy'.
--    No modifica nada. Solo pueden usarla el admin y el empleado de esa sección.
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
    'usado_at',         v_usado_at,
    'usado_por',        v_usado_nombre,
    'puede_validar',    v_motivo is null,
    'motivo',           v_motivo
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4) validar_codigo: marca la sección como usada. UN SOLO USO por sección.
--    El "update ... where ... is null" hace que, si dos empleados validan a la vez,
--    solo uno lo consiga.
-- ---------------------------------------------------------------------
create or replace function validar_codigo(p_codigo text, p_seccion text)
returns jsonb
language plpgsql
as $$
declare
  v_eval     jsonb := evaluar_codigo(p_codigo, p_seccion);
  v_compra   uuid;
  v_filas    int;
begin
  if not coalesce((v_eval->>'puede_validar')::boolean, false) then
    raise exception '%', v_eval->>'motivo';
  end if;
  v_compra := (v_eval->>'compra_id')::uuid;

  if p_seccion = 'entrada' then
    update compras set entrada_validada_at = now(), entrada_validada_por = auth.uid()
     where id = v_compra and entrada_validada_at is null;
  else
    update compras set candy_entregado_at = now(), candy_entregado_por = auth.uid()
     where id = v_compra and candy_entregado_at is null;
  end if;

  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    raise exception 'Este código ya fue usado hace un instante';
  end if;

  return evaluar_codigo(p_codigo, p_seccion);
end;
$$;

-- ---------------------------------------------------------------------
-- Para probar el candy antes de que exista la compra de productos:
--   update compras set tiene_candy = true where codigo = 'XXXX-XXXX';
-- ---------------------------------------------------------------------
