import { TipoButaca, FormatoSala } from './sala-model';
import { IdiomaFuncion } from './funcion-model';
import { EstadoCompra } from './compra-model';

// La entrada y el candy se validan por separado con el mismo código
export type SeccionValidacion = 'entrada' | 'candy';

// Respuesta de evaluar_codigo / validar_codigo
export interface ResultadoCodigo {
  encontrada: boolean;
  puede_validar: boolean;
  motivo: string | null; // por qué no se puede validar (si corresponde)

  // Los datos de la compra solo vienen si se encontró el código
  compra_id?: string;
  codigo?: string;
  comprador?: string;
  estado_compra?: EstadoCompra;
  total?: number;
  pelicula?: string;
  restriccion_edad?: number;
  inicio?: string;
  sala_numero?: number;
  formato?: FormatoSala;
  idioma?: IdiomaFuncion;
  butacas?: { codigo: string; tipo: TipoButaca }[];
  tiene_candy?: boolean;
  productos?: { nombre: string; cantidad: number }[]; // lo que hay que entregar en el candy (incluye los de los combos)
  combos?: { nombre: string; cantidad: number }[];
  usado_at?: string | null;
  usado_por?: string | null;
}
