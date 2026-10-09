import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { ButacaOcupada, OcupacionButaca } from '../modelos/compra-model';

@Service()
export class ButacaService {
  private supabase = inject(SupabaseService);

  // Butacas ocupadas de una función SIN datos de quien las compró (función SQL butacas_ocupadas): es lo que ve el cliente.
  // La función ya descarta las reservas vencidas.
  async getOcupadas(funcionId: string): Promise<ButacaOcupada[]> {
    const { data, error } = await this.supabase.client.rpc('butacas_ocupadas', { p_funcion_id: funcionId });
    if (error) throw error;
    return data as ButacaOcupada[];
  }

  // Butacas reservadas o vendidas de una función, con los datos de quien las compró (solo el admin puede leerlas).
  // Las reservas cuyo tiempo ya se cumplió se descartan acá, sin esperar a que la base las libere.
  async getOcupacion(funcionId: string): Promise<OcupacionButaca[]> {
    const { data, error } = await this.supabase.client
      .from('compra_butacas')
      .select('*, compras(nombre, email, estado, total, candy_subtotal, candy_descuento, usuario_id, pagada_at, created_at)')
      .eq('funcion_id', funcionId)
      .in('estado', ['reservada', 'vendida']);

    if (error) throw error;

    const ahora = Date.now();
    return (data as unknown as OcupacionButaca[]).filter(
      (o) => o.estado === 'vendida' || !o.reservada_hasta || new Date(o.reservada_hasta).getTime() > ahora,
    );
  }

  // Tiempo real (Supabase Realtime, broadcast): un trigger de la base emite un mensaje cada vez que cambia una butaca
  // de esta función, por un canal privado. El mensaje no trae datos de la compra: solo avisa y la pantalla vuelve a pedir
  // la lista. Devuelve una función para cancelar la suscripción (hay que llamarla al salir de la pantalla).
  suscribirCambios(funcionId: string, alCambiar: () => void): () => void {
    const canal = this.supabase.client
      .channel(`butacas:${funcionId}`, { config: { private: true } })
      .on('broadcast', { event: 'cambio' }, () => alCambiar())
      .subscribe();

    return () => {
      this.supabase.client.removeChannel(canal);
    };
  }
}
