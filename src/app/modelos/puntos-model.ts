export type TipoRecompensa = 'entrada' | 'producto';

// Cuántos puntos cuesta canjear algo (lo configura el admin)
export interface RecompensaModel {
  id: string;
  nombre: string;
  tipo: TipoRecompensa;
  costo_puntos: number;
  activa: boolean;
  created_at: string;
}

export type TipoMovimientoPuntos = 'ganado' | 'canje';

export interface MovimientoPuntos {
  id: string;
  usuario_id: string;
  tipo: TipoMovimientoPuntos;
  puntos: number; // positivo si suma, negativo si se gasta
  descripcion: string;
  compra_id: string | null;
  created_at: string;
}
