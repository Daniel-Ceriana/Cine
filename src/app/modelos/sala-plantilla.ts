import { TipoButaca } from './sala-model';

// ---------------------------------------------------------------------
// Distribución de butacas de TODAS las salas (es una sola, igual para todas).
// Sirve para dibujar el mapa. Para cambiarla se edita este archivo y, si
// cambian las butacas, también el SQL que carga la tabla "butacas"
// (supabase/004_compras_butacas.sql), que tiene que quedar igual.
//
// Numeración (según el plano del cine): el número es absoluto en la fila.
//   bloque izquierdo: 1-4    pasillo: 5
//   bloque central:   6-25   pasillo: 26
//   bloque derecho:   27-30
// ---------------------------------------------------------------------

export interface ButacaPlantilla {
  codigo: string; // 'A6'
  fila: string;
  bloque: 1 | 2 | 3;
  numero: number;
  tipo: TipoButaca;
}

const rango = (desde: number, hasta: number): number[] =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

// Números de cada bloque en una fila común
const NUMEROS_NORMALES: number[][] = [rango(1, 4), rango(6, 25), rango(27, 30)];

// La fila accesible tiene butacas solo en el centro de cada bloque (2, 10 y 2)
const NUMEROS_ACCESIBLES: number[][] = [[2, 3], rango(11, 20), [28, 29]];

const FILAS_COMUNES = 'ABCDEFGHI'.split(''); // antes de la fila accesible
const FILA_ACCESIBLE = 'J';
const FILAS_DESPUES = 'LMNOPQRST'.split(''); // la K no existe: es el hueco del plano
const FILAS_VIP = ['R', 'S', 'T'];

// Orden de las filas en el mapa; '' es la fila vacía que separa la J de la L
export const FILAS_MAPA: string[] = [...FILAS_COMUNES, FILA_ACCESIBLE, '', ...FILAS_DESPUES];

// Cantidad de columnas de la grilla del mapa (números 1 a 30)
export const COLUMNAS_MAPA = 30;

// Los números que son pasillo, para dibujarlos más angostos
export const COLUMNAS_PASILLO = [5, 26];

function crearFila(fila: string, tipo: TipoButaca, numerosPorBloque: number[][]): ButacaPlantilla[] {
  return numerosPorBloque.flatMap((numeros, i) =>
    numeros.map((numero) => ({
      codigo: `${fila}${numero}`,
      fila,
      bloque: (i + 1) as 1 | 2 | 3,
      numero,
      tipo,
    })),
  );
}

// Todas las butacas de una sala, en orden de fila
export function generarButacas(): ButacaPlantilla[] {
  const filas: ButacaPlantilla[][] = [
    ...FILAS_COMUNES.map((f) => crearFila(f, 'normal', NUMEROS_NORMALES)),
    crearFila(FILA_ACCESIBLE, 'accesible', NUMEROS_ACCESIBLES),
    ...FILAS_DESPUES.map((f) =>
      crearFila(f, FILAS_VIP.includes(f) ? 'vip' : 'normal', NUMEROS_NORMALES),
    ),
  ];
  return filas.flat();
}

export const BUTACAS = generarButacas();
export const TOTAL_BUTACAS = BUTACAS.length; // 18 filas de 28 + 14 accesibles = 518
