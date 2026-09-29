import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { form, FormField, required, validate, submit } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FuncionService } from '../../../../services/funcion-service';
import { PeliculaService } from '../../../../services/peliculas-service';
import {
  FormatoFuncion,
  IdiomaFuncion,
  FuncionModificarPayload,
} from '../../../../modelos/funcion-model';
import { PeliculaModel } from '../../../../modelos/pelicula-model';
import {
  fechaISO,
  fechaDesdeISO,
  partesAr,
  aIsoAr,
  horaADate,
  dateAHora,
} from '../../../../utilidades/fechas-ar';

// Se evita generar rangos enormes por error (ej: un año mal tipeado)
const MAX_FECHAS = 120;

// Valores de Date.getDay(): domingo = 0
const DIAS_SEMANA = [
  { valor: 1, corto: 'Lun' },
  { valor: 2, corto: 'Mar' },
  { valor: 3, corto: 'Mié' },
  { valor: 4, corto: 'Jue' },
  { valor: 5, corto: 'Vie' },
  { valor: 6, corto: 'Sáb' },
  { valor: 0, corto: 'Dom' },
];

interface FuncionFormModel {
  pelicula_id: string;
  formato: FormatoFuncion;
  idioma: IdiomaFuncion;
  precio_base: number;
  precio_preventa: number;
  dias_preventa: number;
}

@Component({
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatTimepickerModule,
    MatButtonToggleModule,
  ],
  selector: 'app-crear-modificar-funcion',
  styleUrl: './crear-modificar.css',
  templateUrl: './crear-modificar.html',
})
export class CrearModificarFuncion implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private funcionService = inject(FuncionService);
  private peliculasService = inject(PeliculaService);

  errorMsg = signal('');
  cargando = signal(false);
  intentoEnvio = signal(false);

  funcionId = signal<string | null>(null);
  esEdicion = computed(() => this.funcionId() !== null);

  peliculas = signal<PeliculaModel[]>([]);
  readonly diasSemana = DIAS_SEMANA;
  readonly formatos: FormatoFuncion[] = ['2D', '3D', '4D', '5D'];
  readonly hoy = new Date();

  // Valores que manejan los componentes de Material (fechas, hora, días)
  desde = signal<Date | null>(null);
  hasta = signal<Date | null>(null);
  diasElegidos = signal<number[]>([]);
  fechaUnica = signal<Date | null>(null); // solo al modificar una función
  hora = signal<Date | null>(null);

  private model = signal<FuncionFormModel>({
    pelicula_id: '',
    formato: '2D',
    idioma: 'castellano',
    precio_base: 0,
    precio_preventa: 0,
    dias_preventa: 0,
  });

  funcionForm = form(this.model, (f) => {
    required(f.pelicula_id, { message: 'Elegí una película' });

    validate(f.precio_base, ({ value }) =>
      value() <= 0 ? { kind: 'min', message: 'Tiene que ser mayor a 0' } : null,
    );
    validate(f.precio_preventa, ({ value }) =>
      value() < 0 ? { kind: 'min', message: 'No puede ser negativo' } : null,
    );
    validate(f.dias_preventa, ({ value }) =>
      value() < 0 || !Number.isInteger(value())
        ? { kind: 'min', message: 'Tiene que ser un entero, 0 o mayor' }
        : null,
    );
  });

  // Fechas concretas que se van a crear: cada día del rango cuyo día de semana esté elegido
  fechasGeneradas = computed<string[]>(() => {
    const desde = this.desde();
    const hasta = this.hasta();
    const dias = this.diasElegidos();
    if (!desde || !hasta || dias.length === 0 || hasta < desde) return [];

    const fechas: string[] = [];
    const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 12);
    while (cursor <= hasta && fechas.length <= MAX_FECHAS) {
      if (dias.includes(cursor.getDay())) fechas.push(fechaISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return fechas;
  });

  peliculaElegida = computed(() =>
    this.peliculas().find((p) => p.id === this.model().pelicula_id) ?? null,
  );

  // Errores de los controles de Material (no pasan por el form de señales)
  erroresFechas = computed<string[]>(() => {
    const errores: string[] = [];

    if (this.esEdicion()) {
      if (!this.fechaUnica()) errores.push('Elegí la fecha de la función');
    } else {
      if (!this.desde() || !this.hasta()) errores.push('Elegí el rango de fechas');
      else if (this.hasta()! < this.desde()!) errores.push('La fecha final es anterior a la inicial');
      if (this.diasElegidos().length === 0) errores.push('Elegí al menos un día de la semana');
      else if (this.desde() && this.hasta() && this.fechasGeneradas().length === 0) {
        errores.push('Ningún día del rango coincide con los días elegidos');
      }
      if (this.fechasGeneradas().length > MAX_FECHAS) {
        errores.push(`Son demasiadas funciones a la vez (máximo ${MAX_FECHAS})`);
      }
    }

    const hora = this.hora();
    if (!hora) errores.push('Elegí el horario de inicio');
    else if (hora.getMinutes() % 5 !== 0) errores.push('El horario tiene que ser múltiplo de 5 minutos');

    return errores;
  });

  async ngOnInit() {
    this.cargando.set(true);
    try {
      this.peliculas.set(await this.peliculasService.getAll(true));

      const id = this.route.snapshot.queryParamMap.get('id');
      if (!id) return;

      this.funcionId.set(id);
      const funcion = await this.funcionService.getById(id);
      const { fecha, hora } = partesAr(funcion.inicio);

      this.model.set({
        pelicula_id: funcion.pelicula_id,
        formato: funcion.formato,
        idioma: funcion.idioma,
        precio_base: funcion.precio_base,
        precio_preventa: funcion.precio_preventa,
        dias_preventa: funcion.dias_preventa,
      });
      this.fechaUnica.set(fechaDesdeISO(fecha));
      this.hora.set(horaADate(hora));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar la información');
    } finally {
      this.cargando.set(false);
    }
  }

  // Los botones de opción de Material actualizan el modelo del formulario
  setFormato(formato: FormatoFuncion) {
    this.model.update((m) => ({ ...m, formato }));
  }

  setIdioma(idioma: IdiomaFuncion) {
    this.model.update((m) => ({ ...m, idioma }));
  }

  setPelicula(pelicula_id: string) {
    this.model.update((m) => ({ ...m, pelicula_id }));
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.intentoEnvio.set(true);

    await submit(this.funcionForm, async () => {
      const m = this.model();

      if (this.erroresFechas().length > 0) return;
      if (m.dias_preventa > 0 && m.precio_preventa <= 0) {
        this.errorMsg.set('Si hay días de preventa tenés que indicar el precio de preventa');
        return;
      }

      try {
        this.cargando.set(true);
        const hora = dateAHora(this.hora()!);

        if (this.esEdicion()) {
          const payload: FuncionModificarPayload = {
            ...m,
            inicio: aIsoAr(fechaISO(this.fechaUnica()!), hora),
          };
          await this.funcionService.modificar(this.funcionId()!, payload);
        } else {
          await this.funcionService.crearVarias({
            ...m,
            fechas: this.fechasGeneradas(),
            hora,
          });
        }

        this.router.navigate(['/admin/funciones']);
      } catch (e: any) {
        this.errorMsg.set(e?.message ?? 'No se pudo guardar la función');
      } finally {
        this.cargando.set(false);
      }
    });
  }
}
