import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { CategoriaProductoModel, CategoriaProductoPayload } from '../modelos/producto-model';

@Service()
export class CategoriaProductoService {
  private supabase = inject(SupabaseService);
  private tabla = 'categorias_producto';

  // Por el orden que definió el admin y, si empatan, por nombre
  async getAll(soloActivas = false): Promise<CategoriaProductoModel[]> {
    let query = this.supabase.client
      .from(this.tabla)
      .select('*')
      .order('orden')
      .order('nombre');

    if (soloActivas) query = query.eq('activa', true);

    const { data, error } = await query;
    if (error) throw error;
    return data as CategoriaProductoModel[];
  }

  async crear(payload: CategoriaProductoPayload): Promise<CategoriaProductoModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .insert(payload)
      .select()
      .single();

    this.lanzarSiHayError(error);
    return data as CategoriaProductoModel;
  }

  async modificar(id: string, payload: CategoriaProductoPayload): Promise<CategoriaProductoModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    this.lanzarSiHayError(error);
    return data as CategoriaProductoModel;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(this.tabla).delete().eq('id', id);
    this.lanzarSiHayError(error);
  }

  // Traduce los errores de la base a mensajes para el admin
  private lanzarSiHayError(error: { code?: string; message: string } | null) {
    // 23505 = unique: ya existe una categoría con ese nombre
    if (error?.code === '23505') throw new Error('Ya existe una categoría con ese nombre');
    // 23503 = foreign key: la categoría tiene productos
    if (error?.code === '23503') {
      throw new Error('La categoría tiene productos. Desactivala en lugar de eliminarla.');
    }
    if (error) throw error;
  }
}
