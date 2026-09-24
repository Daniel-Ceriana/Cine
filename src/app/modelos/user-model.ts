export interface UserModel {

id: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
  rol: 'cliente'| 'empleado' | 'admin';
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
