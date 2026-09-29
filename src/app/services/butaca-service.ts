import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { OcupacionButaca } from '../modelos/compra-model';

@Service()
export class ButacaService {
  private supabase = inject(SupabaseService);

  // Butacas reservadas o vendidas de una función, con los datos de quien las compró.
  // Las reservas cuyo tiempo ya se cumplió se descartan acá, sin esperar a que la base las libere.
  async getOcupacion(funcionId: string): Promise<OcupacionButaca[]> {
    const { data, error } = await this.supabase.client
      .from('compra_butacas')
      .select('*, compras(nombre, email, estado, total, usuario_id, pagada_at, created_at)')
      .eq('funcion_id', funcionId)
      .in('estado', ['reservada', 'vendida']);

    if (error) throw error;

    const ahora = Date.now();
    return (data as unknown as OcupacionButaca[]).filter(
      (o) => o.estado === 'vendida' || !o.reservada_hasta || new Date(o.reservada_hasta).getTime() > ahora,
    );
  }

  // Tiempo real (Supabase Realtime): avisa cada vez que se inserta o cambia una butaca de esta función.
  // Devuelve una función para cancelar la suscripción (hay que llamarla al salir de la pantalla).
  suscribirCambios(funcionId: string, alCambiar: () => void): () => void {
    const canal = this.supabase.client
      .channel(`butacas-funcion-${funcionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'compra_butacas', filter: `funcion_id=eq.${funcionId}` },
        () => alCambiar(),
      )
      .subscribe();

    return () => {
      this.supabase.client.removeChannel(canal);
    };
  }
}
