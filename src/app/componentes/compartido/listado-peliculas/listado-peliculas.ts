import { Component, inject, signal, OnInit, input, computed } from '@angular/core';
import { ItemPelicula } from '../item-pelicula/item-pelicula';
import { PeliculaService } from '../../../services/peliculas-service';
import { FuncionService } from '../../../services/funcion-service';
import { ReseniaService } from '../../../services/resenia-service';
import { PuntuacionPelicula } from '../../../modelos/resenia-model';
import { PeliculaModel } from '../../../modelos/pelicula-model';
import { PeliculaConGeneros, Genero } from '../../../modelos/pelicula-model';
import { form,FormField } from '@angular/forms/signals';
import { FiltrarPipe } from '../../../pipes/comunes/filtrar.pipe';


@Component({
  selector: 'app-listado-peliculas',
  standalone: true,
  imports: [ItemPelicula, FormField, FiltrarPipe],
  templateUrl: './listado-peliculas.html',
  styleUrl: './listado-peliculas.css',
})
export class ListadoPeliculas implements OnInit {
  esAdmin = input<boolean>(false);

  private peliculasService = inject(PeliculaService);
  private funcionService = inject(FuncionService);
  private reseniaService = inject(ReseniaService);

  peliculas = signal<PeliculaConGeneros[]>([]);
  cargando = signal(false);
  errorMsg = signal('');
  generos = signal<Genero[]>([]); 
  enPreventa = signal<Set<string>>(new Set());
  puntuaciones = signal<Map<string, PuntuacionPelicula>>(new Map());

  // idioma y formato (2D/3D/...) ahora son de la función, no de la película:
  // esos filtros vuelven cuando exista la cartelera con funciones
    private filtrosModel = signal({
    nombre: '',
    genero: '',
    destacada: false,
  });
  
  filtrosForm = form(this.filtrosModel);

  // El filtrado de la lista se hace en la plantilla con el pipe `filtrar`

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
    const [peliculas, generos, enPreventa, puntuaciones] = await Promise.all([
      this.peliculasService.getAll(!this.esAdmin()), // no admin -> solo activas
      this.peliculasService.getGeneros(),
      this.funcionService.getPeliculasEnPreventa(),
      this.reseniaService.getPuntuaciones().catch(() => new Map<string, PuntuacionPelicula>()), // sin puntuación no se corta el listado
    ]);
    // console.log(peliculas);
    this.peliculas.set(peliculas);
    this.generos.set(generos);
    this.enPreventa.set(enPreventa);
    this.puntuaciones.set(puntuaciones);
  } catch (e: any) {
    this.errorMsg.set(e?.message ?? 'No se pudieron cargar las películas');
  } finally {
    this.cargando.set(false);
  }
}
}