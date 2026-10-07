# Requerimientos — Sistema de venta de entradas para un cine

Trabajo Práctico 1 — Programación IV (2026 C2)

Este documento resume **todos** los requerimientos pedidos por el cliente en el intercambio de mails, las
reglas de negocio que se acordaron durante el desarrollo y el **estado actual** de cada punto.

**Estado:** `Hecho` · `Parcial` (funciona, pero le falta una parte) · `Pendiente` · `Fuera de alcance`

---

## 1. Origen de los requerimientos

Los mails del cliente se numeran en el orden en que aparecen en la consigna. La columna "Origen" de las
tablas usa ese número.

| Mail | Fecha | Tema |
|------|-------|------|
| 1 | 01/01/2020 | Pedido inicial: sistema completo de venta de entradas |
| 2 | 16/01/2020 | Reseñas con estrellas, puntuación promedio, top 3 en el inicio, buscador |
| 3 | 16/01/2020 | El buscador filtra por género (varios géneros por película) |
| 4 | 30/01/2020 | Cupón configurable, cupones para mayores de 50, candy bar, mapa del cine |
| 5 | 06/02/2020 | Administración, empleados, validación de QR, asignación automática de salas |
| 6 | 12/02/2020 | Restricción de edad, butacas accesibles, butacas en tiempo real |
| 7 | 28/02/2020 | Interfaces simples, mejor ingreso de fechas y horas, reporte de facturación |
| 8 | 03/03/2020 | Puntos de fidelización, combos |
| 9 | 08/03/2020 | Próximamente, preventa, "Mis películas" |
| 10 | 10/03/2020 | Cancelación con crédito, butacas VIP, exportar reportes, gráficos, log de actividad |

---

## 2. Roles del sistema

| Rol | Qué hace |
|-----|----------|
| **Visitante (sin sesión)** | Ve la cartelera y puede comprar entradas de forma anónima, siempre que pague. |
| **Cliente registrado** | Todo lo del visitante, más beneficios: cupón de primera compra, puntos, crédito, historial. |
| **Admin** | Controla salas, funciones, películas, productos, cupones, precios, reportes y log. |
| **Empleado de entradas** | Escanea o ingresa a mano el código para validar entradas en la puerta de la sala. |
| **Empleado de candy** | Escanea o ingresa a mano el código para entregar los productos del candy bar. |

---

## 3. Requerimientos funcionales

### 3.1 Cartelera y películas

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-01 | Cada película tiene nombre, imagen, duración y sinopsis. | 1 | Hecho |
| RF-02 | El admin decide qué películas aparecen al entrar a la página (activa / destacada). | 1 | Hecho |
| RF-03 | Cada película puede tener **varios géneros**. | 3 | Hecho |
| RF-04 | El listado de películas tiene un buscador por nombre y por género. | 2, 3 | Hecho |
| RF-05 | En la página principal se muestran primero las **3 películas más vendidas** (entradas vendidas en los últimos 30 días). | 2 | Hecho |
| RF-06 | Las películas pueden tener restricción de edad: sin restricción, +13 o +18. | 6 | Hecho |
| RF-07 | Sección "Próximamente" con las películas que se estrenan más adelante y todavía no están a la venta. | 9 | Hecho |
| RF-08 | El usuario puede activar una alerta para que le avisen cuando abra la venta de una película próxima. | 9 | Hecho |
| RF-09 | Reseñas: calificación con estrellas y comentario corto, visibles **antes** de comprar. | 2 | Hecho |
| RF-10 | Se muestra la puntuación promedio de cada película. | 2 | Hecho |
| RF-11 | Sección "Mis películas": historial visual de lo que vio el usuario (póster, fecha, su calificación). | 9 | Hecho |
| RF-12 | Detalle de película con sus próximas funciones, con precio y acceso a la compra. Se eligen por día: chips con los días que tienen funciones y, abajo, las del día elegido. | 1 | Hecho |

### 3.2 Salas y funciones

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-20 | El cine es un solo edificio con varias salas; el admin las crea y modifica. | 1, 5 | Hecho |
| RF-21 | Cada sala tiene un tipo de proyección: 2D, 3D, 4D o 5D. | 1 | Hecho |
| RF-22 | Cada función define película, sala, día y horario, e idioma (castellano o subtitulada). | 1 | Hecho |
| RF-23 | No puede haber una función antes de que pase **media hora** de que terminó la anterior en esa sala. | 1 | Hecho |
| RF-24 | La asignación de sala es **automática** y bajo ningún término dos funciones coinciden en la misma sala al mismo tiempo. | 5 | Hecho |
| RF-25 | El admin puede programar una película para varios días de la semana a la misma hora (ej.: lunes, martes y viernes a las 18 h). | 5 | Hecho |
| RF-26 | Preventa: abrir la venta antes del estreno con un **precio especial**, que vuelve al normal al pasar la fecha. Configurable película por película. | 9 | Hecho |
| RF-27 | Una función no puede empezar antes de la **fecha de estreno** de su película. | acordado | Hecho |

> RF-26: el precio y los días de preventa se configuran **una sola vez por película** (formulario de película). Después,
> el admin marca **qué funciones tienen preventa** (casilla "Con preventa"): solo esas se venden antes del estreno. La
> regla se aplica al vender (`reservar_butacas`).

### 3.3 Butacas y compra de entradas

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-30 | Todas las salas tienen la misma distribución de butacas (ver sección 5). | 1, 6 | Hecho |
| RF-31 | Butacas accesibles para personas con discapacidad, resaltadas de forma distinta en el mapa. | 6 | Hecho |
| RF-32 | Butacas VIP (filas R, S y T): precio más alto y marcadas de forma distinta. El usuario debe saber claramente que compra una VIP antes de pagar. | 10 | Hecho |
| RF-33 | Las butacas ocupadas se ven **en tiempo real** mientras el usuario elige. | 6 | Hecho |
| RF-34 | Dos personas nunca pueden comprar la misma butaca de la misma función. | 1, 6 | Hecho |
| RF-35 | Se puede comprar sin cuenta (anónimo) o con cuenta. | 1 | Hecho |
| RF-36 | Menores de 13 o de 18 años no pueden comprar entradas de películas con esa restricción. Toda entrada de esas películas aclara que debe ir un adulto. | 6 | Hecho |
| RF-37 | Pago de la compra. | 1 | Parcial |
| RF-38 | Al confirmar la compra se genera un **PDF** con los datos de la entrada y un **código QR**. | 1 | Hecho |
| RF-39 | El usuario puede cancelar hasta 2 horas antes de la función. No se devuelve dinero: se acredita **crédito** en su cuenta, usable junto con otros medios de pago. | 10 | Hecho |

> RF-37: el pago está **simulado** (no hay cobro real). La compra queda pendiente hasta confirmarse.

### 3.4 Usuarios y beneficios

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-40 | Registro con: email, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos y días de vacaciones por año. | 1 | Hecho |
| RF-41 | Inicio y cierre de sesión, con redirección según el rol. | 5 | Hecho |
| RF-42 | Cupón de **20 % en la primera compra** para quien se registra. | 1 | Hecho |
| RF-43 | El admin puede cambiar el porcentaje del cupón de primera compra cuando quiera. | 4 | Hecho |
| RF-44 | El admin puede crear cupones que solo apliquen a usuarios de **más de 50 años**. | 4 | Hecho |
| RF-45 | Puntos de fidelización: 1 punto por cada peso gastado (solo usuarios registrados). | 8 | Hecho |
| RF-46 | Canje de puntos por entradas gratis o productos del candy. El admin configura cuántos puntos cuesta cada recompensa. | 8 | Hecho |
| RF-47 | El perfil muestra los puntos acumulados, el historial de canjes y el crédito. Los puntos no se transfieren. | 8, 10 | Hecho |

> RF-46: se canjean **entradas** (costo único, en Puntos) y **productos** (cada producto tiene su propio costo en
> puntos, que el admin edita en el formulario del producto).
> RF-47: puntos, historial de canjes, **crédito con su historial** y notificaciones. El crédito se acredita al
> cancelar una compra (RF-39).

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-48 | Los avisos al usuario (por ejemplo "estrenos" o compras) se ven en **Mi perfil → Notificaciones**. El sistema **no envía mails**. | 9 (aclaración) | Parcial |

> RF-48: hoy se avisa cuando se confirma una compra, al hacer un canje, al cancelar una compra y cuando el cine cancela
> una función. Las alertas de estreno (RF-08) usan el mismo mecanismo.

### 3.5 Candy bar

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-50 | El admin crea productos (pochoclos, bebidas, etc.) y los ordena en categorías. | 4 | Hecho |
| RF-51 | Los productos se compran **junto con la entrada** y se retiran con el mismo QR. | 4 | Hecho |
| RF-52 | Combos (entrada + pochoclos + bebida) a precio fijo, configurables por el admin y destacados en la compra. | 8 | Hecho |

### 3.6 Validación en el cine

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-60 | Los empleados validan entradas y candy con el código de la compra (cine y candy). | 5 | Hecho |
| RF-61 | Se puede ingresar el código a mano (no hay lector de QR real: solo se genera el QR). | 5 | Hecho |
| RF-62 | Una vez validada la entrada o entregada la comida, el QR **deja de funcionar** (la entrada y el candy se validan por separado). | 5 | Hecho |

> RF-62: la entrada y el candy se usan una sola vez cada uno. Con productos en la compra ya se prueba de punta a punta.

### 3.7 Administración, reportes y auditoría

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-70 | Usuario admin que controla salas, funciones, distribución de butacas, productos, etc. | 5 | Parcial |
| RF-77 | Pantalla de configuración del admin: recargo VIP, máximo de butacas por compra, minutos de reserva, horas de cancelación y máximo de unidades de cada producto del candy. | acordado | Hecho |
| RF-78 | "Mi entrada": quien compró sin cuenta recupera su entrada (QR y PDF) con código + email. Con cuenta, "Mi perfil → Mis compras". | acordado | Hecho |
| RF-71 | Gestión de empleados (usuarios que validan QR). | 5 | Hecho |
| RF-72 | Reporte de facturación por día y de cantidad de entradas vendidas. | 7 | Hecho |
| RF-73 | Exportar el reporte de facturación a PDF y a Excel. | 10 | Hecho |
| RF-74 | Gráfico de películas más vistas por semana y por mes, y producto del candy más vendido. | 10 | Hecho |
| RF-75 | Log de actividad: quién creó una función, quién modificó un precio, quién validó un QR, con fecha y hora. | 10 | Hecho |
| RF-76 | Mapa del cine que indique la sala de la entrada comprada. | 4 | Fuera de alcance (el cliente aún no dio "luz verde") |

> RF-70: el admin ya gestiona películas, salas y funciones. La distribución de butacas es la misma en todas las
> salas y se modifica desde el código (decisión acordada). Ya están cupones, empleados y productos con sus categorías.

---

## 4. Requerimientos no funcionales y de la consigna

| ID | Requerimiento | Estado |
|----|---------------|--------|
| RNF-01 | Interfaces fáciles de navegar y entender, tanto para clientes como para empleados. | Parcial |
| RNF-02 | Nada de selectores de fecha y hora engorrosos ni demasiado scroll. | Parcial |
| RNF-03 | Estilo visual **único y producido**. | Hecho (falta aplicarlo a las pantallas nuevas) |
| RNF-04 | Uso correcto de Angular, buenas prácticas y técnicas vistas en clase. | En curso |
| RNF-05 | Integración con **Supabase**. | Hecho |
| RNF-06 | Integración de **PWA**. | Hecho (instalación verificada) |
| RNF-07 | Aplicación **desplegada** con URL funcional. | Parcial (Firebase Hosting configurado; falta confirmar URL y URLs permitidas en Supabase Auth) |
| RNF-08 | Código en GitHub. | Hecho |
| RNF-09 | README con arquitectura y decisiones técnicas. | Parcial (ver `docs/DECISIONES_TECNICAS.md`) |
| RNF-10 | Interfaz usable en celular (el cliente compra desde el teléfono). | Parcial |

---

## 5. Distribución de butacas (igual en todas las salas)

```
         izquierda        centro (20)                       derecha
Filas A–I   1  2  3  4  |  6 … 25                        | 27 28 29 30   comunes
Fila  J        2  3     |    11 … 20                     |     28 29      accesibles (2 + 10 + 2)
Fila  K     (hueco: no existe, separa el mapa)
Filas L–Q   1  2  3  4  |  6 … 25                        | 27 28 29 30   comunes
Filas R–T   1  2  3  4  |  6 … 25                        | 27 28 29 30   VIP
```

- Los números son **absolutos dentro de la fila**; el 5 y el 26 son pasillos.
- 18 filas de 28 butacas + 14 accesibles = **518 butacas por sala**.
- Código de butaca: fila + número (ejemplo: `A6`, `J11`, `T30`).

---

## 6. Reglas de negocio aplicadas

**Funciones**
1. El tipo de proyección (2D/3D/4D/5D) lo determina la **sala**, no la función.
2. Una función ocupa su sala desde el inicio hasta el fin de la película **más 30 minutos**, redondeado hacia arriba
   a un múltiplo de 5 minutos. Ejemplo: si termina 20:31, la próxima puede empezar a las 21:05, no a las 21:01.
3. Los horarios de inicio son siempre múltiplos de 5 minutos.
4. Una función puede pasar de medianoche.
5. La sala se asigna sola: se elige una sala libre del formato pedido. Si en algún día no hay ninguna, no se crea
   ninguna función y se avisa qué días fallaron.
6. Al modificar, se elige entre cambiar **solo esa función** o **esa y las siguientes de su serie** (las creadas juntas).
7. Una función **no puede ser anterior al estreno** de su película (lo valida la base al crear, mover o modificar; el
   calendario de Angular solo muestra días válidos). Si se posterga el estreno, las funciones que queden antes de la
   nueva fecha se cancelan con compensación a los compradores, previa confirmación del admin con el resumen.

**Precios**
8. La preventa: la película define `dias_preventa` y `precio_preventa` (precio especial que **reemplaza** al base) y el
   admin marca las funciones con preventa (`funciones.con_preventa`). Una función con preventa se vende desde
   `estreno − días de preventa`, al precio de preventa, hasta el estreno; desde el estreno, precio base. **Antes del
   estreno solo se venden las funciones con preventa**; las demás, desde el estreno.
9. Las butacas VIP suman un **recargo global** configurable por el admin. Las accesibles cuestan lo mismo que las comunes.
10. El precio se guarda tal como se cobró en cada entrada: cambios posteriores no alteran compras anteriores.

**Compra**
10. Máximo **8 butacas** por compra.
11. Al confirmar la elección, las butacas quedan **reservadas 5 minutos** para completar el pago. Si no se paga,
    se liberan solas. Los demás usuarios ven esas butacas como "en proceso".
12. Menores: con cuenta se verifica con la fecha de nacimiento y se bloquea la compra; sin cuenta se exige tildar una
    declaración de edad. Toda entrada de una película con restricción indica que debe asistir un adulto.
13. Se puede comprar hasta que empieza la función.
14. Un solo código por compra (`K7Q2-9XMD`), que es el contenido del QR y también se puede escribir a mano. La entrada y
    el candy se validan por separado y una sola vez cada una.
    La validación de la entrada se habilita desde 60 minutos antes de la función y hasta que termina.

**Usuarios**
15. Se puede registrar cualquier persona de **10 años o más**.

**Cupones y puntos**
16. Los cupones se aplican solos y solo a cuentas registradas. Hay uno de primera compra (único, con porcentaje editable) y
    los de rango de edad que el admin quiera. Si corresponden varios, se aplica el de mayor descuento.
17. Se gana 1 punto por cada peso efectivamente pagado (con el descuento ya aplicado), al confirmar el pago.
18. Los puntos cubren el precio de la entrada (el costo lo define el admin); el recargo VIP se paga en dinero.
    Los puntos no se transfieren entre usuarios.

**Cancelación (a implementar)**
19. Cancelación hasta 2 horas antes, con crédito. Si se cancela una función que ya tiene entradas vendidas, se avisa
    al admin y los compradores reciben puntos equivalentes.

---

## 7. Fuera de alcance por ahora

- Mapa general del cine (RF-76): el cliente todavía no lo aprobó.
- Pasarela de pago real: se usa un pago simulado.

--------------------------------------------------
--------------------------------------------------
--------------------------------------------------


# Decisiones técnicas y arquitectura

Trabajo Práctico 1 — Programación IV (2026 C2) · Sistema de venta de entradas para un cine

Este documento explica **cómo está armada la aplicación y por qué se tomó cada decisión**. Refleja el estado actual
del proyecto; lo que todavía no está hecho figura en la sección 10 y en las tablas de requerimientos de este archivo.

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
| `jsPDF` | Generar el PDF de la entrada y el del reporte de facturación | Arma el PDF en el navegador, sin servidor |
| `chart.js` | Gráficos de barras de la pantalla de gráficos del admin | MIT. Se registran solo las piezas que se usan (barras, ejes y tooltip) y se carga con importación dinámica al abrir esa pantalla (unos 61 kB comprimidos). Se descartaron los gráficos con SVG propio (se eligió la librería por sus tooltips y su ajuste automático), `ng2-charts` (una dependencia más) y `ngx-charts` (usa d3, más pesada) |
| `write-excel-file` | Exportar el reporte de facturación a Excel (`.xlsx`) | Pequeña (unos 20 kB comprimida), licencia MIT, reutiliza `fflate` (que ya trae jsPDF) y se carga solo al exportar. Se descartaron SheetJS (más pesada y con la versión de npm sin actualizar) y ExcelJS (unas 45 veces más pesada) |

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
│   ├── cliente/      pantallas del público (inicio, detalle, selección de butacas y pago, perfil, Mi entrada)
│   └── compartido/   piezas reutilizables (nav, login, registro, listado y tarjeta de película, mapa de butacas, tarjeta de compra)
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
| `/funcion/:id/butacas` | Visitante y cliente | Elegir butacas, reservar y pagar (con crédito, cupón y puntos) |
| `/mi-entrada` | Visitante y cliente | Recuperar una entrada comprada sin cuenta, con código + email |
| `/perfil` | Con sesión | Mis compras (con cancelación), puntos, crédito, datos y notificaciones |
| `/entradas`, `/candy` | Empleados (y admin) | Validar entradas y entregar candy ingresando el código |
| `/login`, `/register` | Sin sesión | Acceso y registro |
| `/no-autorizado` | Cualquiera | Aviso de "sin permiso" (sesión iniciada con un rol que no alcanza) |
| `/admin/...` | Solo admin | Películas, salas, funciones (con butacas por función), empleados, cupones, puntos, configuración y productos con sus categorías |

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
| `007_mis_compras_credito.sql` | Crédito (historial y uso al pagar), `cancelar_compra`, `buscar_entrada`, `peliculas_mas_vendidas`; reemplaza `reservar_butacas` y `confirmar_pago` |
| `009_funciones_desde_estreno.sql` | `funciones.con_preventa`, funciones solo desde el estreno, cancelación de funciones al postergar el estreno; reemplaza `colocar_funcion`, `crear_funciones`, `modificar_funciones` y `reservar_butacas` |
| `008_funcion_cancelada_preventa.sql` | Preventa por película, `compensar_compra`, `cancelar_funcion`, `resumen_cancelacion`, regla de funciones vendidas; reemplaza `colocar_funcion`, `crear_funciones`, `modificar_funciones`, `reservar_butacas` y `cancelar_compra` |
| `010_productos_categorias.sql` | Catálogo del candy: `categorias_producto` y `productos` (imagen obligatoria), con 3 categorías y 8 productos de ejemplo |
| `011_candy_en_la_compra.sql` | `compra_items`, `productos.costo_puntos`, `compras.candy_subtotal/candy_descuento`, configuración `max_unidades_candy`; reemplaza `confirmar_pago` y `evaluar_codigo` (y le sumó productos a `reservar_butacas`, que la 012 deja sin ellos) |
| `012_candy_sobre_la_reserva.sql` | La reserva empieza al elegir las butacas y el candy se agrega después: `definir_candy_compra`, `validar_candy`, `guardar_candy`; `reservar_butacas` vuelve a recibir solo butacas |
| `013_combos.sql` | `combos`, `combo_items`, `compra_combos`, `guardar_combo`, `validar_combos` (reemplaza las tablas de combos viejas, si había); reemplaza `reservar_butacas` (guarda `compras.precio_entrada`), `guardar_candy`, `definir_candy_compra` y `evaluar_codigo`; 3 combos de ejemplo |
| `014_resenias.sql` | `resenias` (reemplaza una tabla vieja, si había), vista `peliculas_puntuacion`, `puede_resenar`, `guardar_resenia`, `eliminar_resenia`, `mis_peliculas` |
| `015_proximamente.sql` | `alertas_estreno` (reemplaza una tabla vieja, si había), `notificaciones.pelicula_id` y tipo `estreno`, `pelicula_con_venta_abierta`, `activar_alerta`, `quitar_alerta`, `revisar_alertas` |
| `016_reporte_facturacion.sql` | `reporte_facturacion(desde, hasta)`: una fila por día con movimiento, solo para el admin (no agrega tablas) |
| `017_graficos.sql` | `ranking_peliculas`, `ranking_productos` y `ranking_combos`: los más vendidos de un período, solo para el admin (no agrega tablas) |
| `018_log_actividad.sql` | `log_actividad` y la vista `log_usuarios`, los triggers que escriben el log (películas, salas, productos, categorías, combos, productos de combos, cupones, recompensas, configuración, funciones, roles y validaciones) y `guardar_combo` (ahora solo toca los productos que cambian) |

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
| `peliculas` | Nombre, sinopsis, imagen, duración, estreno, restricción de edad y **preventa** (`precio_preventa`, `dias_preventa`) |
| `generos`, `pelicula_generos` | Relación muchos a muchos entre películas y géneros |
| `salas` | Número, nombre, **formato** (2D–5D) y si está activa |
| `funciones` | Película + sala + inicio + idioma + precio base + `con_preventa` + serie. Guarda también `fin_bloqueo` |
| `butacas` | 518 filas fijas con código, fila, bloque, número y tipo (normal/accesible/vip) |
| `compras` | Una por función: comprador, estado, vencimiento de la reserva, subtotal, descuento, total, `codigo`, puntos y crédito usados, y si se canceló (`cancelada_at`, `cancelada_motivo`) |
| `compra_butacas` | Una por butaca comprada: precio cobrado y estado (reservada/vendida/liberada) |
| `compra_items` | Productos del candy de cada compra: nombre y precio del momento, cantidad y, si se canjearon, puntos por unidad; los que vienen en un combo llevan su nombre (`combo_nombre`) y precio 0 |
| `combos`, `combo_items` | Combos del candy (precio fijo, cantidad de entradas, imagen obligatoria, orden, activo, destacado) y los productos que incluye cada uno |
| `compra_combos` | Combos de cada compra: nombre, cantidad, entradas y precio del momento |
| `log_actividad` | Quién (nombre y rol al momento), qué acción, sobre qué, cuándo y el detalle del antes y el después. Lo escriben triggers |
| `alertas_estreno` | Una por persona y por película próxima: si ya se avisó (`avisada`) y cuándo |
| `resenias` | Una por persona y por película: estrellas (1 a 5), comentario opcional (hasta 300 caracteres) y fechas |
| `cupones`, `recompensas` | Descuentos (primera compra, rango de edad) y cuántos puntos cuesta canjear cada cosa |
| `puntos_movimientos` | Historial de puntos: ganados, canjes, devoluciones y ajustes |
| `credito_movimientos` | Historial del crédito: se acredita al cancelar y se usa al pagar (el saldo está en `profiles.credito`) |
| `notificaciones` | Avisos que se ven en Mi perfil (compra, canje, cancelación) |
| `categorias_producto` | Categorías del candy: nombre único, orden y si está activa |
| `productos` | Productos del candy: categoría, nombre, descripción, precio, **costo en puntos** (opcional), **imagen obligatoria**, orden y si está activo |
| `configuracion` | Valores que el admin modifica: recargo VIP, máximo de butacas, minutos de reserva, horas de cancelación y máximo de unidades de candy |

---

## 6. Decisiones de negocio y cómo se implementaron

### 6.1 El precio base va en la función; la preventa, repartida entre película y función
El precio normal depende de *cuándo y dónde* se proyecta, por eso `precio_base` vive en `funciones`. La preventa se
reparte: la **película** define cuánto dura (`dias_preventa`) y a qué precio (`precio_preventa`), una sola vez, como
pidió el cliente ("película por película"); la **función** dice si participa (`con_preventa`), porque no todas las
funciones se abren antes del estreno. Una función no puede ser anterior al estreno (ver 6.20).

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

**Candy.** Cuando la compra incluye productos, `tiene_candy` queda en `true` y la pantalla de candy muestra **qué
productos entregar** (`evaluar_codigo` los devuelve). Se entrega una sola vez (`candy_entregado_at`), por separado de
la entrada.

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
- Los productos del candy **no usan la tabla de recompensas**: cada producto tiene su propio `costo_puntos` (vacío = no
  se canjea), que el admin edita en el formulario del producto. El costo de la entrada sigue en `recompensas`.
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
estreno usarán este mismo mecanismo cuando se implementen. También se crean al cancelar una compra y al cancelar una
función. Se crean dentro de las
mismas funciones SQL que confirman el pago, así que no puede quedar una compra confirmada sin su aviso.

**Mi perfil.** Muestra los datos de la cuenta, el saldo de puntos y de crédito, el historial y las notificaciones. El
saldo se vuelve a leer al entrar, para que refleje la última compra.

### 6.18 Mis compras, cancelación y crédito

- **Mis compras** (Mi perfil): las compras pagadas de la cuenta, con QR, código y PDF. Una reserva abandonada también
  queda `cancelada`, por eso se listan solo las que tienen `pagada_at`.
- **Mi entrada** (`/mi-entrada`, pública): quien compró sin cuenta no tiene sesión, así que recupera su entrada con
  **código + email**. La función `buscar_entrada` responde siempre el mismo error si no coinciden, para no revelar qué
  códigos existen. Desde ahí **no se cancela**: el crédito se acredita en una cuenta y el anónimo no tiene.
- **Cancelar** (`cancelar_compra`, atómica): solo el dueño, compra pagada, entrada sin usar y hasta
  `configuracion.horas_cancelacion` (2) horas antes de la función. Libera las butacas (se ven libres en tiempo real),
  marca la compra `cancelada`, **acredita crédito por el total** y crea una notificación. Se cancela la compra entera.
- **Puntos al cancelar:** se quitan los ganados en esa compra (sin dejar el saldo en negativo, movimiento `ajuste`) y se
  devuelven los canjeados (`devolucion`). El cupón de primera compra vuelve a estar disponible porque `cupon_aplicable`
  solo mira compras `pagada`.
- **Crédito ≠ puntos:** el saldo es `profiles.credito` y su historial `credito_movimientos`. Al comprar, la casilla
  "Usar mi crédito" lo aplica hasta cubrir el total (`compras.credito_usado`); el resto se paga con el medio de pago
  (si el crédito cubre todo, se confirma sin pagar). Se descuenta recién al confirmar, con el perfil bloqueado.
  Los puntos ganados se calculan sobre el **dinero** pagado, no sobre el crédito, para no generar puntos reciclándolo.
- **Más vendidas:** `peliculas_mas_vendidas(30, 3)` cuenta butacas `vendida` de compras pagadas de los últimos 30 días;
  las canceladas no suman.

### 6.19 Función cancelada, funciones con entradas vendidas y preventa

- **Cancelar una función** (`cancelar_funcion`, atómica) solo se puede si todavía no empezó. Para cada compra pagada
  usa `compensar_compra` (la misma que `cancelar_compra`): libera las butacas, la marca `cancelada` con motivo
  `cine`, acredita el total como crédito, ajusta los puntos (quita los ganados y devuelve los canjeados) y crea una
  notificación "Función cancelada". También libera a quien estaba en el paso de pago.
- **Compradores sin cuenta:** la compra se cancela y las butacas se liberan, pero no hay dónde acreditar ni avisar. El
  admin ve la lista (nombre, email, código y total) para contactarlos por fuera.
- **Aviso al admin antes de cancelar:** `resumen_cancelacion` calcula cuántas compras afecta y cuánto crédito se
  acredita; Angular lo muestra en el `confirm()`. Quitar días de una serie en `modificar_funciones` pasa por la misma
  lógica (`desactivar_funcion`) y pide la misma confirmación.
- **Una función con entradas vendidas no se puede mover ni cambiar** (día, hora, película, formato o idioma): hay que
  cancelarla y crear otra. Solo se puede cambiar el precio base. Lo hace cumplir `validar_cambio_con_ventas`.
- **Quién canceló:** `compras.cancelada_motivo` es `cliente` o `cine`, y "Mis compras" lo muestra distinto.
- **Preventa:** ver 6.1 y 6.20. El cálculo del precio vigente sigue duplicado (Angular y SQL).

### 6.20 Funciones desde el estreno y preventa por función

| Función | Antes de `estreno − días` | Entre `estreno − días` y el estreno | Desde el estreno |
|---------|---------------------------|-------------------------------------|------------------|
| Con preventa | no se vende | **precio de preventa** | precio base |
| Sin preventa | no se vende | no se vende | precio base |

- **Funciones solo desde el estreno:** `validar_funcion_pelicula` (llamada por `colocar_funcion`) rechaza una función
  anterior al estreno y también marcar `con_preventa` en una película sin preventa configurada. Como `crear_funciones` y
  `modificar_funciones` pasan por `colocar_funcion`, la regla no se puede saltear.
- **Postergar el estreno:** un trigger en `peliculas` cancela (con `desactivar_funcion`, o sea con compensación) las
  funciones activas que queden antes de la nueva fecha. Antes de guardar, `resumen_postergar_estreno` le muestra al
  admin cuántas son y a quién afecta, para que no se cancelen entradas vendidas sin que lo decida.
- **Datos viejos:** la migración marcó `con_preventa` en las funciones existentes de películas con preventa y canceló,
  con compensación, las funciones que estaban antes del estreno.
- **Qué muestra el cliente:** el detalle de la película indica "Preventa" y el precio en las funciones marcadas, y
  "Venta desde el …" en las que todavía no abrieron (`precio-funcion.ts`, la misma regla que `reservar_butacas`).

### 6.21 Catálogo del candy: productos y categorías

- **Sin stock.** Un producto solo está activo o inactivo; el candy no se agota en el modelo.
- **Imagen obligatoria, garantizada por la base:** `productos.imagen_url` es `not null` y no puede ser vacía. El
  formulario también lo avisa en "Falta completar". Al modificar alcanza con la imagen que ya tenía. Las imágenes
  nuevas van al bucket `imagenes`, carpeta `productos/` (`utilidades/subir-imagen.ts`, que también usan las películas).
- **Categorías activas/inactivas:** desactivar una categoría oculta al cliente todos sus productos sin tocarlos (ej.:
  "Helados" en invierno). Un producto se muestra solo si él **y** su categoría están activos; eso lo resuelve
  `ProductoService.getCatalogoActivo()`, que usará la compra del candy.
- **Borrado protegido:** `productos.categoria_id` es `on delete restrict`. La base no deja eliminar una categoría con
  productos y la pantalla lo traduce a "Desactivala en lugar de eliminarla".
- **Orden editable:** categorías y productos llevan una columna `orden` (entero, 0 o mayor) y se listan por orden y
  después por nombre. El nombre de la categoría es único (sin mayúsculas) y el del producto, único dentro de su categoría.
- **Datos de ejemplo:** el script carga Pochoclos, Bebidas y Golosinas y 8 productos con ilustraciones propias
  (`public/productos/*.svg`, con la paleta del cine). Cumplen la regla de imagen obligatoria sin pasar por Storage y
  el admin las puede reemplazar al modificar cada producto.
- **Pantallas** (`/admin/productos`): listado agrupado por categoría con buscador (pipe `filtrar`), alta y modificación
  (`/crear`) y administración de categorías (`/categorias`). El esqueleto `cliente/candy` es el paso de candy de la
  compra (ver 6.22).

### 6.22 Candy en la compra

- **Siempre con entrada.** El candy es un paso opcional dentro de la compra de entradas: una sola compra, un solo
  código y un solo QR. La entrada y el candy se validan por separado y una vez cada uno.
- **Flujo:** butacas → candy (opcional; si no hay productos activos se salta) → resumen y pago → confirmación.
  **La reserva de 5 minutos empieza al pasar de las butacas al candy**: las butacas quedan tomadas en tiempo real y el
  contador corre a la vista en el paso del candy.
- **Volver atrás sin perder lo elegido.** Desde el resumen se puede "Cambiar candy" (vuelve al paso del candy sobre la
  misma reserva, sin perder tiempo) o "Cambiar butacas" (libera la reserva y vuelve al mapa). Si el cliente ya eligió
  candy y solo cambia las butacas, **no se le vuelve a pedir**: el candy se carga solo a la reserva nueva (a menos que
  después toque "Cambiar candy"). Durante el paso del candy no se pueden cambiar los canjes de las entradas, porque se
  fijaron al reservar.
- **Funciones SQL.** `reservar_butacas` reserva solo butacas. `definir_candy_compra(compra, productos, usar_credito)`
  reemplaza los productos de una reserva vigente (`[{producto_id, cantidad, cantidad_con_puntos}]`) y recalcula
  subtotal, cupón, puntos, crédito y total, sin tocar el vencimiento. Usa `validar_candy` (producto y categoría
  activos, cantidad entre 1 y `max_unidades_candy`, canje solo con cuenta y costo en puntos) y `guardar_candy`. Todo en
  una transacción: si algo falla, no queda nada a medias.
- **Cupón y crédito sobre toda la compra.** El subtotal es entradas + candy; el cupón se aplica sobre el total y el
  crédito cubre hasta el total.
- **Canje por producto.** Cada producto tiene su `costo_puntos`. Al comprar, algunas unidades se pagan con puntos y el
  resto en dinero (en `compra_items` van en filas aparte: `precio_unitario = 0` y `puntos_unitarios > 0`). Los
  puntos de entradas y productos se suman en `compras.puntos_usados` y se descuentan al confirmar el pago, igual que antes.
- **Puntos ganados:** 1 por peso pagado en dinero; ahora el candy también cuenta.
- **Cancelación.** `compensar_compra` no cambió: devuelve el total (candy incluido) como crédito y devuelve los puntos
  canjeados. Si el candy ya se entregó, `cancelar_compra` no deja cancelar.
- **Recaudado por función sin candy.** `compras.candy_subtotal` y `candy_descuento` guardan la parte del candy, así que
  la pantalla de ventas por función muestra "Recaudado en entradas" restando esa parte. El reporte general (S9)
  decidirá cómo mostrar el candy.
- **Dónde se ve:** el resumen y el pago, "Mis compras" y "Mi entrada", el PDF (el ticket crece si hay productos) y la
  pantalla del empleado de candy, que lista qué entregar.

### 6.23 Combos

- **Qué es.** Un precio fijo por N entradas (configurable: 1, 2...) más unos productos. El admin los crea en
  `/admin/combos` con **imagen obligatoria**, orden, activo y **destacado**. Sin fechas de vigencia: se activan y
  desactivan a mano. `guardar_combo` crea o modifica el combo **y** sus productos en una sola transacción y exige al
  menos un producto, sin repetir.
- **Precio.** El precio del combo **reemplaza** el valor de las entradas que incluye (al precio vigente de la función,
  preventa incluida; se guarda en `compras.precio_entrada`) y el de sus productos. Subtotal = butacas − valor de las
  entradas cubiertas + precio de los combos + productos sueltos. El **recargo VIP** de cada butaca se paga aparte.
- **Con qué se combina.** El cupón vale sobre toda la compra, combos incluidos. El combo **no** se paga con puntos. Un
  combo cubre butacas que no estén pagadas con puntos: `definir_candy_compra` rechaza combos que cubran más entradas
  que las butacas libres, y la pantalla desactiva el "+" y el canje de una entrada cuando no queda ninguna libre.
- **Dónde se elige.** En el paso del candy, sobre la reserva ya hecha. Los combos van arriba (destacados primero), con
  lo que incluyen y el cartel **"Ahorrás $X"**: se calcula contra el precio de la entrada de esa función y **no
  aparece si el precio del combo es mayor al valor suelto**. Si el cliente cambia las butacas y quedan menos que las
  que cubrían sus combos, se sacan combos hasta que entren y se le avisa.
- **Aviso al admin.** Si el precio del combo supera el valor de lo que incluye (usando la función futura más barata
  como referencia para las entradas), el formulario muestra una advertencia pero **deja guardar**.
- **Disponibilidad.** El cliente solo ve combos activos con **todos** sus productos (y categorías) activos. La base lo
  vuelve a controlar al reservar (`validar_combos`). Un producto que está en un combo no se puede eliminar (clave
  foránea `restrict`): se lo desactiva.
- **Para el reporte.** De lo que se paga por un combo, el valor de las entradas cuenta como entradas y lo que sobra
  como candy (`compras.candy_subtotal`), así "Recaudado en entradas" por función sigue siendo solo de la película.
- **Entrega.** Los productos del combo se guardan en `compra_items` con precio 0 y el nombre del combo, así el empleado
  de candy ve **todo lo que tiene que entregar**; los combos vendidos van en `compra_combos` y se muestran en Mis
  compras, Mi entrada, el PDF y la pantalla del empleado.
- **Cancelación.** Sin cambios: `compensar_compra` devuelve el total (combos incluidos) como crédito.

### 6.24 Reseñas y "Mis películas"

- **Quién reseña.** Solo quien **vio** la película: una compra pagada (no cancelada) de una función que **ya empezó**
  (`puede_resenar`). No se exige haber validado el QR en la puerta. La regla la hace cumplir la base:
  `guardar_resenia` rechaza a quien no la vio, y cada persona escribe solo la suya (usa `auth.uid()`).
- **Una por persona.** `unique (pelicula_id, usuario_id)`: si vuelve a calificar, `guardar_resenia` hace un
  *upsert* y modifica la suya. También la puede borrar (`eliminar_resenia`). **Sin moderación.**
- **Datos.** De 1 a 5 estrellas (`check`) y comentario opcional de hasta 300 caracteres (`check`, y contador en pantalla).
- **Promedio.** La vista `peliculas_puntuacion` calcula promedio (un decimal) y cantidad. Se muestra en el detalle y en
  cada tarjeta de la cartelera ("★ 4,3 (12)" o "Sin reseñas"), con el pipe `puntuacion` (coma decimal).
- **Estrellas hechas a mano.** El componente `app-estrellas` tiene dos modos: mostrar (relleno parcial con CSS, sin
  librerías) y elegir (cinco botones con `role="radio"`, usables con teclado y con `aria-label`).
- **En el detalle de la película** (`app-resenias-pelicula`): promedio, tu reseña (formulario con "Falta completar"),
  y las de los demás, 5 a la vez con "Ver más". Cada reseña muestra el autor como nombre + inicial del apellido.
- **"Mis películas"** (pestaña del perfil): `mis_peliculas()` devuelve una fila por película vista, con la última
  función que vio y su reseña si la hizo. Se puede filtrar por Todas / Con reseña / Sin reseñar, ir al detalle para
  dejar o editar la reseña y eliminarla desde ahí mismo.
- **Aviso al salir.** La ruta del detalle usa `canDeactivate`: el detalle le pregunta a la sección de reseñas
  (`puedeSalir`) si hay una reseña sin guardar (estrellas tocadas o comentario escrito) y pide confirmación.
- **Funciones por día.** El detalle ya no muestra todos los días a la vez: hay un chip por cada día que tiene funciones
  (una fila que se desliza si son muchos) y debajo se ven solo las funciones del día elegido. Es un solo día a la vez;
  por defecto el primero. Los chips son botones propios con `aria-pressed` (Angular Material queda limitado al
  formulario de funciones).

### 6.25 Próximamente, alertas de estreno y filtros del buscador

- **Qué es "próxima".** Una película activa con **estreno futuro** cuya venta **todavía no abrió** (ninguna función está
  en preventa). Es la misma regla de precio de `reservar_butacas`: desde el estreno se vende todo y, antes, solo las
  funciones marcadas "con preventa" cuando ya rige la preventa (`utilidades/proximamente.ts`, que reutiliza
  `getPeliculasEnPreventa`). Cuando abre la venta, la película **pasa sola a la cartelera**; el admin las ve siempre todas.
- **Dónde se ve.** Sección "Próximamente" debajo de la cartelera: tarjetas con el día de estreno y el botón
  "Avisarme". El detalle de una película próxima es el normal (con sus funciones como "Venta desde...") más el aviso
  de estreno y el mismo botón.
- **La alerta.** `alertas_estreno` guarda una por persona y película. `activar_alerta` solo la acepta si la película
  sigue sin venta; `quitar_alerta` la borra. Hace falta cuenta, porque el aviso llega a **Mi perfil > Notificaciones**.
- **Quién dispara el aviso.** El sistema no tiene tareas programadas (decisión del equipo), así que el aviso se genera
  **cuando la persona entra a la app**: la cartelera y el perfil llaman a `revisar_alertas()`, que busca las alertas
  pendientes de esa cuenta cuya venta ya abrió (`pelicula_con_venta_abierta`), crea la notificación de tipo `estreno`
  (con un enlace a la película) y marca la alerta como avisada. Cada alerta avisa **una sola vez**, aunque se revise
  desde dos pantallas a la vez (`update ... where not avisada`).
- **Filtros de idioma y formato.** Vuelven al buscador: las opciones salen de las funciones futuras activas
  (`getOfertaPorPelicula`), no están fijas, y cada película se filtra por los idiomas y formatos de sus funciones con
  el pipe `filtrar`.

### 6.26 Reporte de facturación y exportación

- **Pantalla** `/admin/reportes`: período (Desde y Hasta, con atajos "Últimos 7 días", "Últimos 30 días" y "Este mes"),
  resumen del período, tabla por día con fila de totales y botones para exportar. **No hay rango máximo.**
- **Una sola función SQL** (`reporte_facturacion`), solo para el admin, que devuelve una fila por día **con
  movimiento** (los días sin ventas ni cancelaciones no aparecen), en hora argentina.
- **Cuándo cuenta una compra.** Como **venta**, el día en que se pagó (`pagada_at`). Una reserva que nunca se pagó no
  cuenta. Una compra pagada y después cancelada (por el cliente o por el cine) cuenta como **cancelación** el día en
  que se canceló (`cancelada_at`), por su total original, que se devolvió como crédito. **Neto = ventas − cancelado.**
- **Crédito.** El crédito usado como medio de pago no es dinero nuevo: se muestra **aparte** y
  *Cobrado en dinero = ventas totales − crédito usado*. Las entradas canjeadas con puntos cuentan como vendidas pero se
  informan en su propia columna.
- **Candy.** Entradas y candy van en columnas separadas, con la parte del candy que guarda cada compra
  (`candy_subtotal − candy_descuento`); el valor de las entradas de los combos cuenta como entradas.
- **Un solo lugar para las columnas.** `utilidades/reporte.ts` define las columnas, los totales y los formatos, y los
  usan la tabla, el PDF y el Excel, así los tres dicen siempre lo mismo.
- **PDF** (`jsPDF`, hoja A4 horizontal): título, período, tabla con el encabezado repetido en cada hoja y fila de
  totales. Montos en formato argentino (12.500,50).
- **Excel** (`write-excel-file`, versión `universal`): un `.xlsx` real con encabezados en negrita, fechas y montos como
  números con formato (Excel los muestra según el idioma de la computadora) y fila de totales. Se usa la versión
  `universal`, que devuelve un `Blob`, en lugar de la de navegador (que usa Web Workers), y el archivo se baja con la
  misma función que el PDF. Las dos librerías se cargan con importación dinámica al tocar el botón.

### 6.27 Gráficos

- **Pantalla** `/admin/graficos`: tres gráficos de barras horizontales (películas más vistas, productos más vendidos y
  combos más vendidos), cada uno con el **Top 5**. Se mira por **Semana** (de lunes a domingo) o por **Mes**, con
  flechas anterior/siguiente y un botón "Hoy". Arranca en la semana actual.
- **Qué se cuenta.** Solo compras **pagadas y no canceladas**. El período se mide por **el día de la función** (hora
  argentina): las entradas vendidas de las funciones que caen en la semana o el mes elegido. Los productos y los combos
  se miden igual, para que los tres gráficos hablen del mismo período.
- **Productos y combos por separado.** El gráfico de productos cuenta los sueltos (lo pagado en dinero y lo canjeado con
  puntos) **sin** los que vienen dentro de un combo (`compra_items.combo_nombre is null`); los combos tienen su propio
  ranking (`compra_combos`). Se agrupan por el nombre que tenían al comprar, así el histórico no cambia si se los renombra.
- **Tres funciones SQL** (`ranking_peliculas`, `ranking_productos`, `ranking_combos`), solo para el admin, que reciben el
  rango de fechas. Si dos tienen la misma cantidad, se ordenan por nombre.
- **Chart.js.** El componente `grafico-barras` carga la librería con importación dinámica solo cuando hay algo para
  dibujar y registra únicamente lo necesario. Los colores salen de las variables del tema (`--bordo`, `--rojo`,
  `--mostaza`).
- **Accesibilidad.** El canvas no lo leen los lectores de pantalla, así que lleva una descripción en texto
  (`aria-label`) y, debajo de cada gráfico, **la misma información en una tabla**. Los botones de período se usan con
  teclado y las flechas tienen etiqueta. Si un período no tiene ventas, se dice "Sin ventas en este período".
- **Consultas que se pisan.** Si se cambia de período mientras se está cargando, solo vale la última consulta.

### 6.28 Log de actividad

- **Qué se registra.** Solo lo que hacen el **admin y los empleados**; las acciones del cliente (compras, cancelaciones,
  reseñas, su perfil) no entran.
  - Admin: crear, modificar, eliminar, activar y desactivar películas, salas, productos, categorías, combos (y los
    productos de cada combo), cupones, costos de canje de puntos y configuración; crear, modificar y cancelar
    funciones; cambiar el rol de una cuenta (asignar o quitar empleados).
  - Empleados: cada entrada validada y cada entrega de candy, con el código de la compra.
- **Triggers en la base.** La base escribe el log sola, así no se puede saltear desde la aplicación ni hay que acordarse
  de registrarlo en cada pantalla. Un trigger genérico (`log_registrar_cambio`) sirve a ocho tablas: compara la fila
  vieja con la nueva (`log_diferencias`) y guarda solo los campos que cambiaron, con su **antes y después**. Hay uno
  propio para funciones, otro para los productos de un combo, otro para los roles y otro para las validaciones.
- **Una acción, un renglón.** Crear una serie de funciones es un solo clic del admin, pero la base la escribe función
  por función. `log_agrupar` las junta en **un renglón por transacción y por película** ("Creó 8 funciones de ...") con
  la lista adentro; la columna `lote` guarda el número de transacción (`txid_current()`) y un índice único parcial
  garantiza que haya una sola fila por lote. Lo mismo para los productos de un combo. Para que esto registre solo lo
  que cambió, `guardar_combo` ya no borra y vuelve a crear todos los productos: borra los que se sacaron y agrega o
  actualiza los demás.
- **Quién queda registrado.** El usuario de la sesión (`auth.uid()`), con su nombre y rol **guardados al momento**,
  así el log se entiende aunque después cambien. Sin sesión (un script en el editor SQL) o con una cuenta de cliente
  no se registra nada. **Excepción:** un cambio de rol se registra siempre, para que se vea si alguien se lo cambia sin
  ser admin. Las validaciones se registran a nombre del empleado que las hizo.
- **Pantalla** `/admin/log`: filtros por usuario (solo los que tienen actividad, vista `log_usuarios`), acción,
  elemento y rango de fechas (por defecto, la última semana); 50 renglones por vez con "Cargar más"; cada renglón se
  despliega y muestra el detalle (campo / antes / después, los datos, la lista de funciones o los cambios de productos),
  con nombres y valores legibles (pesos, Sí/No, fechas en hora argentina, roles).
- **Retención.** Se conserva todo; no hay borrado automático (no hay tareas programadas).
- **Limitación conocida.** Como el resto del sistema, la tabla no tiene RLS: la pantalla es solo para el admin, pero
  los datos se podrían leer con la clave pública. Se corrige en la sesión S15 (activar RLS), donde además las
  funciones de los triggers tendrán que ejecutarse con permisos propios.

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
  **Está programado activarla en todas las tablas al terminar el resto de la hoja de ruta** (sesión S15 de
  `docs/HOJA_DE_RUTA.md`): hasta entonces hay que tomarla como una limitación conocida.
- La clave pública de Supabase está en `src/environments/environment.ts`. Es una clave pensada para navegadores,
  pero por lo anterior conviene no publicar el proyecto de Supabase con datos reales.

---

## 10. Limitaciones y decisiones abiertas

**Pendiente de implementar** (detalle en las tablas de la sección 3): ajustes finales de estilo y accesibilidad, verificación de la PWA y cierre de la entrega.
La PWA y el despliegue están armados y falta verificarlos.

**PWA y despliegue (armados, falta verificar)**
- Hosting en **Firebase Hosting**. `firebase.json` publica `dist/tp1/browser` (la salida de `ng build`, no la carpeta
  `public/`, que son los assets de Angular) y redirige toda ruta a `index.html` para que funcione el router de la SPA.
- PWA con **`@angular/pwa`**: service worker de Angular (`ngsw-config.json`), solo activo en el build de producción.
  Cachea los archivos de la app, no las llamadas a Supabase, así los datos de funciones y butacas nunca quedan viejos.
- `ngsw-worker.js`, `ngsw.json` e `index.html` se sirven con `Cache-Control: no-cache` para que cada deploy llegue a
  los usuarios. Si el navegador los guardara, se quedaría con la versión anterior de la app.
- `@angular/service-worker` tiene que tener la misma versión que `@angular/core`, porque pide una versión exacta.

**Limitaciones conocidas**
- El plano de butacas está duplicado en `sala-plantilla.ts` y en el SQL de la tabla `butacas`.
- La regla de precio vigente está en Angular y en SQL (ver 6.14).
- El cliente solo llega a la selección de butacas desde el detalle de la película.
- No hay pruebas automáticas propias todavía.

**Decisiones a revisar antes de la entrega**
- Las alertas de "Próximamente" se verán en Mi perfil → Notificaciones (el sistema no envía mails, ver RF-48); falta definir qué evento las dispara.
