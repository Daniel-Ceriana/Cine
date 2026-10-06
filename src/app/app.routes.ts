import { Routes } from '@angular/router';
import { clienteMatch, invitadoMatch, rolMatch, sesionMatch } from './guards/auth-guard';
import { confirmarSalidaGuard } from './guards/salida-guard';



export const routes: Routes = [

    
{ path: '', redirectTo: '/home', pathMatch: 'full' },
{
  path: 'home',
  canMatch: [clienteMatch],
  loadComponent: () => import('./componentes/cliente/home-cliente/home-cliente').then(m => m.HomeCliente),
},
{
  path: 'peliculas/:id',
  canMatch: [clienteMatch],
  loadComponent: () => import('./componentes/cliente/detalle-pelicula/detalle-pelicula').then(m => m.DetallePelicula),
},
{
  path: 'perfil',
  canMatch: [sesionMatch],
  loadComponent: () => import('./componentes/cliente/perfil/perfil').then(m => m.Perfil),
},
// Quien compró sin cuenta recupera su entrada con código + email
{
  path: 'mi-entrada',
  canMatch: [clienteMatch],
  canDeactivate: [confirmarSalidaGuard],
  loadComponent: () => import('./componentes/cliente/mi-entrada/mi-entrada').then(m => m.MiEntrada),
},
{
  path: 'funcion/:id/butacas',
  canMatch: [clienteMatch],
  canDeactivate: [confirmarSalidaGuard],
  loadComponent: () => import('./componentes/cliente/seleccion-butacas/seleccion-butacas').then(m => m.SeleccionButacas),
},
// Pantallas del personal: validan entradas y candy ingresando el código a mano.
// La misma pantalla sirve para las dos secciones; `data.seccion` indica cuál es.
{
  path: 'entradas',
  canMatch: [rolMatch],
  data: { roles: ['empleado_entradas', 'admin'], seccion: 'entrada' },
  loadComponent: () => import('./componentes/empleado/validar-codigo/validar-codigo').then(m => m.ValidarCodigo),
},
{
  path: 'candy',
  canMatch: [rolMatch],
  data: { roles: ['empleado_candy', 'admin'], seccion: 'candy' },
  loadComponent: () => import('./componentes/empleado/validar-codigo/validar-codigo').then(m => m.ValidarCodigo),
},
    {
  path: 'admin',
  canMatch: [rolMatch],
  data: { roles: ['admin'] },
  children: [
    { path: '', redirectTo: 'homeadmin', pathMatch: 'full' },
    { path:'homeadmin',loadComponent:()=>import('./componentes/admin/menu-admin/menu-admin').then(m=>m.MenuAdmin)},
    {
      path: 'funciones',
      children: [
        { path: '', loadComponent: () => import('./componentes/admin/funciones/funciones').then(m => m.Funciones) },
        { path: 'crear', canDeactivate: [confirmarSalidaGuard], loadComponent: () => import('./componentes/admin/funciones/crear-modificar/crear-modificar').then(m => m.CrearModificarFuncion) },
        { path: ':id/butacas', loadComponent: () => import('./componentes/admin/funciones/butacas-funcion/butacas-funcion').then(m => m.ButacasFuncion) },
      ],
    },
    { path: 'empleados', loadComponent: () => import('./componentes/admin/empleados/empleados').then(m => m.Empleados) },
    {
      path: 'salas',
      children: [
        { path: '', loadComponent: () => import('./componentes/admin/salas/salas').then(m => m.Salas) },
        { path: 'crear', canDeactivate: [confirmarSalidaGuard], loadComponent: () => import('./componentes/admin/salas/crear-modificar/crear-modificar').then(m => m.CrearModificarSala) },
      ],
    },
    {
      path: 'peliculas',
      children: [
        { path: '', loadComponent: () => import('./componentes/admin/peliculas/peliculas').then(m => m.Peliculas) },
        { path: 'crear', canDeactivate: [confirmarSalidaGuard], loadComponent: () => import('./componentes/admin/peliculas/crear-modificar/crear-modificar').then(m => m.CrearModificar) },
      ],
    },
    { path: 'productos', loadComponent: () => import('./componentes/admin/productos/productos').then(m => m.Productos) },
    { path: 'puntos', loadComponent: () => import('./componentes/admin/puntos/puntos').then(m => m.Puntos) },
    { path: 'configuracion', loadComponent: () => import('./componentes/admin/configuracion/configuracion').then(m => m.Configuracion) },
    { path: 'cupones', canDeactivate: [confirmarSalidaGuard], loadComponent: () => import('./componentes/admin/cupones/cupones').then(m => m.Cupones) },
  ],
},
    
{
  path: 'register',
  canMatch: [invitadoMatch],
  canDeactivate: [confirmarSalidaGuard],
  loadComponent: () => import('./componentes/compartido/register/register').then(m => m.Register),
},
{
  path: 'login',
  canMatch: [invitadoMatch],
  canDeactivate: [confirmarSalidaGuard],
  loadComponent: () => import('./componentes/compartido/login/login').then(m => m.Login),
},
{
  path: 'no-autorizado',
  loadComponent: () => import('./componentes/compartido/no-autorizado/no-autorizado').then(m => m.NoAutorizado),
},
{ path: 'logout', loadComponent: () => import('./componentes/compartido/logout/logout').then(m => m.Logout) },

{ path: '**', redirectTo: '/home' },
];
