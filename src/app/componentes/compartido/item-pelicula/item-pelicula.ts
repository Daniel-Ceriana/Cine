import { Component, computed, input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PeliculaModel } from '../../../modelos/pelicula-model';
import { RestriccionEdadPipe } from '../../../pipes/pelicula/restriccion-edad.pipe';
import { DuracionPipe } from '../../../pipes/comunes/duracion.pipe';
import { PuntuacionPipe } from '../../../pipes/pelicula/puntuacion.pipe';
import { PuntuacionPelicula } from '../../../modelos/resenia-model';

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

@Component({
  selector: 'app-item-pelicula',
  standalone: true,
  imports: [RouterLink, RestriccionEdadPipe, DuracionPipe, PuntuacionPipe],
  templateUrl: './item-pelicula.html',
  styleUrl: './item-pelicula.css',
})
export class ItemPelicula {
  pelicula = input.required<PeliculaModel>();
  esAdmin = input<boolean>(false);
  // lo calcula el listado: alguna función de la película está hoy en preventa
  enPreventa = input<boolean>(false);
  // película de "Próximamente": el día de estreno se ve sobre el póster y no se muestra la puntuación
  proxima = input<boolean>(false);
  // puesto en el ranking de las más vendidas (1, 2 o 3); null = no es parte de un ranking
  posicion = input<number | null>(null);
  // promedio y cantidad de reseñas (null = todavía sin reseñas); lo busca el listado
  puntuacion = input<PuntuacionPelicula | null>(null);

  private router = inject(Router);

  // '2026-10-15' -> día 15, mes 'OCT': es el cartel de estreno
  estreno = computed(() => {
    const [, mes, dia] = this.pelicula().fecha_estreno.split('-');
    return { dia: Number(dia), mes: MESES[Number(mes) - 1] };
  });

  onClickModificar() {
    this.router.navigate(['/admin/peliculas/crear'], {
      queryParams: { id: this.pelicula().id },
    });
  }
}