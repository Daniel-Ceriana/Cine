import { Routes } from '@angular/router';



export const routes: Routes = [
    {path:'',redirectTo:'/home', pathMatch: 'full'},
    //home cliente
    {path:'home',loadComponent:()=>import('./componentes/cliente/home-cliente/home-cliente').then(m=>m.HomeCliente)},
    {path:'homeadmin',loadComponent:()=>import('./componentes/admin/menu-admin/menu-admin').then(m=>m.MenuAdmin)},
    {path:'register', loadComponent: () => import('./componentes/compartido/register/register').then(m => m.Register)},
    {path:'login', loadComponent: () => import('./componentes/compartido/login/login').then(m => m.Login)},
    {path:'**', redirectTo: '/register'}
];
