import { Service } from '@angular/core';
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase-service'; 
import { PeliculaModel,PeliculaConGeneros, Genero } from '../modelos/pelicula-model';

export type PeliculaModelPayload = Omit<PeliculaModel, 'id' | 'created_at'>;


@Service()
export class PeliculaService {
  private supabase = inject(SupabaseService);
  private tabla = 'peliculas';
  private bucket = 'imagenes';
  private carpeta = 'Models';

  async getById(id: string): Promise<PeliculaModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as PeliculaModel;
  }

  async getByIdConGeneros(id: string): Promise<PeliculaConGeneros> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select('*, generos(id, nombre)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as unknown as PeliculaConGeneros;
  }

  // Las más vendidas de los últimos `dias` días (función SQL peliculas_mas_vendidas), de mayor a menor.
  // Solo se devuelven las que siguen activas.
  async getMasVendidas(dias = 30, limite = 3): Promise<PeliculaConGeneros[]> {
    const { data: ranking, error } = await this.supabase.client.rpc('peliculas_mas_vendidas', {
      p_dias: dias,
      p_limite: limite,
    });
    if (error) throw error;

    const ids = (ranking as { pelicula_id: string }[]).map((r) => r.pelicula_id);
    if (ids.length === 0) return [];

    const { data, error: errorPeliculas } = await this.supabase.client
      .from(this.tabla)
      .select('*, generos(id, nombre)')
      .in('id', ids)
      .eq('activa', true);
    if (errorPeliculas) throw errorPeliculas;

    const porId = new Map((data as unknown as PeliculaConGeneros[]).map((p) => [p.id, p]));
    return ids.map((id) => porId.get(id)).filter((p): p is PeliculaConGeneros => !!p);
  }

 async getAll(soloActivas = false): Promise<PeliculaConGeneros[]> {
  let query = this.supabase.client
    .from(this.tabla)
    .select('*, generos(id, nombre)')
    .order('created_at', { ascending: false });

  if (soloActivas) query = query.eq('activa', true);

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as PeliculaConGeneros[];
}

async getGeneros(): Promise<Genero[]> {
  const { data, error } = await this.supabase.client
    .from('generos')
    .select('id, nombre')
    .order('nombre');

  if (error) throw error;
  return data as Genero[];
}


async setGeneros(peliculaId: string, generoIds: number[]): Promise<void> {
  const { error: delError } = await this.supabase.client
    .from('pelicula_generos')
    .delete()
    .eq('pelicula_id', peliculaId);
  if (delError) throw delError;

  if (generoIds.length === 0) return;

  const { error } = await this.supabase.client
    .from('pelicula_generos')
    .insert(generoIds.map((genero_id) => ({ pelicula_id: peliculaId, genero_id })));
  if (error) throw error;
}

async getGeneroIdsDePelicula(peliculaId: string): Promise<number[]> {
  const { data, error } = await this.supabase.client
    .from('pelicula_generos')
    .select('genero_id')
    .eq('pelicula_id', peliculaId);

  if (error) throw error;
  return (data ?? []).map((r) => r.genero_id as number);
}

  async crear(payload: PeliculaModelPayload): Promise<PeliculaModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as PeliculaModel;
  }

  async modificar(id: string, payload: PeliculaModelPayload): Promise<PeliculaModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as PeliculaModel;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from(this.tabla)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async subirImagen(file: File): Promise<string> {
    const extension = file.name.split('.').pop();
    const nombreArchivo = `${crypto.randomUUID()}.${extension}`;
    const ruta = `peliculas/${nombreArchivo}`;

    const { error } = await this.supabase.client.storage
      .from('imagenes')
      .upload(ruta, file, { upsert: false });

    if (error) throw error;

    const { data } = this.supabase.client.storage.from('imagenes').getPublicUrl(ruta);
    return data.publicUrl;
  }
}




