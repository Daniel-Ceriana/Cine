import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { form, FormField, submit } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { textoResumenCancelacion } from '../../../../utilidades/resumen-cancelacion';
import { ConfirmarSalida, confirmarDescartar } from '../../../../guards/salida-guard';
import { FuncionService } from '../../../../services/funcion-service';
import { PeliculaService } from '../../../../services/peliculas-service';
import {
  IdiomaFuncion,
  AlcanceModificar,
  FuncionConRelaciones,
} from '../../../../modelos/funcion-model';
import { FormatoSala } from '../../../../modelos/sala-model';
import { PeliculaModel } from '../../../../modelos/pelicula-model';
import {
  fechaDesdeISO,
  partesAr,
  horaADate,
  dateAHora,
  hoyAr,
  sumarDias,
  lunesDe,
  diaSemana,
} from '../../../../utilidades/fechas-ar';
import { PesosPipe } from '../../../../pipes/comunes/pesos.pipe';
import { DuracionPipe } from '../../../../pipes/comunes/duracion.pipe';
import { DiaArPipe, FechaCortaArPipe } from '../../../../pipes/comunes/fechas-ar.pipes';

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

const OPCIONES_SEMANAS = [1, 2, 3, 4, 6, 8, 12];
const DIAS_A_ELEGIR_UNA_FUNCION = 28;

interface FuncionFormModel {
  pelicula_id: string;
  formato: FormatoSala;
  idioma: IdiomaFuncion;
  precio_base: number;
  con_preventa: boolean;
}

@Component({
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTimepickerModule,
    MatButtonToggleModule,
    DuracionPipe,
    DiaArPipe,
    FechaCortaArPipe,
    PesosPipe,
  ],
  selector: 'app-crear-modificar-funcion',
  styleUrl: './crear-modificar.css',
  templateUrl: './crear-modificar.html',
})
export class CrearModificarFuncion implements OnInit, ConfirmarSalida {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private funcionService = inject(FuncionService);
  private peliculasService = inject(PeliculaService);

  errorMsg = signal('');
  cargando = signal(false);
  intentoEnvio = signal(false);

  // Al modificar: la función elegida y si pertenece a una serie (creadas juntas)
  funcionBase = signal<FuncionConRelaciones | null>(null);
  esEdicion = computed(() => this.funcionBase() !== null);
  tieneSerie = computed(() => !!this.funcionBase()?.serie_id);
  alcance = signal<AlcanceModificar>('una');

  peliculas = signal<PeliculaModel[]>([]);
  readonly diasSemana = DIAS_SEMANA;
  readonly formatos: FormatoSala[] = ['2D', '3D', '4D', '5D'];

  // Valores que manejan los componentes de Material
  diasElegidos = signal<number[]>([]);
  semanas = signal(1);
  inicioSemana = signal<'esta' | 'proxima'>('esta'); // solo al crear
  diaUnico = signal(''); // 'YYYY-MM-DD', solo al modificar una función
  hora = signal<Date | null>(null);

  private model = signal<FuncionFormModel>({
    pelicula_id: '',
    formato: '2D',
    idioma: 'castellano',
    precio_base: 0,
    con_preventa: false,
  });

  // Las validaciones están en "faltantes" (más abajo), que junta todo lo que impide guardar
  funcionForm = form(this.model);

  // true cuando se eligen varios días (crear, o modificar "esta y las siguientes")
  modoVarias = computed(() => !this.esEdicion() || this.alcance() === 'siguientes');

  // Fecha de la función que se está modificando ('YYYY-MM-DD')
  private fechaBase = computed(() => {
    const f = this.funcionBase();
    return f ? partesAr(f.inicio).fecha : hoyAr();
  });

  // Primer día en que puede haber funciones: hoy (o la función que se modifica) y nunca antes del estreno
  private fechaMinima = computed(() => {
    const estreno = this.peliculaElegida()?.fecha_estreno;
    return estreno && estreno > this.fechaBase() ? estreno : this.fechaBase();
  });

  // Fechas concretas: en cada una de las N semanas, los días de la semana elegidos.
  // Nunca se generan fechas pasadas, anteriores al estreno ni anteriores a la función que se modifica.
  fechasGeneradas = computed<string[]>(() => {
    const dias = this.diasElegidos();
    if (dias.length === 0) return [];

    const minima = this.fechaMinima();
    let lunes = lunesDe(minima);
    if (!this.esEdicion() && this.inicioSemana() === 'proxima') lunes = sumarDias(lunes, 7);

    const fechas: string[] = [];
    for (let i = 0; i < this.semanas() * 7; i++) {
      const fecha = sumarDias(lunes, i);
      if (fecha >= minima && dias.includes(diaSemana(fecha))) fechas.push(fecha);
    }
    return fechas;
  });

  opcionesSemanas = computed(() =>
    [...new Set([...OPCIONES_SEMANAS, this.semanas()])].sort((a, b) => a - b),
  );

  // Lista de días para elegir al modificar una sola función (evita abrir un calendario)
  opcionesDia = computed<string[]>(() => {
    const desde = this.fechaMinima();
    const dias = Array.from({ length: DIAS_A_ELEGIR_UNA_FUNCION }, (_, i) => sumarDias(desde, i));
    const actual = this.fechaBase();
    return dias.includes(actual) ? dias : [actual, ...dias];
  });

  peliculaElegida = computed(() =>
    this.peliculas().find((p) => p.id === this.model().pelicula_id) ?? null,
  );

  // La preventa se configura en la película (días y precio); acá solo se marca qué funciones la tienen
  peliculaTienePreventa = computed(() => {
    const p = this.peliculaElegida();
    return !!p && p.dias_preventa > 0 && p.precio_preventa > 0;
  });

  // Errores de los controles de Material (no pasan por el form de señales)
  erroresFechas = computed<string[]>(() => {
    const errores: string[] = [];

    if (this.modoVarias()) {
      if (this.diasElegidos().length === 0) errores.push('Elegí al menos un día de la semana');
      else if (this.fechasGeneradas().length === 0) {
        errores.push('Con esos días y semanas no queda ninguna fecha válida (desde hoy y desde el estreno)');
      }
    } else if (!this.diaUnico()) {
      errores.push('Elegí el día de la función');
    }

    const hora = this.hora();
    if (!hora) errores.push('Elegí el horario de inicio');
    else if (hora.getMinutes() % 5 !== 0) errores.push('El horario tiene que ser múltiplo de 5 minutos');

    return errores;
  });

  // Todo lo que impide guardar, en lenguaje claro: campos del formulario + fechas y horario
  faltantes = computed<string[]>(() => {
    const m = this.model();
    const faltan: string[] = [];

    if (!m.pelicula_id) faltan.push('Elegí una película');
    if (!(m.precio_base > 0)) faltan.push('Ingresá un precio base mayor a 0');
    if (m.con_preventa && !this.peliculaTienePreventa()) {
      faltan.push('La película no tiene preventa configurada: cargala en la película o desmarcá "Con preventa"');
    }

    return [...faltan, ...this.erroresFechas()];
  });

  async ngOnInit() {
    this.cargando.set(true);
    try {
      this.peliculas.set(await this.peliculasService.getAll(true));

      const id = this.route.snapshot.queryParamMap.get('id');
      if (!id) return;

      const funcion = await this.funcionService.getById(id);
      const { fecha, hora } = partesAr(funcion.inicio);

      this.model.set({
        pelicula_id: funcion.pelicula_id,
        formato: funcion.salas.formato,
        idioma: funcion.idioma,
        precio_base: funcion.precio_base,
        con_preventa: funcion.con_preventa,
      });
      this.diaUnico.set(fecha);
      this.hora.set(horaADate(hora));

      // Si es parte de una serie, se precargan sus días y su cantidad de semanas
      if (funcion.serie_id) {
        const serie = await this.funcionService.getSerieDesde(funcion.serie_id, funcion.inicio);
        const fechas = serie.map((s) => partesAr(s.inicio).fecha);
        const ultima = fechas[fechas.length - 1] ?? fecha;

        this.diasElegidos.set([...new Set(fechas.map(diaSemana))]);
        const msPorSemana = 7 * 24 * 60 * 60 * 1000;
        const diferencia = fechaDesdeISO(lunesDe(ultima)).getTime() - fechaDesdeISO(lunesDe(fecha)).getTime();
        this.semanas.set(Math.round(diferencia / msPorSemana) + 1);
      } else {
        this.diasElegidos.set([diaSemana(fecha)]);
      }

      this.funcionBase.set(funcion);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar la información');
    } finally {
      this.cargando.set(false);
    }
  }

  // Los botones de opción de Material actualizan el modelo del formulario
  setFormato(formato: FormatoSala) {
    this.model.update((m) => ({ ...m, formato }));
  }

  setIdioma(idioma: IdiomaFuncion) {
    this.model.update((m) => ({ ...m, idioma }));
  }

  setPelicula(pelicula_id: string) {
    // si la película nueva no tiene preventa, la marca no puede quedar puesta
    const nueva = this.peliculas().find((p) => p.id === pelicula_id);
    const tienePreventa = !!nueva && nueva.dias_preventa > 0 && nueva.precio_preventa > 0;
    this.model.update((m) => ({ ...m, pelicula_id, con_preventa: m.con_preventa && tienePreventa }));
  }

  // canDeactivate: si el formulario tiene cambios sin guardar, se pide confirmación antes de salir
  puedeSalir(): boolean {
    return confirmarDescartar(this.funcionForm().dirty());
  }

  // Las funciones de la serie que no están en las fechas nuevas se cancelan. Si alguna tenía compras,
  // se le muestra al admin cuántas y cómo se compensan antes de seguir.
  private async confirmarCancelaciones(fechas: string[]): Promise<boolean> {
    const base = this.funcionBase();
    if (!base?.serie_id) return true;

    const serie = await this.funcionService.getSerieDesde(base.serie_id, base.inicio);
    const aCancelar = serie.filter((s) => !fechas.includes(partesAr(s.inicio).fecha));
    if (aCancelar.length === 0) return true;

    const resumen = await this.funcionService.resumenCancelacion(aCancelar.map((s) => s.id));
    const afectadas = resumen.compras_con_cuenta + resumen.compras_anonimas;
    if (afectadas === 0) return true;

    return confirm(
      `Al sacar estos días se cancelan ${aCancelar.length} función(es) de la serie.

${textoResumenCancelacion(resumen)}

¿Querés continuar?`,
    );
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.intentoEnvio.set(true);

    // Si falta algo no se guarda; el resumen de "faltantes" se muestra porque intentoEnvio ya es true
    if (this.faltantes().length > 0) return;

    await submit(this.funcionForm, async () => {
      const m = this.model();

      try {
        this.cargando.set(true);
        const hora = dateAHora(this.hora()!);
        const fechas = this.modoVarias() ? this.fechasGeneradas() : [this.diaUnico()];

        // Sacar días de una serie cancela esas funciones: si tenían entradas vendidas, el admin lo confirma
        if (this.esEdicion() && this.modoVarias() && !(await this.confirmarCancelaciones(fechas))) return;

        if (this.esEdicion()) {
          await this.funcionService.modificarVarias({
            ...m,
            funcion_id: this.funcionBase()!.id,
            alcance: this.alcance(),
            fechas,
            hora,
          });
        } else {
          await this.funcionService.crearVarias({ ...m, fechas, hora });
        }

        this.funcionForm().reset();
        this.router.navigate(['/admin/funciones']);
      } catch (e: any) {
        this.errorMsg.set(e?.message ?? 'No se pudo guardar la función');
      } finally {
        this.cargando.set(false);
      }
    });
  }
}
