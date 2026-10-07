import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { ConfirmarSalida, confirmarDescartar } from '../../../../guards/salida-guard';
import { CategoriaProductoService } from '../../../../services/categoria-producto-service';
import { CategoriaProductoModel } from '../../../../modelos/producto-model';
import { EstadoCategoriaPipe } from '../../../../pipes/producto/producto.pipes';

// Categorías del candy (pochoclos, bebidas, etc.). Una categoría inactiva oculta al cliente todos sus productos.
// No se puede eliminar una categoría que tenga productos: la base lo impide y se la desactiva.
@Component({
  imports: [FormField, RouterLink, EstadoCategoriaPipe],
  selector: 'app-categorias-producto',
  styleUrl: './categorias.css',
  templateUrl: './categorias.html',
})
export class Categorias implements OnInit, ConfirmarSalida {
  private categoriaService = inject(CategoriaProductoService);

  categorias = signal<CategoriaProductoModel[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  errorMsg = signal('');
  okMsg = signal('');
  intentoEnvio = signal(false);

  // El orden va como texto para validarlo y avisar en el resumen
  private model = signal({ nombre: '', orden: '0', activa: true });
  categoriaForm = form(this.model);
  editandoId = signal<string | null>(null);

  faltantes = computed<string[]>(() => {
    const m = this.model();
    const faltan: string[] = [];

    if (!m.nombre.trim()) faltan.push('Ingresá un nombre para la categoría');
    if (m.nombre.trim().length > 50) faltan.push('El nombre no puede pasar los 50 caracteres');

    const orden = this.aNumero(m.orden);
    if (orden === null || !Number.isInteger(orden) || orden < 0) {
      faltan.push('El orden tiene que ser un número entero, 0 o mayor');
    }

    return faltan;
  });

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      this.categorias.set(await this.categoriaService.getAll());
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las categorías');
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

  editar(categoria: CategoriaProductoModel) {
    this.editandoId.set(categoria.id);
    this.intentoEnvio.set(false);
    this.errorMsg.set('');
    this.okMsg.set('');
    this.model.set({ nombre: categoria.nombre, orden: String(categoria.orden), activa: categoria.activa });
  }

  cancelarEdicion() {
    this.editandoId.set(null);
    this.intentoEnvio.set(false);
    this.model.set({ nombre: '', orden: '0', activa: true });
    this.categoriaForm().reset();
  }

  // canDeactivate: si el formulario tiene cambios sin guardar, se pide confirmación antes de salir
  puedeSalir(): boolean {
    return confirmarDescartar(this.categoriaForm().dirty());
  }

  async guardarCategoria(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.okMsg.set('');
    this.intentoEnvio.set(true);
    if (this.faltantes().length > 0) return;

    const m = this.model();
    const payload = { nombre: m.nombre.trim(), orden: this.aNumero(m.orden)!, activa: m.activa };

    await this.guardar(async () => {
      const id = this.editandoId();
      if (id) await this.categoriaService.modificar(id, payload);
      else await this.categoriaService.crear(payload);

      this.okMsg.set(id ? 'Se modificó la categoría.' : 'Se creó la categoría.');
      this.cancelarEdicion();
    });
  }

  async alternarActiva(categoria: CategoriaProductoModel) {
    this.errorMsg.set('');
    this.okMsg.set('');
    await this.guardar(async () => {
      await this.categoriaService.modificar(categoria.id, {
        nombre: categoria.nombre,
        orden: categoria.orden,
        activa: !categoria.activa,
      });
    });
  }

  async eliminar(categoria: CategoriaProductoModel) {
    if (!confirm(`¿Eliminar la categoría ${categoria.nombre}?`)) return;

    this.errorMsg.set('');
    this.okMsg.set('');
    await this.guardar(async () => {
      await this.categoriaService.eliminar(categoria.id);
      if (this.editandoId() === categoria.id) this.cancelarEdicion();
    });
  }

  // Ejecuta un guardado, maneja el estado de "guardando" y los errores, y recarga la lista
  private async guardar(accion: () => Promise<void>) {
    this.guardando.set(true);
    try {
      await accion();
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo guardar la categoría');
    } finally {
      this.guardando.set(false);
    }
  }
}
