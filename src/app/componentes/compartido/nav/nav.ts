import { Component,input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavRoute } from '../../../interfaces/nav-route';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-nav',
  styleUrl: './nav.css',
  templateUrl: './nav.html',
})
export class Nav {
    //   url: string;   
    // nombre: string; 

  rutas = input<NavRoute[]>([
    {url:'/home',nombre:'Home'},
    {url:'/login',nombre:'Login'},
    {url:'/register',nombre:'Registrar'}
  ]);



}
