import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import {
  FuncionConRelaciones,
  CrearFuncionesParams,
  ModificarFuncionesParams,
} from '../modelos/funcion-model';

const SELECT_CON_RELACIONES =
  '*, peliculas(nombre, duracion_minutos, imagen_url), salas(numero, nombre, formato)';

@Service()
export class FuncionService {
  private supabase = inject(SupabaseService);
  private tabla = 'funciones';

  async getById(id: string): Promise<FuncionConRelaciones> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select(SELECT_CON_RELACIONES)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as unknown as FuncionConRelaciones;
  }

  async getAll(): Promise<FuncionConRelaciones[]> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select(SELECT_CON_RELACIONES)
      .order('inicio');

    if (error) throw error;
    return data as unknown as FuncionConRelaciones[];
  }

  // Funciones activas de una serie desde un momento en adelante (para precargar el modificar)
  async getSerieDesde(serieId: string, desdeIso: string): Promise<FuncionConRelaciones[]> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select(SELECT_CON_RELACIONES)
      .eq('serie_id', serieId)
      .eq('activa', true)
      .gte('inicio', desdeIso)
      .order('inicio');

    if (error) throw error;
    return data as unknown as FuncionConRelaciones[];
  }

  // Llama a la función SQL crear_funciones, que asigna sala automáticamente.
  // Si alguna fecha no tiene sala libre el error trae el mensaje con los días.
  async crearVarias(params: CrearFuncionesParams): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('crear_funciones', {
      p_pelicula_id: params.pelicula_id,
      p_fechas: params.fechas,
      p_hora: params.hora,
      p_formato: params.formato,
      p_idioma: params.idioma,
      p_precio_base: params.precio_base,
      p_precio_preventa: params.precio_preventa,
      p_dias_preventa: params.dias_preventa,
    });

    if (error) throw error;
    return data as number;
  }

  // Modifica una función o esa y las siguientes de su serie (ver modificar_funciones en el SQL)
  async modificarVarias(params: ModificarFuncionesParams): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('modificar_funciones', {
      p_funcion_id: params.funcion_id,
      p_alcance: params.alcance,
      p_fechas: params.fechas,
      p_hora: params.hora,
      p_pelicula_id: params.pelicula_id,
      p_formato: params.formato,
      p_idioma: params.idioma,
      p_precio_base: params.precio_base,
      p_precio_preventa: params.precio_preventa,
      p_dias_preventa: params.dias_preventa,
    });

    if (error) throw error;
    return data as number;
  }

  // Se cancela con activa = false (no se borra) para conservar el historial
  async cancelar(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from(this.tabla)
      .update({ activa: false })
      .eq('id', id);

    if (error) throw error;
  }
}
