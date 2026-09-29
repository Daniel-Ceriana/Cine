import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { SalaModel, SalaPayload } from '../modelos/sala-model';

@Service()
export class SalaService {
  private supabase = inject(SupabaseService);
  private tabla = 'salas';

  async getById(id: string): Promise<SalaModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as SalaModel;
  }

  async getAll(soloActivas = false): Promise<SalaModel[]> {
    let query = this.supabase.client
      .from(this.tabla)
      .select('*')
      .order('numero');

    if (soloActivas) query = query.eq('activa', true);

    const { data, error } = await query;
    if (error) throw error;
    return data as SalaModel[];
  }

  async crear(payload: SalaPayload): Promise<SalaModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as SalaModel;
  }

  async modificar(id: string, payload: SalaPayload): Promise<SalaModel> {
    // Cambiar el formato dejaría funciones futuras en una sala de otro tipo
    const actual = await this.getById(id);
    if (actual.formato !== payload.formato) {
      const { count, error: errorCount } = await this.supabase.client
        .from('funciones')
        .select('id', { count: 'exact', head: true })
        .eq('sala_id', id)
        .eq('activa', true)
        .gte('inicio', new Date().toISOString());

      if (errorCount) throw errorCount;
      if (count) {
        throw new Error('No se puede cambiar el formato: la sala tiene funciones futuras activas.');
      }
    }

    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as SalaModel;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(this.tabla).delete().eq('id', id);

    // 23503 = foreign key: la sala tiene funciones
    if (error?.code === '23503') {
      throw new Error('La sala tiene funciones asociadas. Desactivala en lugar de eliminarla.');
    }
    if (error) throw error;
  }
}
