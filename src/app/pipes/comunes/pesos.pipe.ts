import { Pipe, PipeTransform } from '@angular/core';

// 12500 -> '$ 12.500'   ·   1234.5 -> '$ 1.234,5'   ·   null -> ''
@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
  transform(monto: number | string | null | undefined): string {
    if (monto === null || monto === undefined || monto === '') return '';
    return `$ ${Number(monto).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
  }
}
