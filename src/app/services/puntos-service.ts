import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { MovimientoPuntos, RecompensaModel } from '../modelos/puntos-model';

@Service()
export class PuntosService {
  private supabase = inject(SupabaseService);

  async getRecompensas(): Promise<RecompensaModel[]> {
    const { data, error } = await this.supabase.client
      .from('recompensas')
      .select('*')
      .order('tipo')
      .order('nombre');

    if (error) throw error;
    return data as RecompensaModel[];
  }

  // Cuántos puntos cuesta canjear una entrada (null si el canje está desactivado)
  async getCostoEntrada(): Promise<number | null> {
    const { data, error } = await this.supabase.client
      .from('recompensas')
      .select('costo_puntos')
      .eq('tipo', 'entrada')
      .eq('activa', true)
      .maybeSingle();

    if (error) throw error;
    return data ? Number(data.costo_puntos) : null;
  }

  async modificarRecompensa(id: string, cambios: { costo_puntos: number; activa: boolean }): Promise<void> {
    const { error } = await this.supabase.client.from('recompensas').update(cambios).eq('id', id);
    if (error) throw error;
  }

  // Historial de puntos (ganados y canjes) del usuario, del más nuevo al más viejo
  async getMovimientos(usuarioId: string): Promise<MovimientoPuntos[]> {
    const { data, error } = await this.supabase.client
      .from('puntos_movimientos')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as MovimientoPuntos[];
  }
}
