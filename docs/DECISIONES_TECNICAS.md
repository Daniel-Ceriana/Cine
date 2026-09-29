# Decisiones técnicas y arquitectura

Trabajo Práctico 1 — Programación IV (2026 C2) · Sistema de venta de entradas para un cine

Este documento explica **cómo está armada la aplicación y por qué se tomó cada decisión**. Refleja el estado actual
del proyecto; lo que todavía no está hecho figura en la sección 10 y en `docs/REQUERIMIENTOS.md`.

---

## 1. Visión general

Es una aplicación web de una sola página (SPA) hecha con **Angular**, que usa **Supabase** como backend completo
(autenticación, base de datos PostgreSQL, almacenamiento de imágenes y tiempo real). No hay un servidor propio.

```
┌───────────────────────────┐        ┌────────────────────────────────────────────┐
│  Angular (SPA)            │        │  Supabase                                  │
│                           │        │                                            │
│  Componentes              │        │  Auth ............ usuarios y sesión       │
│     │                     │  HTTPS │  PostgreSQL ...... tablas, restricciones,  │
│  Servicios  ──────────────┼───────▶│                    triggers y funciones SQL│
│     │                     │        │  Storage ......... pósters de películas    │
│  SupabaseService (cliente)│◀───────┼─ Realtime ........ cambios de butacas      │
└───────────────────────────┘  WSS   └────────────────────────────────────────────┘
```

**Regla general de diseño:** lo que tiene que cumplirse *siempre* (no solapar funciones, no vender dos veces una
butaca, validar la edad, calcular precios) se garantiza **en la base de datos**. Angular se ocupa de mostrar,
pedir datos y avisar al usuario. Así, aunque alguien saltee la interfaz, las reglas se cumplen igual.

---

## 2. Tecnologías

| Tecnología | Uso | Motivo |
|------------|-----|--------|
| Angular 22 | Aplicación | Requerido por la cátedra |
| TypeScript | Lenguaje | Tipado estricto en modelos y servicios |
| Supabase (Auth, Postgres, Storage, Realtime) | Backend | Requerido; evita mantener un servidor |
| Angular Material 22 | Selector de hora y controles del formulario de funciones | Se pidió expresamente para fechas y horas |
| CSS propio con variables | Estilo general | Identidad visual propia (ver sección 7) |
| Google Fonts | Bungee, Special Elite, Inter | Tipografías de la identidad visual |

Decisión: **no** se usó una librería de componentes para toda la interfaz. Se eligió CSS propio para lograr un
estilo único, y Material queda limitado a los controles donde aporta más (selector de hora, botones de opción,
listas desplegables del formulario de funciones).

---

## 3. Frontend (Angular)

### 3.1 Organización

```
src/app/
├── componentes/
│   ├── admin/        pantallas del administrador (películas, salas, funciones, butacas de una función…)
│   ├── cliente/      pantallas del público (inicio, detalle de película, selección de butacas y pago)
│   └── compartido/   piezas reutilizables (nav, login, registro, listado y tarjeta de película, mapa de butacas)
├── modelos/          interfaces TypeScript de las tablas y la plantilla de butacas
├── services/         acceso a Supabase (un servicio por tema)
├── guards/           control de acceso por sesión y rol
├── utilidades/       funciones puras: fechas en hora argentina, precio vigente de una función
└── interfaces/       tipos auxiliares (rutas del menú)
```

### 3.2 Prácticas aplicadas

- **Componentes standalone** y **carga diferida** (`loadComponent`) de cada ruta: el usuario descarga solo lo que usa.
- **Signals** (`signal`, `computed`) para el estado de cada pantalla, en lugar de propiedades sueltas. Lo derivado
  (totales, filtros, agrupaciones por día) se calcula con `computed`, así nunca queda desactualizado.
- **Formularios con Signal Forms** (`form`, `FormField`), con validaciones declarativas y mensajes claros.
- **Nuevo control de flujo** de plantillas (`@if`, `@for`) con `track`.
- **Servicios inyectables** con `inject()`; cada servicio conoce una tabla o un tema (`PeliculaService`,
  `SalaService`, `FuncionService`, `ButacaService`, `CompraService`, `Auth`).
- **`SupabaseService` es el único que crea el cliente de Supabase.** Los demás lo reutilizan; si cambia la
  conexión, se cambia en un solo lugar.
- **Guards** de ruta: `authGuard` (exige sesión), `roleGuard` (exige un rol), `clienteGuard` (deja pasar a
  visitantes y clientes, y manda al personal a su panel) y `guestGuard` (evita entrar a login si ya hay sesión).
- **Componente genérico** `MenuCrearVer`, reutilizado en películas, salas y funciones (se le pasan la ruta y las
  etiquetas), en lugar de copiar el mismo menú tres veces.
- **Componente compartido `MapaButacas`**: dibuja el plano. No conoce la base de datos: recibe qué está ocupado y
  avisa qué butaca se tocó. Lo usan el cliente (para elegir) y el admin (para ver ventas).
- **Limpieza de recursos**: las pantallas con tiempo real cancelan la suscripción y los temporizadores en `ngOnDestroy`.

### 3.3 Rutas

| Ruta | Acceso | Pantalla |
|------|--------|----------|
| `/home` | Visitante y cliente | Cartelera con buscador |
| `/peliculas/:id` | Visitante y cliente | Detalle de película y sus funciones |
| `/funcion/:id/butacas` | Visitante y cliente | Elegir butacas, reservar y pagar |
| `/login`, `/register` | Sin sesión | Acceso y registro |
| `/admin/...` | Solo admin | Películas, salas, funciones, butacas por función |

### 3.4 Fechas y horas

- Toda la lógica de horarios está en **hora argentina fija (UTC−3)**, sin importar la zona del dispositivo. Argentina
  no tiene horario de verano, por lo que el desfase es constante.
- Se guardan como `timestamptz` (momento absoluto) y se muestran convertidos con `Intl.DateTimeFormat`, sin
  librerías de fechas.
- Las fechas y horas se ingresan **sin calendarios desplegables**, como pidió el cliente:
  días de la semana con botones, cantidad de semanas, y un selector de hora con pasos de 5 minutos.

---

## 4. Backend en Supabase

### 4.1 Por qué parte de la lógica vive en funciones SQL

Angular no puede garantizar operaciones que involucran a varios usuarios a la vez. Por ejemplo, si dos clientes
compran la misma butaca en el mismo instante, ambos podrían ver "libre" en su pantalla. Por eso las operaciones
críticas son **funciones SQL (RPC)** que se ejecutan de forma **atómica**: o se hace todo o no se hace nada.

| Función SQL | Qué resuelve |
|-------------|--------------|
| `crear_funciones` | Crea una función por fecha, asignando la primera sala libre del formato pedido. Si algún día no tiene sala, no se crea ninguna y el error lista los días. |
| `modificar_funciones` | Modifica una función o esa y las siguientes de su serie (actualiza, crea o cancela según los días elegidos). |
| `colocar_funcion` | Inserta o actualiza una función probando salas hasta encontrar una libre (la usan las dos anteriores). |
| `reservar_butacas` | Valida y reserva butacas por 5 minutos: cantidad, edad, precio, disponibilidad. |
| `confirmar_pago` | Pasa la compra a pagada y las butacas a vendidas, si la reserva sigue vigente. |
| `liberar_compra` | Libera las butacas si el comprador abandona. |
| `liberar_reservas_vencidas` | Libera las reservas cuyo tiempo se cumplió. |

### 4.2 Migraciones

Los scripts están en `supabase/` y se ejecutan **en orden** desde el editor SQL de Supabase:

| Script | Contenido |
|--------|-----------|
| `001_salas_funciones.sql` | Salas, funciones, exclusión de solapamientos, trigger de fin de función |
| `002_formato_en_sala_y_series.sql` | El formato pasa a la sala; series de funciones; nuevas funciones SQL |
| `003_series_funciones_viejas.sql` | Asigna serie a las funciones creadas antes de la 002 |
| `004_compras_butacas.sql` | Butacas, configuración, compras, reservas, tiempo real |

---

## 5. Modelo de datos

```
peliculas ──< pelicula_generos >── generos
    │
    └──< funciones >── salas
            │  (serie_id agrupa las funciones creadas juntas)
            │
            └──< compra_butacas >── butacas          (butacas: una sola distribución para todas las salas)
                      │
                   compras ── profiles (opcional: null si compró sin sesión)

configuracion (recargo VIP, máximo de butacas, minutos de reserva)
```

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Datos de cada usuario registrado y su rol (cliente, admin, empleados) |
| `peliculas` | Datos propios de la película: nombre, sinopsis, imagen, duración, estreno, restricción de edad |
| `generos`, `pelicula_generos` | Relación muchos a muchos entre películas y géneros |
| `salas` | Número, nombre, **formato** (2D–5D) y si está activa |
| `funciones` | Película + sala + inicio + idioma + precios + serie. Guarda también `fin_bloqueo` |
| `butacas` | 518 filas fijas con código, fila, bloque, número y tipo (normal/accesible/vip) |
| `compras` | Una por función: comprador, estado, vencimiento de la reserva, total, `qr_token` |
| `compra_butacas` | Una por butaca comprada: precio cobrado y estado (reservada/vendida/liberada) |
| `configuracion` | Valores que el admin puede modificar |

---

## 6. Decisiones de negocio y cómo se implementaron

### 6.1 Precios y preventa van en la función, no en la película
El precio depende de *cuándo y dónde* se proyecta, no solo de la película. Por eso `precio_base`,
`precio_preventa` y `dias_preventa` se movieron de `peliculas` a `funciones`.

### 6.2 El formato (2D/3D/4D/5D) pertenece a la sala
Una sala física es 3D o no lo es; una misma sala no puede proyectar 2D y 3D. Guardarlo en la función permitía
combinaciones sin sentido. Ahora, al crear funciones se elige el formato y el sistema asigna solo entre salas de
ese tipo. Cambiar el formato de una sala con funciones futuras activas está bloqueado.

### 6.3 Solapamiento imposible, garantizado por la base de datos
Una **restricción de exclusión** de PostgreSQL (`EXCLUDE USING gist`) sobre `(sala, rango de tiempo)` impide que
dos funciones activas de la misma sala se pisen. Un trigger calcula `fin_bloqueo` = fin de la película + 30 min,
redondeado hacia arriba a múltiplo de 5. La interfaz no puede saltearse esta regla, y funciona aunque dos
administradores programen a la vez.

Otra restricción obliga a que el inicio sea múltiplo de 5 minutos.

### 6.4 Asignación automática de sala
`colocar_funcion` recorre las salas activas del formato pedido, en orden, e intenta insertar. Si la base rechaza
por solapamiento (`exclusion_violation`), prueba la siguiente. Atrapar el error de la base, en lugar de consultar
primero "¿está libre?", evita condiciones de carrera entre consultar e insertar.

### 6.5 Series de funciones
Las funciones creadas juntas comparten un `serie_id`. Permite modificar "esta función" o "esta y las siguientes":
los días que se quitan se **cancelan** (no se borran, para conservar historial y futuras entradas), los que ya
existían se **actualizan** conservando su sala si sigue disponible, y los nuevos se **crean**.

### 6.6 Una sola tabla de butacas para todas las salas
Todas las salas tienen la misma distribución, así que repetir 518 filas por sala era redundante. Hay una única tabla
`butacas`. El plano que se dibuja en pantalla sale de una plantilla en código (`sala-plantilla.ts`) que debe
coincidir con esa tabla; si la distribución cambia, se modifican ambos.

### 6.7 Cómo se evita la doble compra
Un **índice único parcial** sobre `compra_butacas (funcion_id, butaca_codigo)` donde el estado es reservada o
vendida. Si dos personas intentan la misma butaca a la vez, la base acepta una y rechaza la otra con un mensaje
claro ("La butaca X ya no está disponible"). Esto no depende de ninguna validación en el navegador.

### 6.8 Reserva temporal de 5 minutos
1. El usuario elige butacas (solo en su pantalla) y toca **Continuar**.
2. `reservar_butacas` crea la compra en estado *pendiente* y reserva las butacas hasta `expira_at`.
3. Los demás las ven como "en proceso". Si el usuario paga (`confirmar_pago`) pasan a *vendidas*; si abandona o el
   tiempo se cumple, se liberan.

Las reservas vencidas se liberan de tres formas complementarias: `reservar_butacas` limpia las de esa función antes
de reservar; las pantallas ignoran cualquier reserva con tiempo cumplido; y hay una tarea opcional con `pg_cron`
(documentada en el SQL) para limpiar cada minuto.

### 6.9 Precio guardado en cada entrada
`compra_butacas.precio` guarda el monto cobrado. Si el admin cambia después el precio base o el recargo VIP, las
compras anteriores no se alteran (importante para reportes de facturación).

### 6.10 Recargo VIP global y configurable
Un valor (`configuracion.recargo_vip`) que se suma al precio de las butacas VIP. Se eligió global y no por función
para simplificar la carga: el admin cambia un solo número. Las butacas accesibles cuestan lo mismo que las comunes.

### 6.11 Restricción de edad
- **Con cuenta:** la base calcula la edad con `profiles.fecha_nacimiento` y **rechaza** la compra si no alcanza.
  La pantalla lo anticipa para no llegar al error.
- **Sin cuenta:** la edad no puede verificarse. Se exige tildar una declaración ("Declaro tener N años o más") y se
  muestra el aviso de que debe asistir un adulto.
- Para que el control con cuenta tenga sentido, se permite registrarse desde los 10 años.

### 6.12 Compra anónima
`compras.usuario_id` puede ser nulo. En ese caso se piden nombre y email (para enviar la entrada). Con sesión, se
toman del perfil. La identidad del usuario se obtiene dentro de la base con `auth.uid()`, y no de un dato enviado
por el navegador.

### 6.13 Pago simulado
Se implementó un pago simulado para el TP. El modelo ya soporta una pasarela real: la compra nace *pendiente* y
pasa a *pagada* solo con `confirmar_pago`. Reemplazar la simulación implicaría llamar a `confirmar_pago` desde la
confirmación de la pasarela.

### 6.14 Regla de precio vigente duplicada a propósito
El precio que ve el usuario se calcula en Angular (`precio-funcion.ts`) y el que se cobra se recalcula en la base
(`reservar_butacas`). La base es la fuente de verdad; la copia en Angular solo sirve para mostrar. Si la regla
cambia, hay que actualizar ambos lugares.

---

## 7. Tiempo real

Se usa **Supabase Realtime** (`postgres_changes`) suscripto a la tabla `compra_butacas`, filtrando por la función
que se está viendo.

- Ante cada cambio (alguien reserva, paga o libera), la pantalla **vuelve a consultar** la ocupación de esa función.
  Se eligió releer en lugar de aplicar cada evento a mano: es más simple y siempre consistente, y el volumen por
  función es chico.
- Como respaldo ante avisos perdidos (por ejemplo, cortes de conexión), cada 15 segundos se consulta de nuevo.
  Esto además hace desaparecer del mapa las reservas vencidas.
- La tabla se agrega a la publicación `supabase_realtime` y usa `REPLICA IDENTITY FULL` para que los eventos de
  actualización lleven los datos completos.
- Si otra persona toma una butaca que el usuario había elegido, se le quita de la selección y se le avisa.

---

## 8. Identidad visual

**Concepto: cine clásico.** Crema de entrada de cine, bordó de telón y mostaza de letrero luminoso.

- **Tipografías:** *Bungee* para títulos (letras de letrero de cine), *Special Elite* para datos "impresos"
  (horas, salas, precios, butacas) e *Inter* para el texto y los formularios, por legibilidad.
- **Motivos:** tira de "foquitos" de marquesina bajo la cabecera y los títulos; tarjetas con forma de **ticket**
  (muescas laterales y línea de corte punteada); carteles de película enmarcados; botones que se "hunden" al apretarlos.
- **Un solo lugar para los estilos comunes:** `styles.css` define variables (paleta, tipografías, espaciados) y las
  piezas reutilizables (`.ticket`, `.chip`, `.btn`, `.pagina`, `.titulo-pagina`, `.marquesina`). Los componentes
  solo declaran su propio armado. Los estilos repetidos que había en varios componentes se eliminaron.
- **Angular Material** se ajusta con sus variables CSS para respetar la paleta, sin recurrir a SCSS.
- **Mismo estilo para cliente y admin**; el admin es más sobrio y prioriza legibilidad.
- **Mobile-first en el cliente:** la cuadrícula de películas se adapta al ancho, los bloques de formulario se apilan
  y el mapa de butacas se desplaza horizontalmente en pantallas chicas.
- **Accesibilidad básica:** botones reales (no `div`) para las butacas y las tarjetas, `aria-label` y `aria-pressed`
  en las butacas, foco visible y mensajes de error con `role="alert"`.

---

## 9. Seguridad

- **Autenticación** con Supabase Auth (email y contraseña).
- **Roles** en `profiles.rol`; los guards de Angular redirigen según el rol.
- **Sin RLS (Row Level Security).** Por decisión del equipo para este TP, las tablas no tienen políticas de acceso.
  Esto significa que **quien tenga la clave pública (`anon`) podría leer y modificar tablas directamente**, salteando
  la interfaz. Los guards de Angular protegen la navegación, no los datos.
  Las reglas de negocio críticas sí se validan en la base (secciones 6.3 a 6.11).
  En un sistema real se activaría RLS con políticas por rol, y las operaciones sensibles solo se permitirían
  mediante las funciones SQL.
- La clave pública de Supabase está en `src/environments/environment.ts`. Es una clave pensada para navegadores,
  pero por lo anterior conviene no publicar el proyecto de Supabase con datos reales.

---

## 10. Limitaciones y decisiones abiertas

**Pendiente de implementar** (detalle en `docs/REQUERIMIENTOS.md`): generación de PDF con QR, validación de QR por
empleados, candy bar, cupones, puntos, crédito y cancelación, reseñas, "Próximamente", "Mis películas", reportes y
exportaciones, log de actividad, PWA y despliegue.

**Limitaciones conocidas**
- El plano de butacas está duplicado en `sala-plantilla.ts` y en el SQL de la tabla `butacas`.
- La regla de precio vigente está en Angular y en SQL (ver 6.14).
- El máximo de 8 butacas figura en la configuración y como constante en Angular (la base es la que lo hace cumplir).
- El cliente solo llega a la selección de butacas desde el detalle de la película.
- Al cancelar una función, todavía no se avisa si tenía entradas vendidas (queda un `TODO` en el código y en el SQL).
- No hay pruebas automáticas propias todavía.

**Decisiones a revisar antes de la entrega**
- Si la preventa debe configurarse una vez por película y no por función (hoy es por función).
- Cómo se notificarán las alertas de "Próximamente" (correo, notificación push de la PWA o ambas).
