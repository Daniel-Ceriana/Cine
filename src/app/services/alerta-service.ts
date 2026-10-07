import { Service, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { Auth } from './auth';

// Alertas de estreno: la cuenta pide que le avisen cuando abra la venta de una película próxima.
// El aviso llega a "Mi perfil > Notificaciones" (el sistema no envía mails).
@Service()
export class AlertaService {
  private supabase = inject(SupabaseService);
  private auth = inject(Auth);

  // Ids de las películas con una alerta pendiente de la cuenta (para marcar los botones "Avisarme")
  activas = signal<Set<string>>(new Set());

  async cargar(): Promise<void> {
    const id = this.auth.perfil()?.id;
    if (!id) {
      this.activas.set(new Set());
      return;
    }

    const { data, error } = await this.supabase.client
      .from('alertas_estreno')
      .select('pelicula_id')
      .eq('usuario_id', id)
      .eq('avisada', false);

    if (error) throw error;
    this.activas.set(new Set((data ?? []).map((a) => a.pelicula_id as string)));
  }

  // Activa el aviso o lo quita, según como esté (funciones SQL activar_alerta y quitar_alerta)
  async alternar(peliculaId: string): Promise<void> {
    const estaActiva = this.activas().has(peliculaId);
    const { error } = await this.supabase.client.rpc(estaActiva ? 'quitar_alerta' : 'activar_alerta', {
      p_pelicula_id: peliculaId,
    });
    if (error) throw error;

    this.activas.update((set) => {
      const nuevo = new Set(set);
      if (estaActiva) nuevo.delete(peliculaId);
      else nuevo.add(peliculaId);
      return nuevo;
    });
  }

  // Genera los avisos de las alertas cuya venta ya abrió (función SQL revisar_alertas). Se llama al entrar a la app.
  async revisar(): Promise<number> {
    if (!this.auth.perfil()) return 0;

    const { data, error } = await this.supabase.client.rpc('revisar_alertas');
    if (error) throw error;
    return Number(data);
  }
}
