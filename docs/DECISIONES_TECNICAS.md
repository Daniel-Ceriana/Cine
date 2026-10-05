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
| Angular Material 22 | Selector de hora y controles del formulario de funciones | Para mejorar fechas y horas base |
| CSS propio con variables | Estilo general | Identidad visual propia (ver sección 7) |
| Google Fonts | Bungee, Special Elite, Inter | Tipografías de la identidad visual |
| `qrcode` | Generar el código QR de cada compra | Genera la imagen del QR en el navegador; es pequeña y no depende de Angular |
| `jsPDF` | Generar el PDF de la entrada | Arma el PDF en el navegador, sin servidor; se reutilizará para exportar reportes |

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
├── guards/           control de acceso por sesión y rol (canMatch) y confirmación al salir (canDeactivate)
├── pipes/            formatos de datos que vienen de la base (por modelo) y el filtro genérico de listas
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
- **Guards funcionales** con `canMatch` y `canDeactivate` (ver 3.6): la decisión de acceso se toma al elegir la
  ruta, sin pedidos a la red, y redirige al lugar correcto según el caso.
- **Pipes propios** para dar formato a los datos de la base y filtrar listas (ver 3.5): los templates dicen
  `{{ sala.formato | formatoSala }}` en lugar de repetir lógica de formato en cada componente.
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
| `/no-autorizado` | Cualquiera | Aviso de "sin permiso" (sesión iniciada con un rol que no alcanza) |
| `/admin/...` | Solo admin | Películas, salas, funciones, butacas por función |

### 3.4 Fechas y horas

- Toda la lógica de horarios está en **hora argentina fija (UTC−3)**, sin importar la zona del dispositivo. Argentina
  no tiene horario de verano, por lo que el desfase es constante.
- Se guardan como `timestamptz` (momento absoluto) y se muestran convertidos con `Intl.DateTimeFormat`, sin
  librerías de fechas.
- Las fechas y horas se ingresan **sin calendarios desplegables**, como pidió el cliente:
  días de la semana con botones, cantidad de semanas, y un selector de hora con pasos de 5 minutos.

### 3.5 Pipes

**Criterio:** todo dato que viene de la base y se muestra con formato pasa por un pipe. Antes, cada componente
repetía su propio método (`pesos()` estaba copiado en tres componentes, y `hora()` y `dia()` en varios) o escribía
la lógica en la plantilla (`restriccion_edad === 0 ? 'ATP' : '+' + ...`). Ahora hay un solo lugar por formato.

| Carpeta | Pipe | Ejemplo |
|---------|------|---------|
| `pipes/comunes` | `pesos` | `12500` → `$ 12.500` |
| | `duracion` | `135` → `2 h 15 min` |
| | `diaAr`, `horaAr`, `fechaCortaAr` | `lunes, 5 de octubre` · `18:00` · `lun 05/10` (siempre hora argentina) |
| | `filtrar` | filtra una lista por texto o booleano (ver abajo) |
| `pipes/sala` | `formatoSala`, `estadoSala` | `'3D'` · `true` → `Activa` |
| `pipes/pelicula` | `restriccionEdad` | `0` → `ATP`, `13` → `+13` |
| `pipes/funcion` | `idiomaFuncion` | `'castellano'` → `Castellano` |
| `pipes/butaca` | `tipoButaca`, `estadoButaca` | `'vip'` → `VIP` · `'reservada'` → `En proceso` |
| `pipes/compra` | `estadoCompra` | `'pendiente'` → `Pendiente de pago` |

**Decisiones:**
- **Un pipe por dato de dominio, agrupado por modelo**, y no uno por modelo con un parámetro. Cada pipe hace una sola
  cosa, se tipa con el tipo exacto del modelo (`FormatoSala`, `EstadoCompra`…) y es fácil de explicar. Un pipe
  por modelo con un `switch` interno se volvería una función enorme.
- **Los pipes son puros.** Angular solo los recalcula cuando cambia su entrada, así que no cuestan nada en cada
  ciclo de detección de cambios, y funcionan bien con signals.
- **Devuelven solo texto.** Los colores y clases (`chip--rojo`) quedan en el CSS y en la plantilla.
- **Los textos también se exportan como constantes** (`ETIQUETA_TIPO_BUTACA`, `ETIQUETA_ESTADO_BUTACA`) para usarlos
  desde TypeScript, por ejemplo en el título accesible de cada butaca del mapa. Así el texto no se escribe dos veces.
- **Los pipes de fecha reutilizan las funciones de `utilidades/fechas-ar.ts`**, que siguen siendo la fuente de la
  lógica. El pipe es solo la puerta de entrada desde las plantillas.

**El pipe `filtrar`** es genérico y configurable, en lugar de uno por modelo:

```html
@let filtradas = peliculas()
    | filtrar: nombre : ['nombre']                        <!-- contiene el texto -->
    | filtrar: genero : ['generos.nombre'] : true         <!-- coincidencia exacta -->
    | filtrar: soloDestacadas : ['destacada'];            <!-- true = solo las que tienen el campo en true -->
```

- Ignora mayúsculas y tildes ("acción" encuentra "Acción").
- Acepta rutas con puntos y listas (`generos.nombre` recorre los géneros de la película).
- El modo exacto evita que buscar "Drama" también traiga "Melodrama".
- Con un único pipe la lógica de normalizar texto está en un solo lugar; con uno por modelo se repetiría.
- Se usa con `@let` para poder contar los resultados y mostrar "ninguna película coincide".
- **Dónde quedan los `computed`:** el filtrado que solo afecta a lo que se muestra pasó a la plantilla con el pipe.
  Los `computed` se reservan para lógica (totales, agrupaciones por día, reglas de negocio).

### 3.6 Rutas y guards

**Un solo archivo de rutas** (`app.routes.ts`). Se decidió mantener todas las rutas juntas: el archivo es corto,
se lee de arriba abajo y en la defensa se puede mostrar el mapa completo de la aplicación de una vez.

**Guards funcionales con `canMatch`.** `canMatch` se evalúa al *elegir* la ruta, antes de cargar su código, y si no
se cumple la ruta ni siquiera se considera. Se usa en todas las rutas con control de acceso:

| Guard | Rutas | Comportamiento |
|-------|-------|----------------|
| `clienteMatch` | `/home`, `/peliculas/:id`, `/funcion/:id/butacas` | Pasan visitantes y clientes. El personal con panel propio va a su panel. |
| `rolMatch` | `/admin/**` (con `data.roles`) | Sin sesión o con otro rol → `/no-autorizado`. La pantalla se adapta: sin sesión invita a iniciar sesión; con sesión explica que la cuenta no tiene acceso. |
| `invitadoMatch` | `/login`, `/register` | Con sesión, redirige al inicio que le corresponde. |
| `confirmarSalidaGuard` (`canDeactivate`) | `/funcion/:id/butacas` | Pide confirmación si se sale con butacas reservadas sin pagar. |

**Redirección con `UrlTree` en lugar de `false`.** Con `false`, en un `canMatch` Angular sigue buscando otra ruta y
termina en la ruta comodín (`**`), que lleva al inicio sin explicar nada. Devolviendo un `UrlTree`, el usuario va
directo al destino correcto (la pantalla intermedia de "sin permiso"). Antes, además, `/no-autorizado` no existía como ruta. Se prefirió una pantalla intermedia en lugar de saltar
directo al login, para que el usuario entienda por qué no pudo entrar y elija si iniciar sesión.

**Sin pedidos a la red en los guards.** Antes, cada navegación le preguntaba a Supabase por la sesión y por el perfil
(hasta cuatro pedidos, sin guardar nada). Ahora el servicio `Auth` guarda la sesión y el perfil en **signals** y los
mantiene al día con `onAuthStateChange` de Supabase. Los guards solo leen memoria; lo único que esperan es que
termine la carga inicial de la sesión (`esperarInicio()`), que se hace una vez al abrir la aplicación.
Dos detalles que conviene saber:
- Dentro del callback de `onAuthStateChange` no se hacen pedidos a Supabase (puede bloquearse); se difieren con
  `setTimeout`.
- Al iniciar sesión, `signIn` espera a tener el perfil antes de terminar, para que el rol ya esté disponible al
  redirigir. Además ahora **lanza el error** de credenciales inválidas (antes se ignoraba y la pantalla de login
  navegaba igual).

**Roles sin panel todavía.** Los empleados (candy y entradas) aún no tienen pantallas. Para que no queden en un
bucle de redirecciones (`/home` → `/candy` → ruta inexistente → `/home`), `clienteMatch` solo redirige a los roles
listados en `ROLES_CON_PANEL` (hoy solo el admin). Cuando existan sus paneles se agregan a esa lista.

**Por qué, con un solo archivo de rutas, `canMatch` rinde poco frente a `canActivate` en bytes.**
Es importante tener claro qué se gana y qué no:

- El orden en el que Angular procesa una ruta es: `canMatch` → carga del archivo de rutas (`loadChildren`) →
  `canActivate` → `resolve` → **carga del componente (`loadComponent`)**. Es decir, aun con `canActivate`, el código
  de cada pantalla de admin **no se descarga** si el guard rechaza al usuario, porque `loadComponent` corre después
  de los guards.
- Donde `canMatch` sí ahorra descargas es cuando el área tiene **su propio archivo de rutas cargado con
  `loadChildren`** (`admin.routes.ts`): con `canActivate` ese archivo se descarga igual, y con `canMatch` no.
  Como se eligió **un solo archivo de rutas**, las rutas de admin viajan en el paquete inicial (son unas líneas) y
  no hay archivo de rutas extra que ahorrar.
- Por eso, con esta estructura, la ventaja de `canMatch` sobre `canActivate` es de **comportamiento**, no de peso:
  se evalúa al elegir la ruta, permite redirigir con `UrlTree` con un criterio uniforme en todas las rutas, y deja
  preparado el caso de dos rutas con el mismo path según el rol (por ejemplo, un `/inicio` distinto para cliente,
  admin y empleados).
- Si en el futuro el archivo creciera mucho (candy, cupones, reportes, empleados), dividirlo por áreas con
  `loadChildren` pasaría a tener sentido y ahí `canMatch` ya rendiría también en bytes; los guards no cambiarían.

### 3.7 Estructura del proyecto: ¿módulos?

Se evaluó pasar a NgModules (o partir en módulos por área) y se decidió **no hacerlo**. Los NgModules se vieron en
clase pero no son obligatorios, y en Angular 22 el estándar son los componentes standalone, que ya usa todo el
proyecto. La decisión se tomó con números, midiendo el build de producción:

| Medida | Resultado |
|--------|-----------|
| Paquete inicial | 576 kB (141 kB transferidos) |
| Formulario de funciones (Angular Material, solo admin) | 216 kB (41 kB transferidos) |
| Selección de butacas | 18 kB (5 kB transferidos) |
| Cualquier otra pantalla | menos de 10 kB (menos de 3 kB transferidos) |

Conclusiones:
1. **Ya hay carga diferida por pantalla:** cada componente es su propio archivo (`loadComponent`). Los módulos no
   cambiarían los límites de carga; solo agregarían archivos y código repetitivo para 25 componentes.
2. **Un visitante nunca descarga el código de admin** (los guards cortan antes de `loadComponent`).
3. **Lo único pesado de admin es Angular Material**, y ya está aislado en una pantalla.
4. **Los imports repetidos son de 1 a 3 líneas por componente:** no justifican una capa nueva (por ejemplo, un
   `SharedModule`).
5. **El paquete inicial supera en 76 kB el presupuesto por defecto de 500 kB.** Esos kilobytes son básicamente
   Angular y el cliente de Supabase, que se usan en casi todas las pantallas; no es un problema de estructura y los
   módulos no lo resolverían.

La organización actual es por área (`admin`, `cliente`, `compartido`), con las piezas reutilizables en
`compartido`, los servicios por tema y las utilidades en funciones puras.

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
| `005_codigos_validacion.sql` | Código corto de la compra, validación de entrada y candy (un uso por sección) |
| `006_cupones_puntos_notificaciones.sql` | Cupones, puntos, canje, notificaciones; reemplaza `reservar_butacas` y `confirmar_pago` |

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

### 6.15 Código de la compra, QR, PDF y validación en el cine

**Un solo código por compra.** Cada compra recibe, al crearse, un código corto con el formato `K7Q2-9XMD`
(8 caracteres). Ese código es **el contenido del QR** y también lo que el empleado puede **escribir a mano**: lo que
lee un escáner (si algún día hubiera uno) y lo que se teclea son exactamente lo mismo.

- **Alfabeto sin ambiguos:** no incluye `0`, `O`, `1`, `I` ni `L`, para que no se confundan al leerlo o dictarlo.
  Quedan 31 símbolos, es decir más de 850 mil millones de combinaciones.
- **Lo genera la base** (`generar_codigo_compra`), con una fuente de azar segura (`gen_random_uuid()`), y es único.
  Se acepta con o sin guión, en mayúsculas o minúsculas.
- Reemplaza al `qr_token` (UUID largo) que existía antes: es incómodo de escribir.

**Dos secciones, un solo uso cada una.** Con el mismo código se valida la **entrada** (ingreso a la sala) y el **candy**
(retiro de productos), pero cada sección se marca como usada **por separado y una sola vez**
(`entrada_validada_at` y `candy_entregado_at`). Ejemplo: alguien puede entrar a la sala y retirar el candy más tarde
con el mismo código, pero no entrar dos veces.

**Toda la lógica está en la base**, en dos funciones SQL:
- `evaluar_codigo` (solo consulta): dice a qué compra corresponde el código y, si no se puede validar, **por qué**
  (compra sin pagar, función cancelada, ya usado —con fecha y quién—, todavía es pronto, la función ya terminó, o la
  compra no incluye candy).
- `validar_codigo`: marca la sección como usada. Usa `UPDATE ... WHERE ... IS NULL` y comprueba cuántas filas
  modificó, de modo que **si dos empleados validan el mismo código a la vez, solo uno lo consigue**.
- Los permisos también se validan ahí: solo el admin y el empleado de esa sección pueden usarlas. Un cliente que
  llame a la función directamente recibe un error.

**Ventana de validación:** desde **60 minutos antes** del inicio hasta que **termina** la función. Evita que se
"gaste" una entrada días antes o que se use la de una función que ya terminó.

**Pantalla de empleados.** Es **una sola** (`ValidarCodigo`) usada por dos rutas (`/entradas` y `/candy`), y la ruta
indica cuál es mediante `data.seccion`. Así no se repite código. El flujo es: el empleado escribe el código →
**Consultar** muestra película, función, sala, butacas y comprador (y avisa si la película tiene restricción de
edad) → **Confirmar** registra el ingreso o la entrega. Como no hay un lector de QR real, la pantalla muestra un
aviso de que el lector no está disponible y solo ofrece el ingreso manual; por eso el sistema **genera** QR pero no
tiene funciones para **leerlos**.

**Generación del QR y del PDF (en el navegador, sin servidor):**
- Se usan dos librerías: `qrcode` (arma el QR como imagen) y `jsPDF` (arma el PDF).
- Se cargan con **importación dinámica**, solo cuando el usuario descarga su entrada: no engordan el paquete inicial
  (jsPDF pesa unos 410 kB sin comprimir y solo se descarga en ese momento).
- El PDF tiene el aspecto de una entrada de cine con la identidad visual del sistema: datos de la función a la
  izquierda, línea de corte punteada y talón con el QR y el código a la derecha. Incluye el aviso de adulto si la
  película tiene restricción de edad, y las indicaciones de uso.
- El QR y el PDF se generan **al confirmar el pago**; después el PDF se puede descargar desde la pantalla de
  confirmación.

**Empleados.** Las cuentas del personal se crean como cualquier otra (registro). El admin, desde la pantalla
**Empleados**, busca la cuenta por email y le asigna el rol (`empleado_entradas`, `empleado_candy` o `admin`) o se
lo quita. No puede quitarse a sí mismo el rol de administrador (evita quedarse sin acceso por error).

**Candy.** La compra todavía no incluye productos, así que la columna `tiene_candy` queda en `false` y la pantalla
de candy responde "la compra no incluye productos". Cuando se implemente el candy, la compra marcará `tiene_candy` y
la entrega funcionará sin cambios. Para probar la pantalla antes, se puede marcar una compra a mano en la base.

---

### 6.16 Cupones

**Dos clases de cupón**, que el admin gestiona desde su pantalla:
- **Primera compra:** es **único** (un índice parcial en la base lo garantiza). El admin solo le cambia el porcentaje
  o lo activa y desactiva. Se aplica a la cuenta que todavía no tiene ninguna compra pagada.
- **Por rango de edad:** se pueden crear varios (nombre, edad desde, edad hasta opcional, porcentaje, activo). El rango
  incluye ambas edades; sin "hasta" no tiene tope. "Más de 50 años" se carga como "desde 51".

**Se aplican solos, sin códigos que escribir.** Coincide con el pedido del cliente, que describe descuentos por
condición (primera compra, edad) y no por código. Si a una cuenta le corresponden varios, se aplica **el de mayor
descuento** (no se acumulan, para evitar descuentos desmedidos).

**Solo para cuentas registradas:** la edad y la "primera compra" no se pueden verificar en una compra anónima.

**La regla vive en la base** (`cupon_aplicable`), y `reservar_butacas` la usa al calcular el total. La pantalla de
compra le pregunta a la base qué cupón le corresponde (`mi_cupon`) solo para mostrarlo antes de pagar, de modo que
no haya dos versiones de la regla. El descuento se aplica sobre lo que se paga en dinero (no sobre lo canjeado con puntos).

**La compra guarda una copia del cupón** (nombre y porcentaje, más el monto descontado). Si el admin cambia o
desactiva el cupón después, las compras anteriores no se alteran.

### 6.17 Puntos, canje y notificaciones

**Cómo se ganan:** 1 punto por cada peso **efectivamente pagado**, es decir, con el descuento ya aplicado
(`floor(total)`), solo con cuenta. Se acreditan al **confirmar el pago**, no al reservar, para que una reserva
abandonada no sume puntos.

**Cómo se canjean:** durante la compra, cada butaca puede marcarse como "pagar con puntos".
- El costo de una entrada lo define el admin (tabla `recompensas`, editable desde su pantalla de Puntos).
- Los puntos cubren el precio de la entrada; el **recargo VIP se sigue pagando en dinero**.
- Como la tabla de recompensas admite tipo `entrada` y `producto`, los productos del candy se suman después sin
  cambiar el modelo.
- **Los puntos se descuentan al confirmar el pago**, con el perfil bloqueado (`FOR UPDATE`) y verificando de nuevo el
  saldo. Así, aunque alguien abra dos compras a la vez, no puede gastar dos veces los mismos puntos.
- `compra_butacas.precio` pasa a guardar lo cobrado **en dinero** por esa butaca (0 si se pagó con puntos, salvo el
  recargo VIP). El "recaudado" del admin suma el total de cada compra pagada, contada una sola vez.

**Historial:** cada ganancia o canje queda en `puntos_movimientos` (con la compra a la que corresponde). El perfil
muestra el historial y permite filtrar solo los canjes. Los puntos no se transfieren entre usuarios: no existe ninguna
operación que mueva puntos de una cuenta a otra.

**Notificaciones dentro de la aplicación (el sistema no envía mails).** Cuando hay algo que avisar, se crea una fila
en `notificaciones` y el usuario la ve en la pestaña "Notificaciones" de **Mi perfil**, con un contador de no leídas.
Hoy se generan al **confirmar la compra** (con el código de la entrada) y al **realizar un canje**. Las alertas de
estreno y el aviso de función cancelada usarán este mismo mecanismo cuando se implementen. Se crean dentro de las
mismas funciones SQL que confirman el pago, así que no puede quedar una compra confirmada sin su aviso.

**Mi perfil.** Muestra los datos de la cuenta, el saldo de puntos y de crédito, el historial y las notificaciones. El
saldo se vuelve a leer al entrar, para que refleje la última compra.

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
- **Roles** en `profiles.rol`; los guards (`canMatch`) leen el rol que `Auth` guarda en memoria y redirigen según el caso.
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

**Pendiente de implementar** (detalle en `docs/REQUERIMIENTOS.md`): candy bar, cupones, puntos, crédito y cancelación, reseñas, "Próximamente", "Mis películas", reportes y
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
