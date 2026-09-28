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

 async getAll(soloActivas = false): Promise<PeliculaConGeneros[]> {
  let query = this.supabase.client
    .from(this.tabla)
    .select('*, generos(id, nombre)') // PostgREST resuelve la tabla intermedia pelicula_generos solo
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

// Reemplaza los géneros de una película (para usar desde crear/modificar)
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




