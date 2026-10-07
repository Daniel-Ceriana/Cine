import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { Auth } from '../../../services/auth';
import { ReseniaService } from '../../../services/resenia-service';
import { MAX_COMENTARIO_RESENIA, PuntuacionPelicula, ReseniaConAutor } from '../../../modelos/resenia-model';
import { Estrellas } from '../../compartido/estrellas/estrellas';
import { PuntuacionPipe } from '../../../pipes/pelicula/puntuacion.pipe';
import { DiaArPipe } from '../../../pipes/comunes/fechas-ar.pipes';

const RESENIAS_VISIBLES = 5;

// Reseñas de una película: promedio, la reseña propia (si la persona ya la vio) y las de los demás.
// La base controla que solo reseñe quien vio la película y que haya una reseña por persona.
@Component({
  imports: [Estrellas, FormField, RouterLink, PuntuacionPipe, DiaArPipe],
  selector: 'app-resenias-pelicula',
  styleUrl: './resenias-pelicula.css',
  templateUrl: './resenias-pelicula.html',
})
export class ReseniasPelicula implements OnInit {
  private auth = inject(Auth);
  private reseniaService = inject(ReseniaService);

  peliculaId = input.required<string>();

  readonly maxComentario = MAX_COMENTARIO_RESENIA;

  resenias = signal<ReseniaConAutor[]>([]);
  puntuacion = signal<PuntuacionPelicula | null>(null);
  puedeResenar = signal(false); // la cuenta vio la película
  verTodas = signal(false);
  cargando = signal(false);
  guardando = signal(false);
  intentoEnvio = signal(false);
  errorMsg = signal('');
  okMsg = signal('');

  // Formulario: las estrellas son un componente aparte y el comentario va en el formulario
  estrellas = signal(0);
  private model = signal({ comentario: '' });
  reseniaForm = form(this.model);

  tieneSesion = computed(() => this.auth.perfil() !== null);
  miResenia = computed(() => this.resenias().find((r) => r.usuario_id === this.auth.perfil()?.id) ?? null);

  // Las de los demás (la propia se ve y se edita arriba)
  otras = computed(() => this.resenias().filter((r) => r.usuario_id !== this.auth.perfil()?.id));
  visibles = computed(() => (this.verTodas() ? this.otras() : this.otras().slice(0, RESENIAS_VISIBLES)));

  faltantes = computed<string[]>(() => {
    const faltan: string[] = [];
    if (this.estrellas() < 1) faltan.push('Elegí de 1 a 5 estrellas');
    if (this.model().comentario.trim().length > MAX_COMENTARIO_RESENIA) {
      faltan.push(`El comentario puede tener hasta ${MAX_COMENTARIO_RESENIA} caracteres`);
    }
    return faltan;
  });

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      const [resenias, puntuacion, puede] = await Promise.all([
        this.reseniaService.getDePelicula(this.peliculaId()),
        this.reseniaService.getPuntuacion(this.peliculaId()),
        this.tieneSesion() ? this.reseniaService.puedeResenar(this.peliculaId()) : Promise.resolve(false),
      ]);
      this.resenias.set(resenias);
      this.puntuacion.set(puntuacion);
      this.puedeResenar.set(puede);
      this.cargarFormulario();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las reseñas');
    } finally {
      this.cargando.set(false);
    }
  }

  // El formulario arranca con la reseña propia (si ya hay una) para poder modificarla
  private cargarFormulario() {
    const mia = this.miResenia();
    this.estrellas.set(mia?.estrellas ?? 0);
    this.model.set({ comentario: mia?.comentario ?? '' });
    this.reseniaForm().reset();
  }

  autor(r: ReseniaConAutor): string {
    if (!r.profiles) return 'Usuario';
    return `${r.profiles.nombre} ${r.profiles.apellido.charAt(0)}.`;
  }

  async guardar(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.okMsg.set('');
    this.intentoEnvio.set(true);
    if (this.faltantes().length > 0) return;

    this.guardando.set(true);
    try {
      const nueva = !this.miResenia();
      await this.reseniaService.guardar(this.peliculaId(), this.estrellas(), this.model().comentario);
      this.intentoEnvio.set(false);
      await this.cargar();
      this.okMsg.set(nueva ? 'Se publicó tu reseña.' : 'Se modificó tu reseña.');
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo guardar la reseña');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar() {
    if (!confirm('¿Eliminar tu reseña?')) return;

    this.errorMsg.set('');
    this.okMsg.set('');
    this.guardando.set(true);
    try {
      await this.reseniaService.eliminar(this.peliculaId());
      this.intentoEnvio.set(false);
      await this.cargar();
      this.okMsg.set('Se eliminó tu reseña.');
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo eliminar la reseña');
    } finally {
      this.guardando.set(false);
    }
  }
}
