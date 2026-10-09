# Picture House

Sistema de venta de entradas para un cine: cartelera, selección de butacas en tiempo real, compra de entradas y candy,
puntos y crédito, validación de entradas por código QR y panel de administración con reportes y gráficos.
PWA hecha con **Angular 22** y **Supabase** (autenticación, PostgreSQL con RLS, almacenamiento y tiempo real).

> Este README se está rehaciendo como presentación del proyecto (pruebas automáticas, CI y escáner de QR en camino).

## Cómo correrlo

```bash
npm install
# Crear un proyecto de Supabase, poner la URL y la clave pública en src/environments/environment.ts
# y ejecutar en orden los scripts de supabase/ (000 a 019) en el SQL Editor.
ng serve        # http://localhost:4200
```

El paso a paso completo (cuentas, roles, despliegue en Firebase Hosting) está en
[`docs-tp/README-TP.md`](docs-tp/README-TP.md).

## Alcance del TP de la facultad

El proyecto nació como Trabajo Práctico de **Programación IV (UTN FRA, 2026 C2)**. Ese alcance quedó documentado aparte y
se conserva tal cual:

- [`docs-tp/REQUERIMIENTOS.md`](docs-tp/REQUERIMIENTOS.md): requerimientos del cliente, reglas de negocio y estado de cada punto.
- [`docs-tp/README-TP.md`](docs-tp/README-TP.md): arquitectura, decisiones técnicas, base de datos, seguridad (RLS) y despliegue.
- [`docs-tp/Requerimientos.odt`](docs-tp/Requerimientos.odt): documento original de requerimientos.

Autor: Daniel Ceriana
