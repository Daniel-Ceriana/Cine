import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { FilaReporte } from '../modelos/reporte-model';
import { FilaRanking, TipoRanking } from '../modelos/ranking-model';

// Consultas del admin sobre las ventas: el reporte de facturación y los rankings de los gráficos.
// Todas son funciones SQL que solo puede usar el admin.
@Service()
export class ReporteService {
  private supabase = inject(SupabaseService);

  // Facturación por día entre dos fechas 'YYYY-MM-DD' (función SQL reporte_facturacion).
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

  // Los más vendidos de un período, de mayor a menor (funciones SQL ranking_peliculas, ranking_productos y
  // ranking_combos). El período se mide por el día de la función.
  async getRanking(tipo: TipoRanking, desde: string, hasta: string, limite = 5): Promise<FilaRanking[]> {
    const { data, error } = await this.supabase.client.rpc(`ranking_${tipo}`, {
      p_desde: desde,
      p_hasta: hasta,
      p_limite: limite,
    });
    if (error) throw error;

    return (data as { nombre: string; cantidad: string | number }[]).map((f) => ({
      nombre: f.nombre,
      cantidad: Number(f.cantidad),
    }));
  }
}
