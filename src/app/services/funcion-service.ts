import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { precioVigente } from '../utilidades/precio-funcion';
import {
  FuncionConRelaciones,
  ResumenCancelacion,
  CrearFuncionesParams,
  ModificarFuncionesParams,
} from '../modelos/funcion-model';

const SELECT_CON_RELACIONES =
  '*, peliculas(nombre, duracion_minutos, imagen_url, fecha_estreno, restriccion_edad, precio_preventa, dias_preventa), salas(numero, nombre, formato)';

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

  // Funciones activas de una película que todavía no empezaron (para la cartelera del cliente)
  async getProximasDePelicula(peliculaId: string): Promise<FuncionConRelaciones[]> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select(SELECT_CON_RELACIONES)
      .eq('pelicula_id', peliculaId)
      .eq('activa', true)
      .gte('inicio', new Date().toISOString())
      .order('inicio');

    if (error) throw error;
    return data as unknown as FuncionConRelaciones[];
  }

  // Ids de las películas que hoy tienen alguna función en preventa. La base solo filtra lo grueso
  // (activas y futuras); si la película tiene preventa y hoy rige la preventa lo decide precioVigente,
  // la misma regla que ve el cliente en el detalle y que aplica reservar_butacas.
  async getPeliculasEnPreventa(): Promise<Set<string>> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select(SELECT_CON_RELACIONES)
      .eq('activa', true)
      .gte('inicio', new Date().toISOString());

    if (error) throw error;
    const funciones = data as unknown as FuncionConRelaciones[];
    return new Set(funciones.filter((f) => precioVigente(f).estado === 'preventa').map((f) => f.pelicula_id));
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
    });

    if (error) throw error;
    return data as number;
  }

  // Qué pasaría si se cancelan estas funciones: cuántas compras afecta y cuánto crédito se acredita
  async resumenCancelacion(ids: string[]): Promise<ResumenCancelacion> {
    const { data, error } = await this.supabase.client.rpc('resumen_cancelacion', { p_funcion_ids: ids });
    if (error) throw error;
    return data as ResumenCancelacion;
  }

  // Cancela la función (no se borra: queda activa = false para conservar el historial).
  // La base compensa a los compradores: crédito por el total y una notificación a quienes tienen cuenta.
  async cancelar(id: string): Promise<ResumenCancelacion> {
    const { data, error } = await this.supabase.client.rpc('cancelar_funcion', { p_funcion_id: id });
    if (error) throw error;
    return data as ResumenCancelacion;
  }
}
