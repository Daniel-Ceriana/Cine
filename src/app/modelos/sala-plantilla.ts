import { ButacaPayload, TipoButaca } from './sala-model';

// ---------------------------------------------------------------------
// Distribución de butacas de TODAS las salas. Para cambiarla se edita
// solo este archivo; las salas nuevas se crean con lo que diga acá.
// ---------------------------------------------------------------------

// Filas de la A a la T
const LETRAS = 'ABCDEFGHIJKLMNOPQRST'.split('');

// J y K se quitaron; en su lugar hay UNA fila accesible que usa la letra J
const FILAS_QUITADAS = ['K'];
const FILAS_ACCESIBLES = ['J'];
const FILAS_VIP = ['R', 'S', 'T'];

// Butacas por bloque: [izquierda, centro, derecha]
const BUTACAS_NORMALES: [number, number, number] = [4, 20, 4];
const BUTACAS_ACCESIBLES: [number, number, number] = [2, 10, 2];

function tipoDeFila(fila: string): TipoButaca {
  if (FILAS_ACCESIBLES.includes(fila)) return 'accesible';
  if (FILAS_VIP.includes(fila)) return 'vip';
  return 'normal';
}

// Devuelve las butacas de una sala nueva, listas para insertar en la tabla
export function generarButacas(salaId: string): ButacaPayload[] {
  const butacas: ButacaPayload[] = [];

  for (const fila of LETRAS.filter((l) => !FILAS_QUITADAS.includes(l))) {
    const tipo = tipoDeFila(fila);
    const cantidades = tipo === 'accesible' ? BUTACAS_ACCESIBLES : BUTACAS_NORMALES;

    cantidades.forEach((cantidad, i) => {
      for (let numero = 1; numero <= cantidad; numero++) {
        butacas.push({ sala_id: salaId, fila, bloque: (i + 1) as 1 | 2 | 3, numero, tipo });
      }
    });
  }

  return butacas;
}
