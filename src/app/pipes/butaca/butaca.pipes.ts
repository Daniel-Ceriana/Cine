import { Pipe, PipeTransform } from '@angular/core';
import { TipoButaca } from '../../modelos/sala-model';
import { ButacaEstadoVista, EstadoCompraButaca } from '../../modelos/compra-model';

// Los textos se exportan para poder usarlos también desde TypeScript (ej.: el título del mapa)
export const ETIQUETA_TIPO_BUTACA: Record<TipoButaca, string> = {
  normal: 'Común',
  vip: 'VIP',
  accesible: 'Accesible',
};

export const ETIQUETA_ESTADO_BUTACA: Record<ButacaEstadoVista | EstadoCompraButaca, string> = {
  libre: 'Libre',
  seleccionada: 'Elegida',
  reservada: 'En proceso',
  vendida: 'Ocupada',
  liberada: 'Liberada',
};

// 'normal' -> 'Común'   ·   'vip' -> 'VIP'   ·   'accesible' -> 'Accesible'
@Pipe({ name: 'tipoButaca' })
export class TipoButacaPipe implements PipeTransform {
  transform(tipo: TipoButaca | null | undefined): string {
    return tipo ? ETIQUETA_TIPO_BUTACA[tipo] : '';
  }
}

// 'reservada' -> 'En proceso'   ·   'vendida' -> 'Ocupada'   ·   'seleccionada' -> 'Elegida'
@Pipe({ name: 'estadoButaca' })
export class EstadoButacaPipe implements PipeTransform {
  transform(estado: ButacaEstadoVista | EstadoCompraButaca | null | undefined): string {
    return estado ? ETIQUETA_ESTADO_BUTACA[estado] : '';
  }
}
