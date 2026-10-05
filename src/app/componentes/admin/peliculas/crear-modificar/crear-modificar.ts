// crear-modificar.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form,
  FormField,
  required,
  minLength,
  maxLength,
  validate,
  submit,
} from '@angular/forms/signals';
import { SupabaseService } from '../../../../services/supabase-service';
import { PeliculaModel, PeliculaModelForm, Genero } from '../../../../modelos/pelicula-model';
import{PeliculaService} from '../../../../services/peliculas-service'
import { SelectorFecha } from '../../../compartido/selector-fecha/selector-fecha';


@Component({
  imports: [FormField, RouterLink, SelectorFecha],
  selector: 'app-crear-modificar',
  styleUrls: ['../../../compartido/stylesCompartidos/forms.css', './crear-modificar.css'],
  templateUrl: './crear-modificar.html',
})
export class CrearModificar implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private peliculasService = inject(PeliculaService);

  errorMsg = signal('');
  cargando = signal(false);

  peliculaId = signal<string | null>(null);
  esEdicion = computed(() => this.peliculaId() !== null);

  archivoSeleccionado = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  generos = signal<Genero[]>([]);
  generosSeleccionados = signal<number[]>([]);

  private model = signal<PeliculaModelForm>({
    nombre: '',
    sinopsis: '',
    imagen_url: '',
    duracion_minutos: 0,
    restriccion_edad: '0',
    fecha_estreno: '',
    activa: true,
    destacada: false,

  });
  toggleGenero(id: number, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  this.generosSeleccionados.update((ids) =>
    checked ? [...ids, id] : ids.filter((g) => g !== id),
  );
}

  peliculaForm = form(this.model, (p) => {
    required(p.nombre, { message: 'El nombre es obligatorio' });
    minLength(p.nombre, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(p.nombre, 100, { message: 'Máximo 100 caracteres' });

    required(p.sinopsis, { message: 'La sinopsis es obligatoria' });
    minLength(p.sinopsis, 10, { message: 'Mínimo 10 caracteres' });
    maxLength(p.sinopsis, 1000, { message: 'Máximo 1000 caracteres' });

    required(p.duracion_minutos, { message: 'La duración es obligatoria' });
    validate(p.duracion_minutos, ({ value }) =>
      value() <= 0 ? { kind: 'min', message: 'Tiene que ser mayor a 0' } : null,
    );

    // restriccion_edad puede ser 0, por eso no uso required puro (0 es falsy)
    // sino que valido explícitamente que no sea null/undefined y no sea negativo
    // validate(p.restriccion_edad, ({ value }) => {
    //   const v = value();
    //   if (v === null || v === undefined || Number.isNaN(v)) {
    //     return { kind: 'required', message: 'Indicá la restricción de edad' };
    //   }
    //   if (v < 0) {
    //     return { kind: 'min', message: 'No puede ser negativo' };
    //   }
    //   if (v > 18) {
    //     return { kind: 'min', message: 'No puede ser mayor a 18' };
    //   }
    //   return null;
    // });

    required(p.fecha_estreno, { message: 'La fecha de estreno es obligatoria' });
  });

 async ngOnInit() {
  this.cargando.set(true);
  try {
    this.generos.set(await this.peliculasService.getGeneros());

    const id = this.route.snapshot.queryParamMap.get('id');
    if (!id) return;

    this.peliculaId.set(id);

    const [pelicula, generoIds] = await Promise.all([
      this.peliculasService.getById(id),
      this.peliculasService.getGeneroIdsDePelicula(id),
    ]);

    this.model.set({
      nombre: pelicula.nombre,
      sinopsis: pelicula.sinopsis,
      imagen_url: pelicula.imagen_url,
      duracion_minutos: pelicula.duracion_minutos,
      restriccion_edad: String(pelicula.restriccion_edad),
      fecha_estreno: pelicula.fecha_estreno,
      activa: pelicula.activa,
      destacada: pelicula.destacada,
    });
    this.generosSeleccionados.set(generoIds);
    this.previewUrl.set(pelicula.imagen_url ?? null);
  } catch (e: any) {
    this.errorMsg.set(e?.message ?? 'No se pudo cargar la película');
  } finally {
    this.cargando.set(false);
  }
}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.archivoSeleccionado.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');

    await submit(this.peliculaForm, async () => {
      try {
        this.cargando.set(true);

        let imagenUrl = this.model().imagen_url;
        const archivo = this.archivoSeleccionado();
        if (archivo) {
          imagenUrl = await this.peliculasService.subirImagen(archivo);
        }

        const payload = {
          ...this.model(),
          restriccion_edad: Number(this.model().restriccion_edad),
          imagen_url: imagenUrl,
        };

       let peliculaId: string;

      if (this.esEdicion()) {
        peliculaId = this.peliculaId()!;
        await this.peliculasService.modificar(peliculaId, payload);
      } else {
        const creada = await this.peliculasService.crear(payload);
        peliculaId = creada.id;
      }
      await this.peliculasService.setGeneros(peliculaId, this.generosSeleccionados()); // <- esta faltaba

        this.router.navigate(['/admin/peliculas']);
      } catch (e: any) {
        this.errorMsg.set(e?.message ?? 'No se pudo guardar la película');
      } finally {
        this.cargando.set(false);
      }
    });
  }


}