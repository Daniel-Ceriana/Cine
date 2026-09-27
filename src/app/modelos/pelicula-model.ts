// export interface PeliculaModel {

//   id: string;
//   nombre: string;
//   sinopsis:string;
//   imagen_url:string;
//   duracion_minutos:number;
//   formato: '2D'| '3D' | '4D' | '5D';
//   idioma: string;
//   restriccion_edad: number;
//   fecha_estreno: string;
//   precio_base: number;
//   precio_preventa: number | null;
//   dias_preventa: number | null;
//   activa:boolean;
//   created_at: string;
// }

interface PeliculaForm {
  nombre: string;
  sinopsis: string;
  imagen_url: string;
  duracion_minutos: number;
  formato: '2D' | '3D' | '4D' | '5D';
  idioma: string;
  restriccion_edad: string;
  fecha_estreno: string;
  precio_base: number;
  precio_preventa: number;
  dias_preventa: number;
  activa: boolean;
  destacada: boolean;
}