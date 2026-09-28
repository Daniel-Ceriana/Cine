import { Component } from '@angular/core';
import { ListadoPeliculas } from '../../compartido/listado-peliculas/listado-peliculas';

@Component({
  imports: [ListadoPeliculas],
  selector: 'app-home-cliente',
  styleUrl: './home-cliente.css',
  templateUrl: './home-cliente.html',
})
export class HomeCliente {}
