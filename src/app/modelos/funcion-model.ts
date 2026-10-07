import { FormatoSala } from './sala-model';

export type IdiomaFuncion = 'castellano' | 'subtitulada';

export interface FuncionModel {
  id: string;
  pelicula_id: string;
  sala_id: string;
  serie_id: string | null; // las funciones creadas juntas comparten serie
  inicio: string; // ISO con zona horaria
  fin_bloqueo: string; // lo calcula la base (fin de la película + 30 min, múltiplo de 5)
  idioma: IdiomaFuncion;
  precio_base: number;
  con_preventa: boolean; // se puede comprar antes del estreno, al precio de preventa de la película
  activa: boolean;
  created_at: string;
}

// Función con los datos de la película y la sala que se piden en el select
export interface FuncionConRelaciones extends FuncionModel {
  peliculas: {
    nombre: string;
    duracion_minutos: number;
    imagen_url: string;
    fecha_estreno: string;
    restriccion_edad: number;
    precio_preventa: number; // la preventa se configura por película
    dias_preventa: number;
  };
  salas: { numero: number; nombre: string; formato: FormatoSala };
}

// Campos comunes a crear y modificar
interface FuncionParams {
  pelicula_id: string;
  hora: string; // 'HH:mm'
  formato: FormatoSala; // sirve para elegir entre las salas de ese tipo
  idioma: IdiomaFuncion;
  precio_base: number;
  con_preventa: boolean;
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

// Qué pasa si se cancelan una o más funciones (lo calcula resumen_cancelacion en la base).
// Cancelar devuelve el mismo resumen con lo que se compensó.
export interface ResumenCancelacion {
  funciones?: number; // solo en resumen_postergar_estreno: cuántas funciones se cancelan
  compras_con_cuenta: number; // reciben el total como crédito y una notificación
  credito_total: number;
  compras_anonimas: number; // se cancelan, pero no hay cuenta donde avisar ni acreditar
  total_anonimas: number;
  anonimas: { nombre: string; email: string; codigo: string; total: number; pelicula: string; inicio: string }[];
}
