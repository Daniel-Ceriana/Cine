import { Component, inject, signal, OnInit, input, computed } from '@angular/core';
import { ItemPelicula } from '../item-pelicula/item-pelicula';
import { PeliculaService } from '../../../services/peliculas-service';
import { FuncionService } from '../../../services/funcion-service';
import { ReseniaService } from '../../../services/resenia-service';
import { PuntuacionPelicula } from '../../../modelos/resenia-model';
import { PeliculaModel } from '../../../modelos/pelicula-model';
import { IdiomaFuncion } from '../../../modelos/funcion-model';
import { PeliculaConGeneros, Genero } from '../../../modelos/pelicula-model';
import { form,FormField } from '@angular/forms/signals';
import { FiltrarPipe } from '../../../pipes/comunes/filtrar.pipe';
import { IdiomaFuncionPipe } from '../../../pipes/funcion/idioma-funcion.pipe';
import { esProxima } from '../../../utilidades/proximamente';


@Component({
  selector: 'app-listado-peliculas',
  standalone: true,
  imports: [ItemPelicula, FormField, FiltrarPipe, IdiomaFuncionPipe],
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
  oferta = signal<Map<string, { idiomas: IdiomaFuncion[]; formatos: string[] }>>(new Map());

  // Cada película con los idiomas y formatos de sus funciones: es lo que usan los filtros
  peliculasConOferta = computed(() =>
    this.peliculas().map((p) => ({
      ...p,
      idiomas: this.oferta().get(p.id)?.idiomas ?? [],
      formatos: this.oferta().get(p.id)?.formatos ?? [],
    })),
  );
  // Las opciones de los filtros salen de las funciones que hay, no están fijas
  idiomasDisponibles = computed(() => [...new Set(this.peliculasConOferta().flatMap((p) => p.idiomas))].sort());
  formatosDisponibles = computed(() => [...new Set(this.peliculasConOferta().flatMap((p) => p.formatos))].sort());

  // idioma y formato (2D/3D/...) ahora son de la función, no de la película:
  // esos filtros vuelven cuando exista la cartelera con funciones
    private filtrosModel = signal({
    nombre: '',
    genero: '',
    idioma: '',
    formato: '',
    destacada: false,
  });
  
  filtrosForm = form(this.filtrosModel);

  // El filtrado de la lista se hace en la plantilla con el pipe `filtrar`

hayFiltrosActivos = computed(() => {
    const f = this.filtrosModel();
    return !!(f.nombre || f.genero || f.idioma || f.formato || f.destacada);
  });

  limpiarFiltros() {
    this.filtrosModel.set({ nombre: '', genero: '', idioma: '', formato: '', destacada: false });
  }
  async ngOnInit() {
  this.cargando.set(true);
  try {
    const [peliculas, generos, enPreventa, puntuaciones, oferta] = await Promise.all([
      this.peliculasService.getAll(!this.esAdmin()), // no admin -> solo activas
      this.peliculasService.getGeneros(),
      this.funcionService.getPeliculasEnPreventa(),
      this.reseniaService.getPuntuaciones().catch(() => new Map<string, PuntuacionPelicula>()), // sin puntuación no se corta el listado
      this.funcionService.getOfertaPorPelicula().catch(() => new Map<string, { idiomas: IdiomaFuncion[]; formatos: string[] }>()),
    ]);
    // console.log(peliculas);
    // Las películas "próximas" (estreno futuro y venta cerrada) se ven en la sección Próximamente, no acá.
    // El admin las ve todas.
    this.peliculas.set(this.esAdmin() ? peliculas : peliculas.filter((p) => !esProxima(p, enPreventa)));
    this.oferta.set(oferta);
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