export interface ReseniaModel {
  id: string;
  pelicula_id: string;
  usuario_id: string;
  estrellas: number; // de 1 a 5
  comentario: string | null; // opcional, hasta 300 caracteres
  created_at: string;
  updated_at: string;
}

// La reseña con el nombre de quien la escribió
export interface ReseniaConAutor extends ReseniaModel {
  profiles: { nombre: string; apellido: string } | null;
}

// Promedio (con un decimal) y cantidad de reseñas de una película (vista peliculas_puntuacion)
export interface PuntuacionPelicula {
  pelicula_id: string;
  promedio: number;
  cantidad: number;
}

// Una película que vio la cuenta, con la última función que vio y su reseña si hizo una (función SQL mis_peliculas)
export interface MiPelicula {
  pelicula_id: string;
  ultima_funcion: string;
  resenia_id: string | null;
  estrellas: number | null;
  comentario: string | null;
  resenia_fecha: string | null;
}

// Una película vista, con los datos para mostrarla en el perfil
export interface MiPeliculaConDatos extends MiPelicula {
  nombre: string;
  imagen_url: string;
}

export const MAX_COMENTARIO_RESENIA = 300;
