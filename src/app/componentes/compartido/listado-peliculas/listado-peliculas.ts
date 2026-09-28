import { Component, inject, signal, OnInit, input } from '@angular/core';
import { ItemPelicula } from '../item-pelicula/item-pelicula';
import { PeliculaService } from '../../../services/peliculas-service';
import { PeliculaModel } from '../../../modelos/pelicula-model';

@Component({
  selector: 'app-listado-peliculas',
  standalone: true,
  imports: [ItemPelicula],
  templateUrl: './listado-peliculas.html',
  styleUrl: './listado-peliculas.css',
})
export class ListadoPeliculas implements OnInit {
  esAdmin = input<boolean>(false);

  private peliculasService = inject(PeliculaService);

  peliculas = signal<PeliculaModel[]>([]);
  cargando = signal(false);
  errorMsg = signal('');

  async ngOnInit() {
    this.cargando.set(true);
    try {
      const data = await this.peliculasService.getAll();
      this.peliculas.set(data);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las películas');
    } finally {
      this.cargando.set(false);
    }
  }
}