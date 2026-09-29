import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import {
  FuncionModel,
  FuncionConRelaciones,
  FuncionModificarPayload,
  CrearFuncionesParams,
} from '../modelos/funcion-model';

@Service()
export class FuncionService {
  private supabase = inject(SupabaseService);
  private tabla = 'funciones';

  async getById(id: string): Promise<FuncionModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as FuncionModel;
  }

  // desde: 'YYYY-MM-DD' en hora argentina; si no se pasa, trae todas
  async getAll(desde?: string): Promise<FuncionConRelaciones[]> {
    let query = this.supabase.client
      .from(this.tabla)
      .select('*, peliculas(nombre, duracion_minutos, imagen_url), salas(numero, nombre)')
      .order('inicio');

    if (desde) query = query.gte('inicio', `${desde}T00:00:00-03:00`);

    const { data, error } = await query;
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

  async modificar(id: string, payload: FuncionModificarPayload): Promise<void> {
    const { error } = await this.supabase.client.from(this.tabla).update(payload).eq('id', id);

    // 23P01 = exclusion_violation: la sala ya tiene otra función en ese horario
    if (error?.code === '23P01') {
      throw new Error('La sala de esta función ya está ocupada en ese horario.');
    }
    if (error) throw error;
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
