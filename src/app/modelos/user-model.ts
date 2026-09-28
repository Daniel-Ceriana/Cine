export interface UserModel {

id: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
  rol: 'cliente'| 'empleado_candy' | 'empleado_entradas' | 'admin';
  puntos: number;
  credito: number;
  created_at: string;
}

export interface SignUpProfile {
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
}

export type Rol = 'cliente'| 'empleado_candy' | 'empleado_entradas' | 'admin';

export const RUTA_POR_ROL: Record<Rol, string> = {
  admin: '/admin/homeadmin',
  empleado_candy: '/candy',
  empleado_entradas: '/entradas',
  cliente: '/home',
};