import { Component, input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PeliculaModel } from '../../../modelos/pelicula-model';

@Component({
  selector: 'app-item-pelicula',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './item-pelicula.html',
  styleUrl: './item-pelicula.css',
})
export class ItemPelicula {
  pelicula = input.required<PeliculaModel>();
  esAdmin = input<boolean>(false);

  private router = inject(Router);

  onClickModificar() {
    this.router.navigate(['/admin/peliculas/crear'], {
      queryParams: { id: this.pelicula().id },
    });
  }
}