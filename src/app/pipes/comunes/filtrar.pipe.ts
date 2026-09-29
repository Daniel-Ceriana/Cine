import { Pipe, PipeTransform } from '@angular/core';

// Ignora mayúsculas y tildes: 'Acción' y 'accion' son lo mismo
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Lee un campo, aceptando rutas con puntos y listas: 'nombre', 'salas.formato', 'generos.nombre'.
// Si en el camino hay una lista (ej.: generos), devuelve el valor de cada elemento.
function valoresDe(item: unknown, ruta: string): unknown[] {
  let actuales: unknown[] = [item];

  for (const parte of ruta.split('.')) {
    actuales = actuales
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .map((v) => (v as Record<string, unknown> | null | undefined)?.[parte])
      .filter((v) => v !== null && v !== undefined);
  }
  return actuales.flatMap((v) => (Array.isArray(v) ? v : [v]));
}

// Filtra una lista con un texto (o un booleano) sobre uno o más campos.
//
//   peliculas | filtrar: 'batman' : ['nombre']                    contiene el texto en el nombre
//   peliculas | filtrar: 'Drama' : ['generos.nombre'] : true       género exacto (Drama, no Melodrama)
//   peliculas | filtrar: soloDestacadas : ['destacada']            true = solo las que tienen el campo en true
//
// Sin texto (vacío, null o false) devuelve la lista completa.
@Pipe({ name: 'filtrar' })
export class FiltrarPipe implements PipeTransform {
  transform<T>(
    items: T[] | null | undefined,
    termino: string | boolean | null | undefined,
    campos: string[],
    exacto = false,
  ): T[] {
    if (!items) return [];
    if (termino === null || termino === undefined || termino === '' || termino === false) return items;

    // true: se queda con los que tienen el campo en true
    if (termino === true) {
      return items.filter((item) => campos.some((c) => valoresDe(item, c).includes(true)));
    }

    const buscado = normalizar(termino);
    return items.filter((item) =>
      campos.some((c) =>
        valoresDe(item, c).some((valor) => {
          const texto = normalizar(String(valor));
          return exacto ? texto === buscado : texto.includes(buscado);
        }),
      ),
    );
  }
}
