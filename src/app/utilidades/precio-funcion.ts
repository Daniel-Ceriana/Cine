import { FuncionConRelaciones } from '../modelos/funcion-model';
import { hoyAr, sumarDias } from './fechas-ar';

export interface VigenciaPrecio {
  estado: 'normal' | 'preventa' | 'no-abierta';
  precio: number | null; // null = todavía no se venden entradas
  abreEl: string | null; // 'YYYY-MM-DD' en que empieza la venta, si todavía no abrió
}

// Precio de hoy de una función. Es la misma regla que aplica reservar_butacas en la base:
//  - desde el estreno: precio base
//  - antes del estreno: solo se venden las funciones "con preventa", al precio de preventa de la película,
//    dentro de los "días de preventa" previos al estreno
//  - antes de eso (o en una función sin preventa): no se vende
// La base vuelve a calcularlo al reservar; esto sirve para mostrarlo en pantalla.
export function precioVigente(f: FuncionConRelaciones): VigenciaPrecio {
  const hoy = hoyAr();
  const estreno = f.peliculas.fecha_estreno;

  if (hoy >= estreno) {
    return { estado: 'normal', precio: Number(f.precio_base), abreEl: null };
  }

  // el precio y los días de preventa son de la película; qué funciones la tienen lo marca el admin en cada una
  if (f.con_preventa && f.peliculas.dias_preventa > 0) {
    const abreEl = sumarDias(estreno, -f.peliculas.dias_preventa);
    return hoy >= abreEl
      ? { estado: 'preventa', precio: Number(f.peliculas.precio_preventa), abreEl }
      : { estado: 'no-abierta', precio: null, abreEl };
  }

  return { estado: 'no-abierta', precio: null, abreEl: estreno };
}
