import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { CuponAplicable, CuponModel, CuponPayload } from '../modelos/cupon-model';

@Service()
export class CuponService {
  private supabase = inject(SupabaseService);
  private tabla = 'cupones';

  // Primero el de primera compra y después los de edad, del menor al mayor
  async getAll(): Promise<CuponModel[]> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .select('*')
      .order('tipo', { ascending: false })
      .order('edad_min', { ascending: true, nullsFirst: true });

    if (error) throw error;
    return data as CuponModel[];
  }

  async crear(payload: CuponPayload): Promise<CuponModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as CuponModel;
  }

  async modificar(id: string, payload: CuponPayload): Promise<CuponModel> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CuponModel;
  }

  // El cupón que le corresponde hoy a quien tiene la sesión iniciada (null si no le corresponde ninguno).
  // Lo decide la base (función mi_cupon); la misma regla se usa al reservar.
  async getMio(): Promise<CuponAplicable | null> {
    const { data, error } = await this.supabase.client.rpc('mi_cupon');
    if (error) throw error;
    return (data as CuponAplicable | null) ?? null;
  }
}
