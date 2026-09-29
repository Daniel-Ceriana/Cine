import { FormatoSala } from './sala-model';

export type IdiomaFuncion = 'castellano' | 'subtitulada';

// El formato (2D/3D/...) no se guarda en la función: lo determina su sala
export interface FuncionModel {
  id: string;
  pelicula_id: string;
  sala_id: string;
  serie_id: string | null; // las funciones creadas juntas comparten serie
  inicio: string; // ISO con zona horaria
  fin_bloqueo: string; // lo calcula la base (fin de la película + 30 min, múltiplo de 5)
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
  salas: { numero: number; nombre: string; formato: FormatoSala };
}

// Campos comunes a crear y modificar
interface FuncionParams {
  pelicula_id: string;
  hora: string; // 'HH:mm'
  formato: FormatoSala; // sirve para elegir entre las salas de ese tipo
  idioma: IdiomaFuncion;
  precio_base: number;
  precio_preventa: number;
  dias_preventa: number;
}

// Lo que se manda al RPC crear_funciones (varias fechas, una sola hora)
export interface CrearFuncionesParams extends FuncionParams {
  fechas: string[]; // 'YYYY-MM-DD'
}

export type AlcanceModificar = 'una' | 'siguientes';

// Lo que se manda al RPC modificar_funciones
export interface ModificarFuncionesParams extends FuncionParams {
  funcion_id: string;
  alcance: AlcanceModificar;
  fechas: string[]; // con alcance 'una' se usa solo la primera
}
