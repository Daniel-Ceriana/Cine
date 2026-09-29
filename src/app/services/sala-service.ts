import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { SalaModel, SalaPayload, SalaConButacas } from '../modelos/sala-model';
import { generarButacas } from '../modelos/sala-plantilla';

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

  async getAll(soloActivas = false): Promise<SalaConButacas[]> {
    let query = this.supabase.client
      .from(this.tabla)
      .select('*, butacas(count)')
      .order('numero');

    if (soloActivas) query = query.eq('activa', true);

    const { data, error } = await query;
    if (error) throw error;
    return data as unknown as SalaConButacas[];
  }

  // Crea la sala y, con su id, todas sus butacas según sala-plantilla.ts
  async crear(payload: SalaPayload): Promise<SalaModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    const sala = data as SalaModel;

    const { error: errorButacas } = await this.supabase.client
      .from('butacas')
      .insert(generarButacas(sala.id));

    if (errorButacas) {
      // no dejar una sala sin butacas: se deshace la sala recién creada
      await this.supabase.client.from(this.tabla).delete().eq('id', sala.id);
      throw errorButacas;
    }

    return sala;
  }

  async modificar(id: string, payload: SalaPayload): Promise<SalaModel> {
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
