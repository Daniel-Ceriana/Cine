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
| RF-05 | En la página principal se muestran primero las **3 películas más vendidas**. | 2 | Pendiente |
| RF-06 | Las películas pueden tener restricción de edad: sin restricción, +13 o +18. | 6 | Hecho |
| RF-07 | Sección "Próximamente" con las películas que se estrenan en las próximas semanas. | 9 | Pendiente |
| RF-08 | El usuario puede activar una alerta para que le avisen cuando abra la venta de una película próxima. | 9 | Pendiente |
| RF-09 | Reseñas: calificación con estrellas y comentario corto, visibles **antes** de comprar. | 2 | Pendiente |
| RF-10 | Se muestra la puntuación promedio de cada película. | 2 | Pendiente |
| RF-11 | Sección "Mis películas": historial visual de lo que vio el usuario (póster, fecha, su calificación). | 9 | Pendiente |
| RF-12 | Detalle de película con sus próximas funciones, agrupadas por día, con precio y acceso a la compra. | 1 | Hecho |

### 3.2 Salas y funciones

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-20 | El cine es un solo edificio con varias salas; el admin las crea y modifica. | 1, 5 | Hecho |
| RF-21 | Cada sala tiene un tipo de proyección: 2D, 3D, 4D o 5D. | 1 | Hecho |
| RF-22 | Cada función define película, sala, día y horario, e idioma (castellano o subtitulada). | 1 | Hecho |
| RF-23 | No puede haber una función antes de que pase **media hora** de que terminó la anterior en esa sala. | 1 | Hecho |
| RF-24 | La asignación de sala es **automática** y bajo ningún término dos funciones coinciden en la misma sala al mismo tiempo. | 5 | Hecho |
| RF-25 | El admin puede programar una película para varios días de la semana a la misma hora (ej.: lunes, martes y viernes a las 18 h). | 5 | Hecho |
| RF-26 | Preventa: abrir la venta antes del estreno con un **precio especial**, que vuelve al normal al pasar la fecha. Configurable película por película. | 9 | Parcial |

> RF-26: el precio y los días de preventa se configuran por función y la regla ya se aplica al vender.
> Falta la opción de configurarlos una sola vez por película.

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
| RF-39 | El usuario puede cancelar hasta 2 horas antes de la función. No se devuelve dinero: se acredita **crédito** en su cuenta, usable junto con otros medios de pago. | 10 | Pendiente |

> RF-62: la entrada ya funciona con un solo uso. El candy también, pero recién se podrá probar de punta a punta
> cuando la compra incluya productos (RF-51).

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
| RF-46 | Canje de puntos por entradas gratis o productos del candy. El admin configura cuántos puntos cuesta cada recompensa. | 8 | Parcial |
| RF-47 | El perfil muestra los puntos acumulados, el historial de canjes y el crédito. Los puntos no se transfieren. | 8, 10 | Parcial |

> RF-46: se pueden canjear **entradas**; los productos del candy se suman cuando exista el candy (RF-50 a 52).
> RF-47: están los puntos, el historial de canjes y las notificaciones; el **crédito** se muestra pero todavía no se
> acredita (depende de la cancelación, RF-39).

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-48 | Los avisos al usuario (por ejemplo "estrenos" o compras) se ven en **Mi perfil → Notificaciones**. El sistema **no envía mails**. | 9 (aclaración) | Parcial |

> RF-48: hoy se avisa cuando se confirma una compra y cuando se hace un canje. Las alertas de estreno (RF-08) y el
> aviso de función cancelada usarán el mismo mecanismo cuando se implementen.

### 3.5 Candy bar

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-50 | El admin crea productos (pochoclos, bebidas, etc.) y los ordena en categorías. | 4 | Pendiente |
| RF-51 | Los productos se compran **junto con la entrada** y se retiran con el mismo QR. | 4 | Pendiente |
| RF-52 | Combos (entrada + pochoclos + bebida) a precio fijo, configurables por el admin y destacados en la compra. | 8 | Pendiente |

### 3.6 Validación en el cine

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-60 | Los empleados validan entradas y candy con el código de la compra (cine y candy). | 5 | Hecho |
| RF-61 | Se puede ingresar el código a mano (no hay lector de QR real: solo se genera el QR). | 5 | Hecho |
| RF-62 | Una vez validada la entrada o entregada la comida, el QR **deja de funcionar** (la entrada y el candy se validan por separado). | 5 | Parcial |

### 3.7 Administración, reportes y auditoría

| ID | Requerimiento | Origen | Estado |
|----|---------------|--------|--------|
| RF-70 | Usuario admin que controla salas, funciones, distribución de butacas, productos, etc. | 5 | Parcial |
| RF-71 | Gestión de empleados (usuarios que validan QR). | 5 | Hecho |
| RF-72 | Reporte de facturación por día y de cantidad de entradas vendidas. | 7 | Pendiente |
| RF-73 | Exportar el reporte de facturación a PDF y a Excel. | 10 | Pendiente |
| RF-74 | Gráfico de películas más vistas por semana y por mes, y producto del candy más vendido. | 10 | Pendiente |
| RF-75 | Log de actividad: quién creó una función, quién modificó un precio, quién validó un QR, con fecha y hora. | 10 | Pendiente |
| RF-76 | Mapa del cine que indique la sala de la entrada comprada. | 4 | Fuera de alcance (el cliente aún no dio "luz verde") |

> RF-70: el admin ya gestiona películas, salas y funciones. La distribución de butacas es la misma en todas las
> salas y se modifica desde el código (decisión acordada). Faltan productos, cupones y empleados.

---

## 4. Requerimientos no funcionales y de la consigna

| ID | Requerimiento | Estado |
|----|---------------|--------|
| RNF-01 | Interfaces fáciles de navegar y entender, tanto para clientes como para empleados. | Parcial |
| RNF-02 | Nada de selectores de fecha y hora engorrosos ni demasiado scroll. | Parcial |
| RNF-03 | Estilo visual **único y producido**. | Hecho (falta aplicarlo a las pantallas nuevas) |
| RNF-04 | Uso correcto de Angular, buenas prácticas y técnicas vistas en clase. | En curso |
| RNF-05 | Integración con **Supabase**. | Hecho |
| RNF-06 | Integración de **PWA**. | Pendiente |
| RNF-07 | Aplicación **desplegada** con URL funcional. | Pendiente |
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

**Precios**
7. La preventa rige desde `fecha de estreno − días de preventa` hasta el estreno. Antes de eso no se vende; desde el
   estreno, precio normal.
8. Las butacas VIP suman un **recargo global** configurable por el admin. Las accesibles cuestan lo mismo que las comunes.
9. El precio se guarda tal como se cobró en cada entrada: cambios posteriores no alteran compras anteriores.

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
