export type TipoButaca = 'normal' | 'accesible' | 'vip';
export type FormatoSala = '2D' | '3D' | '4D' | '5D';

export interface SalaModel {
  id: string;
  numero: number;
  nombre: string;
  formato: FormatoSala; // toda función de la sala se proyecta en este formato
  activa: boolean;
  created_at: string;
}

// lo que se manda al crear/modificar (id y created_at los pone la base)
export type SalaPayload = Omit<SalaModel, 'id' | 'created_at'>;

export interface SalaModelForm {
  numero: number;
  nombre: string;
  formato: FormatoSala;
  activa: boolean;
}

// Fila de la tabla "butacas": hay una sola distribución, compartida por todas las salas
export interface ButacaModel {
  codigo: string; // 'A6'
  fila: string;
  bloque: 1 | 2 | 3; // 1 = izquierda, 2 = centro, 3 = derecha
  numero: number;
  tipo: TipoButaca;
}
