import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { NotificacionModel } from '../modelos/notificacion-model';

@Service()
export class NotificacionService {
  private supabase = inject(SupabaseService);
  private tabla = 'notificaciones';

  async getMias(usuarioId: string): Promise<NotificacionModel[]> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as NotificacionModel[];
  }

  async marcarLeida(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(this.tabla).update({ leida: true }).eq('id', id);
    if (error) throw error;
  }

  async marcarTodasLeidas(usuarioId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from(this.tabla)
      .update({ leida: true })
      .eq('usuario_id', usuarioId)
      .eq('leida', false);

    if (error) throw error;
  }
}
