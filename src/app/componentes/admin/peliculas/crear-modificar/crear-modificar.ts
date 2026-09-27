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
import { SupabaseService } from '../../../../services/supabase-service'; // ajustar ruta real



@Component({
  imports: [FormField, RouterLink],
  selector: 'app-crear-modificar',
  styleUrls: ['../../../compartido/stylesCompartidos/forms.css', './crear-modificar.css'],
  templateUrl: './crear-modificar.html',
})
export class CrearModificar implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabase = inject(SupabaseService); // asumo .client: SupabaseClient

  errorMsg = signal('');
  cargando = signal(false);

  formatos: Array<'2D' | '3D' | '4D' | '5D'> = ['2D', '3D', '4D', '5D'];

  peliculaId = signal<string | null>(null);
  esEdicion = computed(() => this.peliculaId() !== null);

  archivoSeleccionado = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  private model = signal<PeliculaForm>({
    nombre: '',
    sinopsis: '',
    imagen_url: '',
    duracion_minutos: 0,
    formato: '2D',
    idioma: 'castellano',
    restriccion_edad: '0',
    fecha_estreno: '',
    precio_base: 0,
    precio_preventa: 0,
    dias_preventa: 0,
    activa: true,
    destacada: false,

  });

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

    required(p.formato, { message: 'Seleccioná un formato' });

    required(p.idioma, { message: 'El idioma es obligatorio' });
    maxLength(p.idioma, 50, { message: 'Máximo 50 caracteres' });

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

    required(p.precio_base, { message: 'El precio base es obligatorio' });
    validate(p.precio_base, ({ value }) =>
      value() <= 0 ? { kind: 'min', message: 'Tiene que ser mayor a 0' } : null,
    );

    validate(p.precio_preventa, ({ value }) =>
      value() < 0 ? { kind: 'min', message: 'No puede ser negativo' } : null,
    );

    validate(p.dias_preventa, ({ value }) =>
      value() < 0 ? { kind: 'min', message: 'No puede ser negativo' } : null,
    );
  });

  async ngOnInit() {
    const id = this.route.snapshot.queryParamMap.get('id');
    if (!id) return;

    this.peliculaId.set(id);
    this.cargando.set(true);

    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('*')
      .eq('id', id)
      .single();

    this.cargando.set(false);

    if (error || !data) {
      this.errorMsg.set('No se pudo cargar la película');
      return;
    }

    this.model.set({
      nombre: data.nombre,
      sinopsis: data.sinopsis,
      imagen_url: data.imagen_url,
      duracion_minutos: data.duracion_minutos,
      formato: data.formato,
      idioma: data.idioma,
      restriccion_edad: data.restriccion_edad,
      fecha_estreno: data.fecha_estreno,
      precio_base: data.precio_base,
      precio_preventa: data.precio_preventa,
      dias_preventa: data.dias_preventa,
      activa: data.activa,
      destacada: data.activa,
    });

    this.previewUrl.set(data.imagen_url ?? null);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.archivoSeleccionado.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  private async subirImagen(file: File): Promise<string> {
    const extension = file.name.split('.').pop();
    const nombreArchivo = `${crypto.randomUUID()}.${extension}`;
    const ruta = `peliculas/${nombreArchivo}`;

    const { error } = await this.supabase.client.storage
      .from('imagenes') // ajustar al nombre real del bucket
      .upload(ruta, file, { upsert: false });

    if (error) throw error;

    const { data } = this.supabase.client.storage.from('imagenes').getPublicUrl(ruta);
    return data.publicUrl;
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
          imagenUrl = await this.subirImagen(archivo);
        }

        const payload = { ...this.model(),
  restriccion_edad: Number(this.model().restriccion_edad), imagen_url: imagenUrl };

        if (this.esEdicion()) {
          const { error } = await this.supabase.client
            .from('peliculas')
            .update(payload)
            .eq('id', this.peliculaId());
          if (error) throw error;
        } else {
          const { error } = await this.supabase.client.from('peliculas').insert(payload);
          if (error) throw error;
        }

        this.router.navigate(['/admin/peliculas']);
      } catch (e: any) {
        this.errorMsg.set(e?.message ?? 'No se pudo guardar la película');
      } finally {
        this.cargando.set(false);
      }
    });
  }
}