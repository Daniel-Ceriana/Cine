import { Routes } from '@angular/router';



export const routes: Routes = [
    {path:'',redirectTo:'/home', pathMatch: 'full'},
    //home cliente
    {path:'home',loadComponent:()=>import('./componentes/cliente/home-cliente/home-cliente').then(m=>m.HomeCliente)},

    //cambiar path a home cuando tenga los guards activos, asi el canMatch pasa del anterior a este
    //en caso de admin o de algun empleado
    {path:'homeadmin',loadComponent:()=>import('./componentes/admin/menu-admin/menu-admin').then(m=>m.MenuAdmin)},
    {path: 'admin', redirectTo:'homeadmin'},

    { path: 'admin/funciones', loadComponent: () => import('./componentes/admin/funciones/funciones').then(m => m.Funciones) },
    { path: 'admin/empleados', loadComponent: () => import('./componentes/admin/empleados/empleados').then(m => m.Empleados) },
    { path: 'admin/salas', loadComponent: () => import('./componentes/admin/salas/salas').then(m => m.Salas) },
    { path: 'admin/peliculas', loadComponent: () => import('./componentes/admin/peliculas/peliculas').then(m => m.Peliculas)},
    { path: 'admin/peliculas/crear',loadComponent: () => import('./componentes/admin/peliculas/crear-modificar/crear-modificar').then(m => m.CrearModificar)},
    { path: 'admin/productos', loadComponent: () => import('./componentes/admin/productos/productos').then(m => m.Productos) },
    { path: 'admin/cupones', loadComponent: () => import('./componentes/admin/cupones/cupones').then(m => m.Cupones) },
    
    
    {path:'register', loadComponent: () => import('./componentes/compartido/register/register').then(m => m.Register)},
    {path:'login', loadComponent: () => import('./componentes/compartido/login/login').then(m => m.Login)},
    // {path:'**', redirectTo: '/register'}
];
