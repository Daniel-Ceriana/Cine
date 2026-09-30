export type EstadoCompra = 'pendiente' | 'pagada' | 'cancelada' | 'vencida';
export type EstadoCompraButaca = 'reservada' | 'vendida' | 'liberada';

export interface CompraModel {
  id: string;
  funcion_id: string;
  usuario_id: string | null; // null si compró sin sesión iniciada
  email: string;
  nombre: string;
  estado: EstadoCompra;
  expira_at: string; // fin de la reserva de 5 minutos
  mayor_declarado: boolean;
  subtotal: number;
  descuento: number;
  total: number;
  cupon_nombre: string | null; // cupón aplicado (snapshot del momento de la compra)
  cupon_porcentaje: number | null;
  puntos_usados: number; // puntos canjeados en esta compra
  codigo: string; // 'K7Q2-9XMD': es lo que lleva el QR y lo que el empleado puede escribir a mano
  pagada_at: string | null;
  entrada_validada_at: string | null; // la entrada se usa una sola vez
  tiene_candy: boolean;
  candy_entregado_at: string | null; // el candy también, por separado
  created_at: string;
}

export interface CompraButacaModel {
  id: string;
  compra_id: string;
  funcion_id: string;
  butaca_codigo: string;
  precio: number; // lo que se cobra en dinero por esta butaca (0 si se pagó con puntos, salvo recargo VIP)
  con_puntos: boolean;
  estado: EstadoCompraButaca;
  reservada_hasta: string | null;
}

// Butaca ocupada de una función, con los datos de la compra (para el admin)
export interface OcupacionButaca extends CompraButacaModel {
  compras: Pick<CompraModel, 'nombre' | 'email' | 'estado' | 'total' | 'usuario_id' | 'pagada_at' | 'created_at'>;
}

// Lo que se manda a reservar_butacas
export interface ReservarButacasParams {
  funcion_id: string;
  butacas: string[];
  email?: string;
  nombre?: string;
  mayor_declarado?: boolean;
  butacas_con_puntos?: string[]; // butacas que se pagan canjeando puntos
}

export type ButacaEstadoVista = 'libre' | 'seleccionada' | 'reservada' | 'vendida';
