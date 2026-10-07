import { Pipe, PipeTransform } from '@angular/core';

// true -> 'Activo'   ·   false -> 'Inactivo'
@Pipe({ name: 'estadoProducto' })
export class EstadoProductoPipe implements PipeTransform {
  transform(activo: boolean | null | undefined): string {
    return activo ? 'Activo' : 'Inactivo';
  }
}

// true -> 'Activa'   ·   false -> 'Inactiva'
@Pipe({ name: 'estadoCategoria' })
export class EstadoCategoriaPipe implements PipeTransform {
  transform(activa: boolean | null | undefined): string {
    return activa ? 'Activa' : 'Inactiva';
  }
}
