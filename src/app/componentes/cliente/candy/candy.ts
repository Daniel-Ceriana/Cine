import { Component, input, output } from '@angular/core';
import { CategoriaConProductos, ProductoModel } from '../../../modelos/producto-model';
import { ComboConItems, ItemComboCarrito } from '../../../modelos/combo-model';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';

// Un producto elegido: cuántas unidades en total y cuántas de ellas se pagan con puntos
export interface ItemCarrito {
  producto: ProductoModel;
  cantidad: number;
  conPuntos: number;
}

// Paso opcional de la compra: el cliente suma combos y productos del candy a su entrada.
// Solo muestra el catálogo y avisa qué cambió: el carrito y los totales los lleva la pantalla de compra.
// (La base vuelve a validar todo al reservar: productos activos, cantidades, saldo de puntos.)
@Component({
  imports: [PesosPipe],
  selector: 'app-candy',
  styleUrl: './candy.css',
  templateUrl: './candy.html',
})
export class Candy {
  catalogo = input.required<CategoriaConProductos[]>();
  carrito = input.required<ItemCarrito[]>();
  maxUnidades = input(10); // configuracion.max_unidades_candy
  puedeCanjear = input(false); // el canje con puntos necesita cuenta
  puntosDisponibles = input(0); // saldo que todavía no está comprometido en esta compra
  combos = input<ComboConItems[]>([]); // combos activos (los destacados vienen primero)
  carritoCombos = input<ItemComboCarrito[]>([]);
  butacasLibres = input(0); // butacas de la compra que todavía puede cubrir un combo
  precioEntrada = input(0); // precio de la entrada de esta función (para mostrar cuánto se ahorra)

  cambio = output<ItemCarrito>(); // cantidad 0 = sacar el producto del carrito
  cambioCombo = output<ItemComboCarrito>(); // cantidad 0 = sacar el combo del carrito

  cantidadDe(p: ProductoModel): number {
    return this.carrito().find((i) => i.producto.id === p.id)?.cantidad ?? 0;
  }

  conPuntosDe(p: ProductoModel): number {
    return this.carrito().find((i) => i.producto.id === p.id)?.conPuntos ?? 0;
  }

  // ---- Combos ----
  cantidadCombo(c: ComboConItems): number {
    return this.carritoCombos().find((i) => i.combo.id === c.id)?.cantidad ?? 0;
  }

  // Cada combo cubre sus entradas con butacas de la compra que no se paguen con puntos ni estén cubiertas por otro combo
  puedeSumarCombo(c: ComboConItems): boolean {
    return this.butacasLibres() >= c.cantidad_entradas && this.cantidadCombo(c) < this.maxUnidades();
  }

  sumarCombo(c: ComboConItems) {
    if (!this.puedeSumarCombo(c)) return;
    this.cambioCombo.emit({ combo: c, cantidad: this.cantidadCombo(c) + 1 });
  }

  restarCombo(c: ComboConItems) {
    if (this.cantidadCombo(c) === 0) return;
    this.cambioCombo.emit({ combo: c, cantidad: this.cantidadCombo(c) - 1 });
  }

  // Lo que costaría todo por separado: las entradas y cada producto
  valorSuelto(c: ComboConItems): number {
    const productos = c.combo_items.reduce((suma, i) => suma + i.cantidad * i.productos.precio, 0);
    return c.cantidad_entradas * this.precioEntrada() + productos;
  }

  // Solo se muestra si es mayor a 0: con un precio mayor al valor suelto no hay cartel de ahorro
  ahorro(c: ComboConItems): number {
    return this.valorSuelto(c) - c.precio;
  }

  sePuedeCanjear(p: ProductoModel): boolean {
    return this.puedeCanjear() && p.costo_puntos !== null;
  }

  // ¿alcanzan los puntos para canjear una unidad más? (y hay unidades sin canjear)
  puedeSumarPuntos(p: ProductoModel): boolean {
    return (
      this.conPuntosDe(p) < this.cantidadDe(p) && this.puntosDisponibles() >= (p.costo_puntos ?? Infinity)
    );
  }

  sumar(p: ProductoModel) {
    if (this.cantidadDe(p) >= this.maxUnidades()) return;
    this.cambio.emit({ producto: p, cantidad: this.cantidadDe(p) + 1, conPuntos: this.conPuntosDe(p) });
  }

  restar(p: ProductoModel) {
    const cantidad = this.cantidadDe(p) - 1;
    if (cantidad < 0) return;
    // si quedan menos unidades que las canjeadas, se baja también el canje
    this.cambio.emit({ producto: p, cantidad, conPuntos: Math.min(this.conPuntosDe(p), cantidad) });
  }

  sumarPuntos(p: ProductoModel) {
    if (!this.puedeSumarPuntos(p)) return;
    this.cambio.emit({ producto: p, cantidad: this.cantidadDe(p), conPuntos: this.conPuntosDe(p) + 1 });
  }

  restarPuntos(p: ProductoModel) {
    if (this.conPuntosDe(p) === 0) return;
    this.cambio.emit({ producto: p, cantidad: this.cantidadDe(p), conPuntos: this.conPuntosDe(p) - 1 });
  }
}
