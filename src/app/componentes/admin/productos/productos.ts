import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuCrearVer } from '../generico/menu-crear-ver/menu-crear-ver';
import { ProductoService } from '../../../services/producto-service';
import { CategoriaProductoService } from '../../../services/categoria-producto-service';
import { CategoriaProductoModel, ProductoModel } from '../../../modelos/producto-model';
import { EstadoProductoPipe, EstadoCategoriaPipe } from '../../../pipes/producto/producto.pipes';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { FiltrarPipe } from '../../../pipes/comunes/filtrar.pipe';

// Catálogo del candy para el admin: los productos agrupados por categoría (en el orden que definió el admin).
@Component({
  imports: [MenuCrearVer, RouterLink, EstadoProductoPipe, EstadoCategoriaPipe, PesosPipe, FiltrarPipe],
  selector: 'app-productos',
  styleUrl: './productos.css',
  templateUrl: './productos.html',
})
export class Productos implements OnInit {
  private productoService = inject(ProductoService);
  private categoriaService = inject(CategoriaProductoService);
  private router = inject(Router);

  productos = signal<ProductoModel[]>([]);
  categorias = signal<CategoriaProductoModel[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  errorMsg = signal('');

  // id de categoría -> sus productos (ya vienen ordenados de la base)
  porCategoria = computed(() => {
    const mapa = new Map<string, ProductoModel[]>();
    for (const p of this.productos()) {
      mapa.set(p.categoria_id, [...(mapa.get(p.categoria_id) ?? []), p]);
    }
    return mapa;
  });

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      const [productos, categorias] = await Promise.all([
        this.productoService.getAll(),
        this.categoriaService.getAll(),
      ]);
      this.productos.set(productos);
      this.categorias.set(categorias);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar el catálogo');
    } finally {
      this.cargando.set(false);
    }
  }

  onClickModificar(producto: ProductoModel) {
    this.router.navigate(['/admin/productos/crear'], { queryParams: { id: producto.id } });
  }

  async alternarActivo(producto: ProductoModel) {
    this.errorMsg.set('');
    try {
      const { id, created_at, ...payload } = producto;
      await this.productoService.modificar(id, { ...payload, activo: !producto.activo });
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cambiar el estado del producto');
    }
  }

  async eliminar(producto: ProductoModel) {
    if (!confirm(`¿Eliminar ${producto.nombre}?`)) return;

    this.errorMsg.set('');
    try {
      await this.productoService.eliminar(producto.id);
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo eliminar el producto');
    }
  }
}
