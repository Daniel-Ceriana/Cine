import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { MiPelicula, PuntuacionPelicula, ReseniaConAutor, ReseniaModel } from '../modelos/resenia-model';

@Service()
export class ReseniaService {
  private supabase = inject(SupabaseService);

  // Reseñas de una película, de la más nueva a la más vieja, con el nombre de quien la escribió
  async getDePelicula(peliculaId: string): Promise<ReseniaConAutor[]> {
    const { data, error } = await this.supabase.client
      .from('resenias')
      .select('*, profiles(nombre, apellido)')
      .eq('pelicula_id', peliculaId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as unknown as ReseniaConAutor[];
  }

  // Promedio y cantidad de una película (null si todavía no tiene reseñas)
  async getPuntuacion(peliculaId: string): Promise<PuntuacionPelicula | null> {
    const { data, error } = await this.supabase.client
      .from('peliculas_puntuacion')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .maybeSingle();

    if (error) throw error;
    return data ? { ...data, promedio: Number(data.promedio) } : null;
  }

  // Promedio y cantidad de todas las películas que tienen reseñas, por id de película (para la cartelera)
  async getPuntuaciones(): Promise<Map<string, PuntuacionPelicula>> {
    const { data, error } = await this.supabase.client.from('peliculas_puntuacion').select('*');
    if (error) throw error;

    return new Map(
      (data ?? []).map((p) => [p.pelicula_id as string, { ...p, promedio: Number(p.promedio) } as PuntuacionPelicula]),
    );
  }

  // ¿La cuenta vio la película? Solo entonces puede reseñarla (función SQL puede_resenar)
  async puedeResenar(peliculaId: string): Promise<boolean> {
    const { data, error } = await this.supabase.client.rpc('puede_resenar', { p_pelicula_id: peliculaId });
    if (error) throw error;
    return data === true;
  }

  // Crea la reseña de la cuenta o modifica la que ya tenía (función SQL guardar_resenia)
  async guardar(peliculaId: string, estrellas: number, comentario: string): Promise<ReseniaModel> {
    const { data, error } = await this.supabase.client.rpc('guardar_resenia', {
      p_pelicula_id: peliculaId,
      p_estrellas: estrellas,
      p_comentario: comentario.trim() || null,
    });

    if (error) throw error;
    return data as ReseniaModel;
  }

  async eliminar(peliculaId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('eliminar_resenia', { p_pelicula_id: peliculaId });
    if (error) throw error;
  }

  // Las películas que vio la cuenta, con su reseña si hizo una (función SQL mis_peliculas)
  async getMisPeliculas(): Promise<MiPelicula[]> {
    const { data, error } = await this.supabase.client.rpc('mis_peliculas');
    if (error) throw error;
    return data as MiPelicula[];
  }
}
