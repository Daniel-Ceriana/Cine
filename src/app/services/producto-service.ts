import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { CategoriaConProductos, ProductoModel, ProductoPayload } from '../modelos/producto-model';
import { subirImagen } from '../utilidades/subir-imagen';

@Service()
export class ProductoService {
  private supabase = inject(SupabaseService);
  private tabla = 'productos';

  async getById(id: string): Promise<ProductoModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ProductoModel;
  }

  // Para el admin: todos los productos, activos o no
  async getAll(): Promise<ProductoModel[]> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select('*')
      .order('orden')
      .order('nombre');

    if (error) throw error;
    return data as ProductoModel[];
  }

  // Para el cliente (se usa en la compra de candy): solo productos activos de categorías activas,
  // agrupados por categoría y en el orden que definió el admin
  async getCatalogoActivo(): Promise<CategoriaConProductos[]> {
    const { data, error } = await this.supabase.client
      .from('categorias_producto')
      .select('*, productos(*)')
      .eq('activa', true)
      .eq('productos.activo', true)
      .order('orden')
      .order('orden', { referencedTable: 'productos' })
      .order('nombre', { referencedTable: 'productos' });

    if (error) throw error;
    // el filtro de productos no descarta la categoría, solo vacía su lista: las vacías no se muestran
    return (data as CategoriaConProductos[]).filter((c) => c.productos.length > 0);
  }

  async crear(payload: ProductoPayload): Promise<ProductoModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .insert(payload)
      .select()
      .single();

    this.lanzarSiHayError(error);
    return data as ProductoModel;
  }

  async modificar(id: string, payload: ProductoPayload): Promise<ProductoModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    this.lanzarSiHayError(error);
    return data as ProductoModel;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(this.tabla).delete().eq('id', id);
    this.lanzarSiHayError(error);
  }

  subirImagen(file: File): Promise<string> {
    return subirImagen(this.supabase, 'productos', file);
  }

  // Traduce los errores de la base a mensajes para el admin
  private lanzarSiHayError(error: { code?: string; message: string } | null) {
    // 23505 = unique: el nombre ya existe en esa categoría
    if (error?.code === '23505') throw new Error('Ya existe un producto con ese nombre en la categoría');
    // 23503 = foreign key: el producto es parte de un combo
    if (error?.code === '23503') throw new Error('El producto está en un combo. Sacalo del combo o desactivalo.');
    if (error) throw error;
  }
}
