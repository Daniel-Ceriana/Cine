import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { FiltrosLog, LogModel, UsuarioLog } from '../modelos/log-model';
import { aIsoAr, sumarDias } from '../utilidades/fechas-ar';

// El log lo escribe la base con triggers: acá solo se lee.
@Service()
export class LogService {
  private supabase = inject(SupabaseService);

  // Una página del log, de lo más nuevo a lo más viejo. `desdeIndice` es cuántos renglones ya se mostraron.
  // El día "hasta" entra completo: se pide hasta el comienzo del día siguiente.
  async getPagina(filtros: FiltrosLog, desdeIndice: number, cantidad: number): Promise<LogModel[]> {
    let consulta = this.supabase.client
      .from('log_actividad')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id')
      .range(desdeIndice, desdeIndice + cantidad - 1);

    if (filtros.usuarioId) consulta = consulta.eq('usuario_id', filtros.usuarioId);
    if (filtros.accion) consulta = consulta.eq('accion', filtros.accion);
    if (filtros.entidad) consulta = consulta.eq('entidad', filtros.entidad);
    if (filtros.desde) consulta = consulta.gte('created_at', aIsoAr(filtros.desde, '00:00'));
    if (filtros.hasta) consulta = consulta.lt('created_at', aIsoAr(sumarDias(filtros.hasta, 1), '00:00'));

    const { data, error } = await consulta;
    if (error) throw error;
    return data as LogModel[];
  }

  // Las cuentas que tienen actividad (vista log_usuarios), por nombre
  async getUsuarios(): Promise<UsuarioLog[]> {
    const { data, error } = await this.supabase.client.from('log_usuarios').select('*').order('usuario_nombre');
    if (error) throw error;
    return data as UsuarioLog[];
  }
}
