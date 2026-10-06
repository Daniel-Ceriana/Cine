export interface PeliculaModel {

  id: string;
  nombre: string;
  sinopsis:string;
  imagen_url:string;
  duracion_minutos:number;
  restriccion_edad: number;
  fecha_estreno: string;
  precio_preventa: number; // precio especial antes del estreno (0 si no hay preventa)
  dias_preventa: number; // cuántos días antes del estreno abre la venta (0 = sin preventa)
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
  precio_preventa: number;
  dias_preventa: number;
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
