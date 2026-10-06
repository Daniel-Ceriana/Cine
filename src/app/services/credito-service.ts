import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { MovimientoCredito } from '../modelos/credito-model';

@Service()
export class CreditoService {
  private supabase = inject(SupabaseService);

  // Historial de crédito del usuario, del más nuevo al más viejo
  async getMovimientos(usuarioId: string): Promise<MovimientoCredito[]> {
    const { data, error } = await this.supabase.client
      .from('credito_movimientos')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as MovimientoCredito[];
  }
}
