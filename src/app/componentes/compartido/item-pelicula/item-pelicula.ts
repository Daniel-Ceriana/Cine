import { Component, input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PeliculaModel } from '../../../modelos/pelicula-model';
import { RestriccionEdadPipe } from '../../../pipes/pelicula/restriccion-edad.pipe';
import { DuracionPipe } from '../../../pipes/comunes/duracion.pipe';
import { PuntuacionPipe } from '../../../pipes/pelicula/puntuacion.pipe';
import { FechaCortaArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { PuntuacionPelicula } from '../../../modelos/resenia-model';

@Component({
  selector: 'app-item-pelicula',
  standalone: true,
  imports: [RouterLink, RestriccionEdadPipe, DuracionPipe, PuntuacionPipe, FechaCortaArPipe],
  templateUrl: './item-pelicula.html',
  styleUrl: './item-pelicula.css',
})
export class ItemPelicula {
  pelicula = input.required<PeliculaModel>();
  esAdmin = input<boolean>(false);
  // lo calcula el listado: alguna función de la película está hoy en preventa
  enPreventa = input<boolean>(false);
  // película de "Próximamente": se muestra el día de estreno en vez de la puntuación
  proxima = input<boolean>(false);
  // promedio y cantidad de reseñas (null = todavía sin reseñas); lo busca el listado
  puntuacion = input<PuntuacionPelicula | null>(null);

  private router = inject(Router);

  onClickModificar() {
    this.router.navigate(['/admin/peliculas/crear'], {
      queryParams: { id: this.pelicula().id },
    });
  }
}