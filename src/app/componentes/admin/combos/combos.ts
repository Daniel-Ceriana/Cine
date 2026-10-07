import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuCrearVer } from '../generico/menu-crear-ver/menu-crear-ver';
import { ComboService } from '../../../services/combo-service';
import { ComboConItems } from '../../../modelos/combo-model';
import { EstadoProductoPipe } from '../../../pipes/producto/producto.pipes';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { FiltrarPipe } from '../../../pipes/comunes/filtrar.pipe';

// Combos del candy para el admin: una entrada (o más) y productos a un precio fijo.
@Component({
  imports: [MenuCrearVer, EstadoProductoPipe, PesosPipe, FiltrarPipe],
  selector: 'app-combos',
  styleUrl: './combos.css',
  templateUrl: './combos.html',
})
export class Combos implements OnInit {
  private comboService = inject(ComboService);
  private router = inject(Router);

  combos = signal<ComboConItems[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  errorMsg = signal('');

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      this.combos.set(await this.comboService.getAll());
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar los combos');
    } finally {
      this.cargando.set(false);
    }
  }

  // '1 entrada' / '2 entradas'
  entradas(combo: ComboConItems): string {
    return `${combo.cantidad_entradas} ${combo.cantidad_entradas === 1 ? 'entrada' : 'entradas'}`;
  }

  // El cliente no ve un combo si alguno de sus productos (o la categoría del producto) está inactivo
  tieneProductosInactivos(combo: ComboConItems): boolean {
    return combo.combo_items.some((i) => !i.productos.activo || !i.productos.categorias_producto?.activa);
  }

  onClickModificar(combo: ComboConItems) {
    this.router.navigate(['/admin/combos/crear'], { queryParams: { id: combo.id } });
  }

  async alternarActivo(combo: ComboConItems) {
    this.errorMsg.set('');
    try {
      await this.comboService.cambiarActivo(combo.id, !combo.activo);
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cambiar el estado del combo');
    }
  }

  async eliminar(combo: ComboConItems) {
    if (!confirm(`¿Eliminar el combo ${combo.nombre}?`)) return;

    this.errorMsg.set('');
    try {
      await this.comboService.eliminar(combo.id);
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo eliminar el combo');
    }
  }
}
