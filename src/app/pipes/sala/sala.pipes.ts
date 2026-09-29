import { Pipe, PipeTransform } from '@angular/core';
import { FormatoSala } from '../../modelos/sala-model';

// '3D' -> '3D'   ·   con 'largo': '3D' -> 'Sala 3D'
@Pipe({ name: 'formatoSala' })
export class FormatoSalaPipe implements PipeTransform {
  transform(formato: FormatoSala | null | undefined, estilo: 'corto' | 'largo' = 'corto'): string {
    if (!formato) return '';
    return estilo === 'largo' ? `Sala ${formato}` : formato;
  }
}

// true -> 'Activa'   ·   false -> 'Inactiva'
@Pipe({ name: 'estadoSala' })
export class EstadoSalaPipe implements PipeTransform {
  transform(activa: boolean | null | undefined): string {
    return activa ? 'Activa' : 'Inactiva';
  }
}
