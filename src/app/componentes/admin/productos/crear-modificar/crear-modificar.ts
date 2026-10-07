import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { ConfirmarSalida, confirmarDescartar } from '../../../../guards/salida-guard';
import { ProductoService } from '../../../../services/producto-service';
import { CategoriaProductoService } from '../../../../services/categoria-producto-service';
import { CategoriaProductoModel } from '../../../../modelos/producto-model';

@Component({
  imports: [FormField, RouterLink],
  selector: 'app-crear-modificar-producto',
  styleUrls: ['../../../compartido/stylesCompartidos/forms.css', './crear-modificar.css'],
  templateUrl: './crear-modificar.html',
})
export class CrearModificarProducto implements OnInit, ConfirmarSalida {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private productoService = inject(ProductoService);
  private categoriaService = inject(CategoriaProductoService);

  errorMsg = signal('');
  cargando = signal(false);
  guardando = signal(false);
  intentoEnvio = signal(false);

  productoId = signal<string | null>(null);
  esEdicion = computed(() => this.productoId() !== null);

  categorias = signal<CategoriaProductoModel[]>([]);

  // La imagen es obligatoria: al modificar alcanza con la que ya tenía, al crear hay que elegir una
  private imagenActual = signal('');
  archivoSeleccionado = signal<File | null>(null);
  previewUrl = signal<string | null>(null);

  // Los números van como texto para poder validarlos y mostrar el aviso en el resumen
  private model = signal({
    nombre: '',
    descripcion: '',
    precio: '',
    costo_puntos: '',
    categoria_id: '',
    orden: '0',
    activo: true,
  });
  productoForm = form(this.model);

  faltantes = computed<string[]>(() => {
    const m = this.model();
    const faltan: string[] = [];

    if (m.nombre.trim().length < 2) faltan.push('Ingresá un nombre (mínimo 2 caracteres)');
    if (m.nombre.trim().length > 100) faltan.push('El nombre no puede pasar los 100 caracteres');
    if (m.descripcion.trim().length > 300) faltan.push('La descripción no puede pasar los 300 caracteres');

    const precio = this.aNumero(m.precio);
    if (precio === null || precio <= 0) faltan.push('Ingresá un precio mayor a 0');

    // Opcional: vacío = el producto no se puede canjear por puntos
    const puntos = this.aNumero(m.costo_puntos);
    if (m.costo_puntos.trim() !== '' && (puntos === null || !Number.isInteger(puntos) || puntos <= 0)) {
      faltan.push('El costo en puntos tiene que ser un número entero mayor a 0 (o dejarlo vacío si no se canjea)');
    }

    if (!m.categoria_id) faltan.push('Elegí una categoría');

    const orden = this.aNumero(m.orden);
    if (orden === null || !Number.isInteger(orden) || orden < 0) {
      faltan.push('El orden tiene que ser un número entero, 0 o mayor');
    }

    if (!this.archivoSeleccionado() && !this.imagenActual()) faltan.push('Elegí una imagen del producto');

    return faltan;
  });

  async ngOnInit() {
    this.cargando.set(true);
    try {
      this.categorias.set(await this.categoriaService.getAll());

      const id = this.route.snapshot.queryParamMap.get('id');
      if (!id) return;

      this.productoId.set(id);
      const producto = await this.productoService.getById(id);
      this.model.set({
        nombre: producto.nombre,
        descripcion: producto.descripcion ?? '',
        precio: String(producto.precio),
        costo_puntos: producto.costo_puntos === null ? '' : String(producto.costo_puntos),
        categoria_id: producto.categoria_id,
        orden: String(producto.orden),
        activo: producto.activo,
      });
      this.imagenActual.set(producto.imagen_url);
      this.previewUrl.set(producto.imagen_url);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar el producto');
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

  // canDeactivate: el formulario o la imagen elegida cuentan como cambios sin guardar
  puedeSalir(): boolean {
    return confirmarDescartar(this.productoForm().dirty() || this.archivoSeleccionado() !== null);
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
      if (archivo) imagenUrl = await this.productoService.subirImagen(archivo);

      const payload = {
        nombre: m.nombre.trim(),
        descripcion: m.descripcion.trim() || null,
        precio: this.aNumero(m.precio)!,
        costo_puntos: this.aNumero(m.costo_puntos),
        categoria_id: m.categoria_id,
        imagen_url: imagenUrl,
        orden: this.aNumero(m.orden)!,
        activo: m.activo,
      };

      if (this.esEdicion()) await this.productoService.modificar(this.productoId()!, payload);
      else await this.productoService.crear(payload);

      this.productoForm().reset();
      this.archivoSeleccionado.set(null);
      this.router.navigate(['/admin/productos']);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo guardar el producto');
    } finally {
      this.guardando.set(false);
    }
  }
}
