import { Pipe, PipeTransform } from '@angular/core';
import { TipoMovimientoPuntos } from '../../modelos/puntos-model';

// 1500 -> '1.500'   ·   con 'signo': 1500 -> '+1.500', -500 -> '-500'
@Pipe({ name: 'puntos' })
export class PuntosPipe implements PipeTransform {
  transform(cantidad: number | null | undefined, estilo: 'simple' | 'signo' = 'simple'): string {
    if (cantidad === null || cantidad === undefined) return '';
    const texto = Math.abs(cantidad).toLocaleString('es-AR');
    if (estilo === 'simple') return cantidad < 0 ? `-${texto}` : texto;
    return cantidad < 0 ? `-${texto}` : `+${texto}`;
  }
}

const ETIQUETAS: Record<TipoMovimientoPuntos, string> = {
  ganado: 'Puntos ganados',
  canje: 'Canje',
  devolucion: 'Devolución',
  ajuste: 'Ajuste',
};

// 'ganado' -> 'Puntos ganados'   ·   'canje' -> 'Canje'
@Pipe({ name: 'tipoMovimiento' })
export class TipoMovimientoPipe implements PipeTransform {
  transform(tipo: TipoMovimientoPuntos | null | undefined): string {
    return tipo ? ETIQUETAS[tipo] : '';
  }
}
