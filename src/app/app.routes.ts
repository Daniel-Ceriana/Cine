import { Routes } from '@angular/router';



export const routes: Routes = [
    {path:'', redirectTo: '/register', pathMatch: 'full'},
    {path:'register', loadComponent: () => import('./componentes/compartido/register/register').then(m => m.Register)},
    {path:'login', loadComponent: () => import('./componentes/compartido/login/login').then(m => m.Login)},
    {path:'**', redirectTo: '/register'}
];
