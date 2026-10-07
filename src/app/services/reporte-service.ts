import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { FilaReporte } from '../modelos/reporte-model';

@Service()
export class ReporteService {
  private supabase = inject(SupabaseService);

  // Facturación por día entre dos fechas 'YYYY-MM-DD' (función SQL reporte_facturacion, solo admin).
  // Los importes de la base llegan como texto: se pasan a número.
  async getFacturacion(desde: string, hasta: string): Promise<FilaReporte[]> {
    const { data, error } = await this.supabase.client.rpc('reporte_facturacion', {
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error) throw error;

    return (data as Record<string, string | number>[]).map((f) => ({
      dia: String(f['dia']),
      compras: Number(f['compras']),
      entradas: Number(f['entradas']),
      entradas_con_puntos: Number(f['entradas_con_puntos']),
      ventas_entradas: Number(f['ventas_entradas']),
      ventas_candy: Number(f['ventas_candy']),
      ventas_total: Number(f['ventas_total']),
      credito_usado: Number(f['credito_usado']),
      cobrado_dinero: Number(f['cobrado_dinero']),
      canceladas: Number(f['canceladas']),
      entradas_canceladas: Number(f['entradas_canceladas']),
      cancelado: Number(f['cancelado']),
      neto: Number(f['neto']),
    }));
  }
}
