import { FormatoSala } from './sala-model';
import { IdiomaFuncion } from './funcion-model';

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
  credito_usado: number; // parte del total que se pagó con crédito
  cancelada_at: string | null; // si se canceló después de pagar, su total volvió como crédito
  cancelada_motivo: 'cliente' | 'cine' | null; // quién la canceló: el cliente o el cine (función cancelada)
  codigo: string; // 'K7Q2-9XMD': es lo que lleva el QR y lo que el empleado puede escribir a mano
  pagada_at: string | null;
  entrada_validada_at: string | null; // la entrada se usa una sola vez
  tiene_candy: boolean;
  candy_subtotal: number; // parte del subtotal que es candy (antes del cupón)
  candy_descuento: number; // parte del descuento que le tocó al candy
  candy_entregado_at: string | null; // el candy también, por separado
  created_at: string;
}

// Un producto del candy dentro de una compra (con el nombre y el precio del momento de comprar).
// Una parte puede pagarse en dinero (puntos_unitarios = 0) y otra con puntos (precio_unitario = 0).
export interface CompraItemModel {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  puntos_unitarios: number;
  combo_nombre: string | null; // si vino dentro de un combo (ya está en el precio del combo)
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
  compras: Pick<CompraModel, 'nombre' | 'email' | 'estado' | 'total' | 'candy_subtotal' | 'candy_descuento' | 'usuario_id' | 'pagada_at' | 'created_at'>;
}

// Lo que se manda a reservar_butacas
export interface ReservarButacasParams {
  funcion_id: string;
  butacas: string[];
  email?: string;
  nombre?: string;
  mayor_declarado?: boolean;
  butacas_con_puntos?: string[]; // butacas que se pagan canjeando puntos
  usar_credito?: boolean; // paga con el crédito de la cuenta todo lo que alcance
}

// Un producto del pedido: cuántas unidades en total y cuántas de ellas se pagan con puntos
export interface ProductoPedido {
  producto_id: string;
  cantidad: number;
  cantidad_con_puntos: number;
}

// Compra con los datos de la función y las butacas (para "Mis compras" y "Mi entrada")
export interface CompraDetalle extends CompraModel {
  funciones: {
    inicio: string;
    idioma: IdiomaFuncion;
    peliculas: { nombre: string; imagen_url: string; restriccion_edad: number };
    salas: { numero: number; formato: FormatoSala };
  };
  compra_butacas: { butaca_codigo: string }[];
  compra_items: CompraItemModel[];
  compra_combos: { nombre: string; cantidad: number }[];
}

export type ButacaEstadoVista = 'libre' | 'seleccionada' | 'reservada' | 'vendida';
