import { PeliculaModel } from '../modelos/pelicula-model';
import { hoyAr } from './fechas-ar';

// Una película es "próxima" si se estrena en el futuro y todavía no se puede comprar ninguna de sus funciones
// (no está en preventa). `enPreventa` son los ids de las películas con alguna función en preventa hoy.
// Cuando abre la venta, deja de ser próxima y pasa a la cartelera.
export function esProxima(pelicula: Pick<PeliculaModel, 'id' | 'fecha_estreno'>, enPreventa: Set<string>): boolean {
  return hoyAr() < pelicula.fecha_estreno && !enPreventa.has(pelicula.id);
}
