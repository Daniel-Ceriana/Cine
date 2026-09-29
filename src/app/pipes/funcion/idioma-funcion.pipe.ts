import { Pipe, PipeTransform } from '@angular/core';
import { IdiomaFuncion } from '../../modelos/funcion-model';

const ETIQUETAS: Record<IdiomaFuncion, string> = {
  castellano: 'Castellano',
  subtitulada: 'Subtitulada',
};

// 'castellano' -> 'Castellano'   ·   'subtitulada' -> 'Subtitulada'
@Pipe({ name: 'idiomaFuncion' })
export class IdiomaFuncionPipe implements PipeTransform {
  transform(idioma: IdiomaFuncion | null | undefined): string {
    return idioma ? ETIQUETAS[idioma] : '';
  }
}
