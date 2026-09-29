import { Pipe, PipeTransform } from '@angular/core';

// 0 -> 'ATP'   ·   13 -> '+13'   ·   18 -> '+18'
@Pipe({ name: 'restriccionEdad' })
export class RestriccionEdadPipe implements PipeTransform {
  transform(edad: number | null | undefined): string {
    if (edad === null || edad === undefined) return '';
    return edad === 0 ? 'ATP' : `+${edad}`;
  }
}
