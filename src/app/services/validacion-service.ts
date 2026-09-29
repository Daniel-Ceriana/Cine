import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { ResultadoCodigo, SeccionValidacion } from '../modelos/validacion-model';

// Validación de entradas y candy por código. Toda la lógica (permisos, horario, un solo uso)
// está en las funciones SQL; acá solo se las llama.
@Service()
export class ValidacionService {
  private supabase = inject(SupabaseService);

  // Muestra qué compra es y si se puede validar ahora, sin modificar nada
  async consultar(codigo: string, seccion: SeccionValidacion): Promise<ResultadoCodigo> {
    const { data, error } = await this.supabase.client.rpc('evaluar_codigo', {
      p_codigo: codigo,
      p_seccion: seccion,
    });

    if (error) throw error;
    return data as ResultadoCodigo;
  }

  // Marca la sección como usada. Si el código ya se usó, la función SQL lanza un error con el motivo.
  async validar(codigo: string, seccion: SeccionValidacion): Promise<ResultadoCodigo> {
    const { data, error } = await this.supabase.client.rpc('validar_codigo', {
      p_codigo: codigo,
      p_seccion: seccion,
    });

    if (error) throw error;
    return data as ResultadoCodigo;
  }
}
