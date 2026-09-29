export interface PeliculaModel {

  id: string;
  nombre: string;
  sinopsis:string;
  imagen_url:string;
  duracion_minutos:number;
  restriccion_edad: number;
  fecha_estreno: string;
  activa:boolean;
    destacada: boolean;
  created_at: string;
}

export interface PeliculaModelForm {
  nombre: string;
  sinopsis: string;
  imagen_url: string;
  duracion_minutos: number;
  restriccion_edad: string;
  fecha_estreno: string;
  activa: boolean;
  destacada: boolean;
}

export interface Genero {
  id: number;
  nombre: string;
}

export interface PeliculaConGeneros extends PeliculaModel {
  generos: Genero[];
}
