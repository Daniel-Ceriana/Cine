import { Component } from '@angular/core';
import { MenuCrearVer } from '../generico/menu-crear-ver/menu-crear-ver';

@Component({
  imports: [MenuCrearVer],
  selector: 'app-peliculas',
  styleUrl: './peliculas.css',
  templateUrl: './peliculas.html',
})
export class Peliculas {}
