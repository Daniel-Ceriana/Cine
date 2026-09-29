import { Component, input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PeliculaModel } from '../../../modelos/pelicula-model';
import { RestriccionEdadPipe } from '../../../pipes/pelicula/restriccion-edad.pipe';
import { DuracionPipe } from '../../../pipes/comunes/duracion.pipe';

@Component({
  selector: 'app-item-pelicula',
  standalone: true,
  imports: [RouterLink, RestriccionEdadPipe, DuracionPipe],
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