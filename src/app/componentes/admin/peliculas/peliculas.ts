import { Component } from '@angular/core';
import { MenuCrearVer } from '../generico/menu-crear-ver/menu-crear-ver';
import { ListadoPeliculas } from '../../compartido/listado-peliculas/listado-peliculas';

@Component({
  imports: [MenuCrearVer, ListadoPeliculas],
  selector: 'app-peliculas',
  styleUrl: './peliculas.css',
  templateUrl: './peliculas.html',
})
export class Peliculas {}
