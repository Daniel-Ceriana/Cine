import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { ComboConItems, ComboModel, ComboPayload } from '../modelos/combo-model';
import { subirImagen } from '../utilidades/subir-imagen';

// El combo con los productos que incluye (y el estado de cada uno, para saber si se puede vender)
const SELECT_COMBO =
  '*, combo_items(producto_id, cantidad, productos(nombre, precio, activo, categorias_producto(activa)))';

@Service()
export class ComboService {
  private supabase = inject(SupabaseService);
  private tabla = 'combos';

  // Para el admin: todos los combos, activos o no
  async getAll(): Promise<ComboConItems[]> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select(SELECT_COMBO)
      .order('orden')
      .order('nombre');

    if (error) throw error;
    return data as unknown as ComboConItems[];
  }

  async getById(id: string): Promise<ComboConItems> {
    const { data, error } = await this.supabase.client.from(this.tabla).select(SELECT_COMBO).eq('id', id).single();

    if (error) throw error;
    return data as unknown as ComboConItems;
  }

  // Para el cliente: combos activos cuyos productos (y categorías) también están activos.
  // Primero los destacados y después por el orden que definió el admin. La base vuelve a controlarlo al reservar.
  async getActivos(): Promise<ComboConItems[]> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select(SELECT_COMBO)
      .eq('activo', true)
      .order('destacado', { ascending: false })
      .order('orden')
      .order('nombre');

    if (error) throw error;
    return (data as unknown as ComboConItems[]).filter(
      (c) =>
        c.combo_items.length > 0 &&
        c.combo_items.every((i) => i.productos.activo && i.productos.categorias_producto?.activa),
    );
  }

  // Crea (id null) o modifica un combo con sus productos, todo junto (función SQL guardar_combo)
  async guardar(
    id: string | null,
    datos: ComboPayload,
    items: { producto_id: string; cantidad: number }[],
  ): Promise<ComboModel> {
    const { data, error } = await this.supabase.client.rpc('guardar_combo', {
      p_id: id,
      p_datos: datos,
      p_items: items,
    });

    this.lanzarSiHayError(error);
    return data as ComboModel;
  }

  async cambiarActivo(id: string, activo: boolean): Promise<void> {
    const { error } = await this.supabase.client.from(this.tabla).update({ activo }).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(this.tabla).delete().eq('id', id);
    if (error) throw error;
  }

  // Precio de entrada más bajo entre las funciones futuras activas: sirve de referencia para avisarle al admin
  // si el precio de un combo es mayor que el valor de lo que incluye (null si no hay funciones cargadas)
  async getPrecioEntradaReferencia(): Promise<number | null> {
    const { data, error } = await this.supabase.client
      .from('funciones')
      .select('precio_base')
      .eq('activa', true)
      .gte('inicio', new Date().toISOString())
      .order('precio_base')
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? Number(data[0].precio_base) : null;
  }

  subirImagen(file: File): Promise<string> {
    return subirImagen(this.supabase, 'combos', file);
  }

  // Traduce los errores de la base a mensajes para el admin
  private lanzarSiHayError(error: { code?: string; message: string } | null) {
    // 23505 = unique: ya hay un combo con ese nombre
    if (error?.code === '23505') throw new Error('Ya existe un combo con ese nombre');
    if (error) throw error;
  }
}
