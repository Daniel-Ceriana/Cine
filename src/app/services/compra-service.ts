import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { CompraModel, ReservarButacasParams } from '../modelos/compra-model';

@Service()
export class CompraService {
  private supabase = inject(SupabaseService);

  // Reserva las butacas por 5 minutos (función SQL reservar_butacas).
  // Si una butaca ya no está disponible o no se cumple la edad, el error trae el motivo.
  async reservar(params: ReservarButacasParams): Promise<CompraModel> {
    const { data, error } = await this.supabase.client.rpc('reservar_butacas', {
      p_funcion_id: params.funcion_id,
      p_butacas: params.butacas,
      p_email: params.email ?? null,
      p_nombre: params.nombre ?? null,
      p_mayor_declarado: params.mayor_declarado ?? false,
    });

    if (error) throw error;
    return data as CompraModel;
  }

  // Pago simulado: confirma la compra si la reserva sigue vigente
  async confirmarPago(compraId: string): Promise<CompraModel> {
    const { data, error } = await this.supabase.client.rpc('confirmar_pago', {
      p_compra_id: compraId,
    });

    if (error) throw error;
    return data as CompraModel;
  }

  // El comprador abandona antes de pagar: las butacas vuelven a estar libres
  async liberar(compraId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('liberar_compra', { p_compra_id: compraId });
    if (error) throw error;
  }

  // Valor que se suma a las butacas VIP (tabla configuracion)
  async getRecargoVip(): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('configuracion')
      .select('valor')
      .eq('clave', 'recargo_vip')
      .single();

    if (error) throw error;
    return Number(data.valor);
  }
}
