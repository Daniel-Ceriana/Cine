import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ConfirmarSalida, confirmarDescartar } from '../../../guards/salida-guard';
import { CuponService } from '../../../services/cupon-service';
import { CuponModel } from '../../../modelos/cupon-model';

// Administración de cupones. Hay dos clases:
//  * Primera compra: es único (siempre hay uno) y solo se le cambia el porcentaje o se lo activa/desactiva.
//  * Por rango de edad: se pueden crear varios (ej.: 60% para mayores de 50).
// Al comprar, el sistema aplica solo el de mayor descuento que le corresponda a la cuenta.
@Component({
  imports: [FormField],
  selector: 'app-cupones',
  styleUrl: './cupones.css',
  templateUrl: './cupones.html',
})
export class Cupones implements OnInit, ConfirmarSalida {
  private cuponService = inject(CuponService);

  cupones = signal<CuponModel[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  errorMsg = signal('');
  okMsg = signal('');
  intentoEnvio = signal(false);

  primera = computed(() => this.cupones().find((c) => c.tipo === 'primera_compra') ?? null);
  porEdad = computed(() => this.cupones().filter((c) => c.tipo === 'rango_edad'));

  // ---- Primera compra ----
  porcentajePrimera = signal('');
  activoPrimera = signal(true);

  // ---- Cupón por rango de edad (alta y modificación) ----
  // Los números van como texto para poder dejar "hasta" vacío (= sin tope)
  private model = signal({ nombre: '', edad_min: '', edad_max: '', porcentaje: '', activo: true });
  cuponForm = form(this.model);
  editandoId = signal<string | null>(null);

  faltantes = computed<string[]>(() => {
    const m = this.model();
    const faltan: string[] = [];

    if (!m.nombre.trim()) faltan.push('Ingresá un nombre para el cupón');

    const min = this.aNumero(m.edad_min);
    const max = this.aNumero(m.edad_max);
    if (min === null || !Number.isInteger(min) || min < 0) faltan.push('Ingresá la edad desde la que aplica (número entero)');
    if (m.edad_max.trim() !== '' && (max === null || !Number.isInteger(max))) {
      faltan.push('La edad "hasta" tiene que ser un número entero (o dejarla vacía si no tiene tope)');
    } else if (min !== null && max !== null && max < min) {
      faltan.push('La edad "hasta" no puede ser menor que la edad "desde"');
    }

    const pct = this.aNumero(m.porcentaje);
    if (pct === null || pct <= 0 || pct > 100) faltan.push('El descuento tiene que ser un porcentaje entre 1 y 100');

    return faltan;
  });

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      this.cupones.set(await this.cuponService.getAll());
      const p = this.primera();
      if (p) {
        this.porcentajePrimera.set(String(p.porcentaje));
        this.activoPrimera.set(p.activo);
      }
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar los cupones');
    } finally {
      this.cargando.set(false);
    }
  }

  private aNumero(texto: string): number | null {
    const limpio = texto.trim().replace(',', '.');
    if (limpio === '') return null;
    const n = Number(limpio);
    return Number.isNaN(n) ? null : n;
  }

  // ---------- Primera compra ----------
  async guardarPrimera() {
    const cupon = this.primera();
    if (!cupon) return;

    this.errorMsg.set('');
    this.okMsg.set('');
    const pct = this.aNumero(this.porcentajePrimera());
    if (pct === null || pct <= 0 || pct > 100) {
      this.errorMsg.set('El descuento de la primera compra tiene que ser un porcentaje entre 1 y 100');
      return;
    }

    await this.guardar(async () => {
      await this.cuponService.modificar(cupon.id, {
        nombre: cupon.nombre,
        tipo: 'primera_compra',
        porcentaje: pct,
        edad_min: null,
        edad_max: null,
        activo: this.activoPrimera(),
      });
      this.okMsg.set('Se guardó el cupón de primera compra.');
    });
  }

  // ---------- Cupones por edad ----------
  editar(cupon: CuponModel) {
    this.editandoId.set(cupon.id);
    this.intentoEnvio.set(false);
    this.errorMsg.set('');
    this.okMsg.set('');
    this.model.set({
      nombre: cupon.nombre,
      edad_min: String(cupon.edad_min ?? ''),
      edad_max: cupon.edad_max === null ? '' : String(cupon.edad_max),
      porcentaje: String(cupon.porcentaje),
      activo: cupon.activo,
    });
  }

  cancelarEdicion() {
    this.editandoId.set(null);
    this.intentoEnvio.set(false);
    this.model.set({ nombre: '', edad_min: '', edad_max: '', porcentaje: '', activo: true });
    this.cuponForm().reset();
  }

  // canDeactivate: si el formulario tiene cambios sin guardar, se pide confirmación antes de salir
  puedeSalir(): boolean {
    return confirmarDescartar(this.cuponForm().dirty());
  }


  async guardarPorEdad(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.okMsg.set('');
    this.intentoEnvio.set(true);
    if (this.faltantes().length > 0) return;

    const m = this.model();
    const payload = {
      nombre: m.nombre.trim(),
      tipo: 'rango_edad' as const,
      porcentaje: this.aNumero(m.porcentaje)!,
      edad_min: this.aNumero(m.edad_min)!,
      edad_max: this.aNumero(m.edad_max),
      activo: m.activo,
    };

    await this.guardar(async () => {
      const id = this.editandoId();
      if (id) await this.cuponService.modificar(id, payload);
      else await this.cuponService.crear(payload);

      this.okMsg.set(id ? 'Se modificó el cupón.' : 'Se creó el cupón.');
      this.cancelarEdicion();
    });
  }

  async alternarActivo(cupon: CuponModel) {
    this.errorMsg.set('');
    this.okMsg.set('');
    await this.guardar(async () => {
      await this.cuponService.modificar(cupon.id, {
        nombre: cupon.nombre,
        tipo: cupon.tipo,
        porcentaje: cupon.porcentaje,
        edad_min: cupon.edad_min,
        edad_max: cupon.edad_max,
        activo: !cupon.activo,
      });
    });
  }

  // Ejecuta un guardado, maneja el estado de "guardando" y los errores, y recarga la lista
  private async guardar(accion: () => Promise<void>) {
    this.guardando.set(true);
    try {
      await accion();
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo guardar el cupón');
    } finally {
      this.guardando.set(false);
    }
  }

  // '51 años en adelante' / 'de 18 a 25 años'
  rango(c: CuponModel): string {
    if (c.edad_max === null) return `${c.edad_min} años en adelante`;
    return `de ${c.edad_min} a ${c.edad_max} años`;
  }
}
