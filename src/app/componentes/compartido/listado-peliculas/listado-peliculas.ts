import { Component, inject, signal, OnInit, input, computed } from '@angular/core';
import { ItemPelicula } from '../item-pelicula/item-pelicula';
import { PeliculaService } from '../../../services/peliculas-service';
import { PeliculaModel } from '../../../modelos/pelicula-model';
import { PeliculaConGeneros, Genero } from '../../../modelos/pelicula-model';
import { form,FormField } from '@angular/forms/signals';


const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();


@Component({
  selector: 'app-listado-peliculas',
  standalone: true,
  imports: [ItemPelicula,FormField],
  templateUrl: './listado-peliculas.html',
  styleUrl: './listado-peliculas.css',
})
export class ListadoPeliculas implements OnInit {
  esAdmin = input<boolean>(false);

  private peliculasService = inject(PeliculaService);

  peliculas = signal<PeliculaConGeneros[]>([]);
  cargando = signal(false);
  errorMsg = signal('');
  generos = signal<Genero[]>([]); 

  // idioma y formato (2D/3D/...) ahora son de la función, no de la película:
  // esos filtros vuelven cuando exista la cartelera con funciones
    private filtrosModel = signal({
    nombre: '',
    genero: '',
    destacada: false,
  });
  
  filtrosForm = form(this.filtrosModel);

  peliculasFiltradas = computed(() => {
  const f = this.filtrosModel();
  const nombre = normalizar(f.nombre);
// console.log('genero filtro:', f.genero, typeof f.genero);
//   console.log('generos por película:', this.peliculas().map((p) => p.generos));
  return this.peliculas().filter(
    (p) =>
      (!nombre || normalizar(p.nombre).includes(nombre)) &&
      (!f.genero || p.generos.some((g) => String(g.nombre) === f.genero)) &&
      (!f.destacada || p.destacada),
  );
});


hayFiltrosActivos = computed(() => {
    const f = this.filtrosModel();
    return !!(f.nombre || f.genero || f.destacada);
  });

  limpiarFiltros() {
    this.filtrosModel.set({ nombre: '', genero: '', destacada: false });
  }
  async ngOnInit() {
  this.cargando.set(true);
  try {
    const [peliculas, generos] = await Promise.all([
      this.peliculasService.getAll(!this.esAdmin()), // no admin -> solo activas
      this.peliculasService.getGeneros(),
    ]);
    // console.log(peliculas);
    this.peliculas.set(peliculas);
    this.generos.set(generos);
  } catch (e: any) {
    this.errorMsg.set(e?.message ?? 'No se pudieron cargar las películas');
  } finally {
    this.cargando.set(false);
  }
}
}