import { Pipe, PipeTransform } from '@angular/core';
import { Rol } from '../../modelos/user-model';

export const ETIQUETA_ROL: Record<Rol, string> = {
  cliente: 'Cliente',
  empleado_entradas: 'Empleado de entradas',
  empleado_candy: 'Empleado de candy',
  admin: 'Administrador',
};

// 'empleado_candy' -> 'Empleado de candy'
@Pipe({ name: 'rolUsuario' })
export class RolUsuarioPipe implements PipeTransform {
  transform(rol: Rol | null | undefined): string {
    return rol ? ETIQUETA_ROL[rol] : '';
  }
}
