import { Pipe, PipeTransform } from '@angular/core';
import { EstadoCompra } from '../../modelos/compra-model';

const ETIQUETAS: Record<EstadoCompra, string> = {
  pendiente: 'Pendiente de pago',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
};

// 'pendiente' -> 'Pendiente de pago'   ·   'pagada' -> 'Pagada'
@Pipe({ name: 'estadoCompra' })
export class EstadoCompraPipe implements PipeTransform {
  transform(estado: EstadoCompra | null | undefined): string {
    return estado ? ETIQUETAS[estado] : '';
  }
}
