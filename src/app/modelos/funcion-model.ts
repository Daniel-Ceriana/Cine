export type FormatoFuncion = '2D' | '3D' | '4D' | '5D';
export type IdiomaFuncion = 'castellano' | 'subtitulada';

export interface FuncionModel {
  id: string;
  pelicula_id: string;
  sala_id: string;
  inicio: string; // ISO con zona horaria
  fin_bloqueo: string; // lo calcula la base (fin de la película + 30 min, múltiplo de 5)
  formato: FormatoFuncion;
  idioma: IdiomaFuncion;
  precio_base: number;
  precio_preventa: number;
  dias_preventa: number;
  activa: boolean;
  created_at: string;
}

// Función con los datos de la película y la sala que se piden en el select
export interface FuncionConRelaciones extends FuncionModel {
  peliculas: { nombre: string; duracion_minutos: number; imagen_url: string };
  salas: { numero: number; nombre: string };
}

// Lo que se puede cambiar al modificar una función ya creada
export interface FuncionModificarPayload {
  pelicula_id: string;
  inicio: string;
  formato: FormatoFuncion;
  idioma: IdiomaFuncion;
  precio_base: number;
  precio_preventa: number;
  dias_preventa: number;
}

// Lo que se manda al RPC crear_funciones (varias fechas, una sola hora)
export interface CrearFuncionesParams {
  pelicula_id: string;
  fechas: string[]; // 'YYYY-MM-DD'
  hora: string; // 'HH:mm'
  formato: FormatoFuncion;
  idioma: IdiomaFuncion;
  precio_base: number;
  precio_preventa: number;
  dias_preventa: number;
}
