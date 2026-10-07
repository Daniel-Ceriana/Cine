import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { CompraDetalle, CompraModel, ProductoPedido, ReservarButacasParams } from '../modelos/compra-model';
import { ComboPedido } from '../modelos/combo-model';

// Datos de la función y las butacas que se piden junto con la compra
const SELECT_DETALLE =
  '*, funciones(inicio, idioma, peliculas(nombre, imagen_url, restriccion_edad), salas(numero, formato)), compra_butacas(butaca_codigo), compra_items(nombre, cantidad, precio_unitario, puntos_unitarios, combo_nombre), compra_combos(nombre, cantidad)';

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
      p_butacas_con_puntos: params.butacas_con_puntos ?? [],
      p_usar_credito: params.usar_credito ?? false,
    });

    if (error) throw error;
    return data as CompraModel;
  }

  // Deja en la reserva los productos y combos pedidos (listas vacías = sin candy) y recalcula los totales.
  // La reserva sigue con el mismo vencimiento: se puede cambiar el candy cuantas veces haga falta (función SQL definir_candy_compra).
  async definirCandy(
    compraId: string,
    productos: ProductoPedido[],
    combos: ComboPedido[],
    usarCredito: boolean,
  ): Promise<CompraModel> {
    const { data, error } = await this.supabase.client.rpc('definir_candy_compra', {
      p_compra_id: compraId,
      p_productos: productos,
      p_combos: combos,
      p_usar_credito: usarCredito,
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

  // Compras pagadas de la cuenta (incluye las canceladas), de la más nueva a la más vieja.
  // Se filtra por pagada_at porque una reserva abandonada también queda "cancelada" sin haberse pagado.
  async getMias(usuarioId: string): Promise<CompraDetalle[]> {
    const { data, error } = await this.supabase.client
      .from('compras')
      .select(SELECT_DETALLE)
      .eq('usuario_id', usuarioId)
      .not('pagada_at', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as unknown as CompraDetalle[];
  }

  // Quien compró sin cuenta recupera su entrada con código + email (función SQL buscar_entrada).
  // Si no coinciden, el error es siempre el mismo.
  async buscarEntrada(codigo: string, email: string): Promise<CompraDetalle> {
    const { data: id, error } = await this.supabase.client.rpc('buscar_entrada', {
      p_codigo: codigo,
      p_email: email,
    });
    if (error) throw error;

    const { data, error: errorLectura } = await this.supabase.client
      .from('compras')
      .select(SELECT_DETALLE)
      .eq('id', id)
      .single();

    if (errorLectura) throw errorLectura;
    return data as unknown as CompraDetalle;
  }

  // Cancela la compra (hasta N horas antes de la función): su total vuelve como crédito
  async cancelar(compraId: string): Promise<CompraModel> {
    const { data, error } = await this.supabase.client.rpc('cancelar_compra', { p_compra_id: compraId });
    if (error) throw error;
    return data as CompraModel;
  }
}
