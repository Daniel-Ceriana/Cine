import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { Rol } from '../modelos/user-model';

// Cuenta de usuario tal como se muestra en la pantalla de empleados
export interface CuentaPersonal {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
}

const COLUMNAS = 'id, email, nombre, apellido, rol';

@Service()
export class EmpleadoService {
  private supabase = inject(SupabaseService);

  // Personal actual: todas las cuentas con un rol distinto de cliente
  async getPersonal(): Promise<CuentaPersonal[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select(COLUMNAS)
      .neq('rol', 'cliente')
      .order('apellido');

    if (error) throw error;
    return data as CuentaPersonal[];
  }

  // Busca una cuenta por su email exacto (null si no existe)
  async buscarPorEmail(email: string): Promise<CuentaPersonal | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select(COLUMNAS)
      .ilike('email', email.trim())
      .maybeSingle();

    if (error) throw error;
    return data as CuentaPersonal | null;
  }

  async cambiarRol(id: string, rol: Rol): Promise<void> {
    const { error } = await this.supabase.client.from('profiles').update({ rol }).eq('id', id);
    if (error) throw error;
  }
}
