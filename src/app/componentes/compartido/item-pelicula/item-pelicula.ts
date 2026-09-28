import { Component, input,inject } from '@angular/core';
import { Router } from '@angular/router';
import { PeliculaModel } from '../../../modelos/pelicula-model';


@Component({
  selector: 'app-item-pelicula',
  standalone: true,
  templateUrl: './item-pelicula.html',
  styleUrl: './item-pelicula.css',
})
export class ItemPelicula {
  pelicula = input.required<PeliculaModel>();
  esAdmin = input<boolean>(false);

  private router = inject(Router);

  onClickItem() {
    this.router.navigate(['/peliculas', this.pelicula().id]); // ruta de detalle, ajustar
  }

  onClickModificar(event: Event) {
    event.stopPropagation(); // para que no dispare también onClickItem
    this.router.navigate(['/admin/peliculas/crear'], {
      queryParams: { id: this.pelicula().id },
    });
  }
}