import { Pipe, PipeTransform } from '@angular/core';

// 4.3 -> '4,3'   ·   4 -> '4,0'   ·   null -> ''
@Pipe({ name: 'puntuacion' })
export class PuntuacionPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    if (valor === null || valor === undefined) return '';
    return Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
}
