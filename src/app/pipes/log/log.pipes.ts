import { Pipe, PipeTransform } from '@angular/core';
import { AccionLog, EntidadLog } from '../../modelos/log-model';

export const ETIQUETA_ACCION: Record<AccionLog, string> = {
  crear: 'Creó',
  modificar: 'Modificó',
  eliminar: 'Eliminó',
  activar: 'Activó',
  desactivar: 'Desactivó',
  cancelar: 'Canceló',
  cambiar_rol: 'Cambió un rol',
  validar_entrada: 'Validó una entrada',
  entregar_candy: 'Entregó candy',
};

export const ETIQUETA_ENTIDAD: Record<EntidadLog, string> = {
  funcion: 'Funciones',
  pelicula: 'Películas',
  sala: 'Salas',
  producto: 'Productos',
  categoria: 'Categorías',
  combo: 'Combos',
  combo_productos: 'Productos de un combo',
  cupon: 'Cupones',
  recompensa: 'Canje de puntos',
  configuracion: 'Configuración',
  empleado: 'Empleados',
  compra: 'Validaciones en el cine',
};

// 'crear' -> 'Creó'   ·   'validar_entrada' -> 'Validó una entrada'
@Pipe({ name: 'accionLog' })
export class AccionLogPipe implements PipeTransform {
  transform(accion: AccionLog | null | undefined): string {
    return accion ? ETIQUETA_ACCION[accion] : '';
  }
}

// 'combo_productos' -> 'Productos de un combo'
@Pipe({ name: 'entidadLog' })
export class EntidadLogPipe implements PipeTransform {
  transform(entidad: EntidadLog | null | undefined): string {
    return entidad ? ETIQUETA_ENTIDAD[entidad] : '';
  }
}
