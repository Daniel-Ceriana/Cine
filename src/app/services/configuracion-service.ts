import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { ConfiguracionModel } from '../modelos/credito-model';

@Service()
export class ConfiguracionService {
  private supabase = inject(SupabaseService);

  async getTodas(): Promise<ConfiguracionModel[]> {
    const { data, error } = await this.supabase.client.from('configuracion').select('*').order('clave');
    if (error) throw error;
    return data as ConfiguracionModel[];
  }

  async getValor(clave: string): Promise<number> {
    const { data, error } = await this.supabase.client
      .from('configuracion')
      .select('valor')
      .eq('clave', clave)
      .single();

    if (error) throw error;
    return Number(data.valor);
  }

  async guardar(clave: string, valor: number): Promise<void> {
    const { error } = await this.supabase.client.from('configuracion').update({ valor }).eq('clave', clave);
    if (error) throw error;
  }
}
