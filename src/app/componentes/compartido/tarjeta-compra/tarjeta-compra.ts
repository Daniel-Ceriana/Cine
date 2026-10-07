import { Component, computed, input, output, signal } from '@angular/core';
import { CompraDetalle } from '../../../modelos/compra-model';
import { BUTACAS } from '../../../modelos/sala-plantilla';
import { descargarEntradaPdf, generarQr } from '../../../utilidades/entrada-pdf';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { DiaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { FormatoSalaPipe } from '../../../pipes/sala/sala.pipes';
import { IdiomaFuncionPipe } from '../../../pipes/funcion/idioma-funcion.pipe';
import { EstadoCompraPipe } from '../../../pipes/compra/estado-compra.pipe';

// Una compra ya pagada: resumen, QR y código para presentar, descarga del PDF y, si corresponde, cancelación.
// La usan "Mis compras" (con cuenta) y "Mi entrada" (quien compró sin cuenta, que no puede cancelar).
@Component({
  selector: 'app-tarjeta-compra',
  imports: [PesosPipe, DiaArPipe, HoraArPipe, FormatoSalaPipe, IdiomaFuncionPipe, EstadoCompraPipe],
  styleUrl: './tarjeta-compra.css',
  templateUrl: './tarjeta-compra.html',
})
export class TarjetaCompra {
  compra = input.required<CompraDetalle>();
  puedeCancelar = input(false); // solo con cuenta: el crédito se acredita en la cuenta
  horasCancelacion = input(2); // se cancela hasta estas horas antes de la función
  cancelando = input(false);
  cancelar = output<CompraDetalle>();

  verEntrada = signal(false);
  qrUrl = signal('');
  descargando = signal(false);
  errorMsg = signal('');

  butacas = computed(() => this.compra().compra_butacas.map((b) => b.butaca_codigo).sort());
  restriccion = computed(() => this.compra().funciones.peliculas.restriccion_edad);

  // Candy de la compra: primero los combos y después los productos sueltos, sumando lo pagado en dinero y lo
  // canjeado con puntos. Los productos que vinieron dentro de un combo no se repiten: ya están en el combo.
  productos = computed(() => {
    const porNombre = new Map<string, number>();
    for (const c of this.compra().compra_combos ?? []) {
      porNombre.set(c.nombre, (porNombre.get(c.nombre) ?? 0) + c.cantidad);
    }
    for (const i of (this.compra().compra_items ?? []).filter((x) => !x.combo_nombre)) {
      porNombre.set(i.nombre, (porNombre.get(i.nombre) ?? 0) + i.cantidad);
    }
    return [...porNombre].map(([nombre, cantidad]) => ({ nombre, cantidad }));
  });

  // Cuándo deja de poder cancelarse (se ve en pantalla)
  limiteCancelacion = computed(
    () => new Date(new Date(this.compra().funciones.inicio).getTime() - this.horasCancelacion() * 3_600_000),
  );

  // Por qué no se puede cancelar (null = se puede). La base vuelve a controlarlo al cancelar.
  motivoNoCancelable = computed<string | null>(() => {
    const c = this.compra();
    if (c.estado !== 'pagada') return null; // si ya está cancelada no hace falta explicar nada
    if (c.entrada_validada_at || c.candy_entregado_at) return 'La entrada o el candy ya fueron utilizados.';
    if (this.limiteCancelacion().getTime() <= Date.now()) {
      return `Ya no se puede cancelar: solo hasta ${this.horasCancelacion()} horas antes de la función.`;
    }
    return null;
  });

  async alternarEntrada() {
    this.verEntrada.update((v) => !v);
    if (this.verEntrada() && !this.qrUrl()) {
      this.qrUrl.set(await generarQr(this.compra().codigo).catch(() => ''));
    }
  }

  async descargarPdf() {
    const c = this.compra();
    this.descargando.set(true);
    this.errorMsg.set('');
    try {
      await descargarEntradaPdf({
        codigo: c.codigo,
        pelicula: c.funciones.peliculas.nombre,
        inicio: c.funciones.inicio,
        salaNumero: c.funciones.salas.numero,
        formato: c.funciones.salas.formato,
        idioma: c.funciones.idioma,
        butacas: this.butacas().map((codigo) => ({
          codigo,
          tipo: BUTACAS.find((b) => b.codigo === codigo)?.tipo ?? 'normal',
        })),
        productos: this.productos(),
        comprador: c.nombre,
        total: c.total,
        restriccionEdad: this.restriccion(),
      });
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo generar el PDF');
    } finally {
      this.descargando.set(false);
    }
  }

  pedirCancelacion() {
    const c = this.compra();
    const texto =
      `¿Cancelar la compra para ${c.funciones.peliculas.nombre}? ` +
      `No se devuelve dinero: se acreditan ${c.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} de crédito en tu cuenta.`;
    if (confirm(texto)) this.cancelar.emit(c);
  }
}
