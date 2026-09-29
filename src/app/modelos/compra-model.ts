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
  qr_token: string; // lo que lleva el QR
  pagada_at: string | null;
  entrada_validada_at: string | null;
  created_at: string;
}

export interface CompraButacaModel {
  id: string;
  compra_id: string;
  funcion_id: string;
  butaca_codigo: string;
  precio: number;
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
}

export type ButacaEstadoVista = 'libre' | 'seleccionada' | 'reservada' | 'vendida';
