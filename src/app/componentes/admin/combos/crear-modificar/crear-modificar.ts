import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { ConfirmarSalida, confirmarDescartar } from '../../../../guards/salida-guard';
import { ComboService } from '../../../../services/combo-service';
import { ProductoService } from '../../../../services/producto-service';
import { ProductoModel } from '../../../../modelos/producto-model';
import { PesosPipe } from '../../../../pipes/comunes/pesos.pipe';

// Un renglón del combo: qué producto y cuántas unidades (texto, para poder validarlo y avisar en el resumen)
interface RenglonCombo {
  producto_id: string;
  cantidad: string;
}

@Component({
  imports: [FormField, PesosPipe],
  selector: 'app-crear-modificar-combo',
  styleUrls: ['../../../compartido/stylesCompartidos/forms.css', './crear-modificar.css'],
  templateUrl: './crear-modificar.html',
})
export class CrearModificarCombo implements OnInit, ConfirmarSalida {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private comboService = inject(ComboService);
  private productoService = inject(ProductoService);

  errorMsg = signal('');
  cargando = signal(false);
  guardando = signal(false);
  intentoEnvio = signal(false);

  comboId = signal<string | null>(null);
  esEdicion = computed(() => this.comboId() !== null);

  productos = signal<ProductoModel[]>([]);
  renglones = signal<RenglonCombo[]>([{ producto_id: '', cantidad: '1' }]);
  renglonesModificados = signal(false); // los renglones no son parte del formulario: se avisa aparte si cambiaron

  // La imagen es obligatoria: al modificar alcanza con la que ya tenía, al crear hay que elegir una
  private imagenActual = signal('');
  archivoSeleccionado = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  // Precio de entrada de referencia (la función futura más barata) para comparar con el precio del combo
  precioEntradaReferencia = signal<number | null>(null);

  // Los números van como texto para poder validarlos y mostrar el aviso en el resumen
  private model = signal({
    nombre: '',
    descripcion: '',
    precio: '',
    cantidad_entradas: '1',
    orden: '0',
    activo: true,
    destacado: false,
  });
  comboForm = form(this.model);

  // Valor "suelto" de lo que incluye el combo: las entradas (al precio de referencia) y los productos
  valorProductos = computed(() =>
    this.renglones().reduce((suma, r) => {
      const producto = this.productos().find((p) => p.id === r.producto_id);
      const cantidad = this.aNumero(r.cantidad);
      return suma + (producto && cantidad && cantidad > 0 ? producto.precio * cantidad : 0);
    }, 0),
  );
  valorEntradas = computed(() => {
    const n = this.aNumero(this.model().cantidad_entradas);
    return n && n > 0 ? n * (this.precioEntradaReferencia() ?? 0) : 0;
  });
  valorSuelto = computed(() => this.valorProductos() + this.valorEntradas());

  // Aviso (no impide guardar): con un precio mayor al valor de lo que incluye, el cliente no verá "Ahorrás"
  precioMayorAlValor = computed(() => {
    const precio = this.aNumero(this.model().precio);
    return precio !== null && precio > 0 && this.valorSuelto() > 0 && precio > this.valorSuelto();
  });

  faltantes = computed<string[]>(() => {
    const m = this.model();
    const faltan: string[] = [];

    if (m.nombre.trim().length < 2) faltan.push('Ingresá un nombre (mínimo 2 caracteres)');
    if (m.nombre.trim().length > 100) faltan.push('El nombre no puede pasar los 100 caracteres');
    if (m.descripcion.trim().length > 300) faltan.push('La descripción no puede pasar los 300 caracteres');

    const precio = this.aNumero(m.precio);
    if (precio === null || precio <= 0) faltan.push('Ingresá un precio mayor a 0');

    const entradas = this.aNumero(m.cantidad_entradas);
    if (entradas === null || !Number.isInteger(entradas) || entradas < 1) {
      faltan.push('La cantidad de entradas tiene que ser un número entero, 1 o más');
    }

    const orden = this.aNumero(m.orden);
    if (orden === null || !Number.isInteger(orden) || orden < 0) {
      faltan.push('El orden tiene que ser un número entero, 0 o mayor');
    }

    const renglones = this.renglones();
    if (renglones.some((r) => !r.producto_id)) {
      faltan.push('Elegí un producto en cada renglón (o quitá los renglones vacíos)');
    } else if (renglones.length === 0) {
      faltan.push('El combo tiene que incluir al menos un producto');
    }
    if (renglones.some((r) => {
      const c = this.aNumero(r.cantidad);
      return c === null || !Number.isInteger(c) || c < 1;
    })) {
      faltan.push('La cantidad de cada producto tiene que ser un número entero, 1 o más');
    }
    const ids = renglones.map((r) => r.producto_id).filter((id) => id);
    if (new Set(ids).size !== ids.length) faltan.push('Hay productos repetidos: sumá las unidades en un solo renglón');

    if (!this.archivoSeleccionado() && !this.imagenActual()) faltan.push('Elegí una imagen del combo');

    return faltan;
  });

  async ngOnInit() {
    this.cargando.set(true);
    try {
      const [productos, referencia] = await Promise.all([
        this.productoService.getAll(),
        this.comboService.getPrecioEntradaReferencia().catch(() => null),
      ]);
      this.productos.set(productos);
      this.precioEntradaReferencia.set(referencia);

      const id = this.route.snapshot.queryParamMap.get('id');
      if (!id) return;

      this.comboId.set(id);
      const combo = await this.comboService.getById(id);
      this.model.set({
        nombre: combo.nombre,
        descripcion: combo.descripcion ?? '',
        precio: String(combo.precio),
        cantidad_entradas: String(combo.cantidad_entradas),
        orden: String(combo.orden),
        activo: combo.activo,
        destacado: combo.destacado,
      });
      this.renglones.set(combo.combo_items.map((i) => ({ producto_id: i.producto_id, cantidad: String(i.cantidad) })));
      this.imagenActual.set(combo.imagen_url);
      this.previewUrl.set(combo.imagen_url);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar el combo');
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

  // ---- Productos del combo ----
  agregarRenglon() {
    this.renglones.update((r) => [...r, { producto_id: '', cantidad: '1' }]);
    this.renglonesModificados.set(true);
  }

  quitarRenglon(indice: number) {
    this.renglones.update((r) => r.filter((_, i) => i !== indice));
    this.renglonesModificados.set(true);
  }

  cambiarRenglon(indice: number, cambios: Partial<RenglonCombo>) {
    this.renglones.update((r) => r.map((x, i) => (i === indice ? { ...x, ...cambios } : x)));
    this.renglonesModificados.set(true);
  }

  // canDeactivate: el formulario, los productos o la imagen elegida cuentan como cambios sin guardar
  puedeSalir(): boolean {
    return confirmarDescartar(
      this.comboForm().dirty() || this.renglonesModificados() || this.archivoSeleccionado() !== null,
    );
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.archivoSeleccionado.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.intentoEnvio.set(true);
    if (this.faltantes().length > 0) return;

    this.guardando.set(true);
    try {
      const m = this.model();

      let imagenUrl = this.imagenActual();
      const archivo = this.archivoSeleccionado();
      if (archivo) imagenUrl = await this.comboService.subirImagen(archivo);

      await this.comboService.guardar(
        this.comboId(),
        {
          nombre: m.nombre.trim(),
          descripcion: m.descripcion.trim() || null,
          imagen_url: imagenUrl,
          precio: this.aNumero(m.precio)!,
          cantidad_entradas: this.aNumero(m.cantidad_entradas)!,
          orden: this.aNumero(m.orden)!,
          activo: m.activo,
          destacado: m.destacado,
        },
        this.renglones().map((r) => ({ producto_id: r.producto_id, cantidad: this.aNumero(r.cantidad)! })),
      );

      this.comboForm().reset();
      this.renglonesModificados.set(false);
      this.archivoSeleccionado.set(null);
      this.router.navigate(['/admin/combos']);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo guardar el combo');
    } finally {
      this.guardando.set(false);
    }
  }
}
