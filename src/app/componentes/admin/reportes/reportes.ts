import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ReporteService } from '../../../services/reporte-service';
import { FilaReporte, TotalesReporte } from '../../../modelos/reporte-model';
import { SelectorFecha } from '../../compartido/selector-fecha/selector-fecha';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { hoyAr, sumarDias } from '../../../utilidades/fechas-ar';
import { COLUMNAS_REPORTE, fechaCompleta, formatoPesos, totalizar } from '../../../utilidades/reporte';

// Reporte de facturación por día, con exportación a PDF y a Excel.
// Cada compra cuenta el día en que se pagó; las canceladas se restan el día en que se cancelaron.
@Component({
  imports: [FormField, SelectorFecha, PesosPipe],
  selector: 'app-reportes',
  styleUrl: './reportes.css',
  templateUrl: './reportes.html',
})
export class Reportes implements OnInit {
  private reporteService = inject(ReporteService);

  readonly columnas = COLUMNAS_REPORTE;
  readonly fechaCompleta = fechaCompleta;

  private model = signal({ desde: '', hasta: '' });
  rangoForm = form(this.model);

  filas = signal<FilaReporte[]>([]);
  // El período que se está mostrando (los archivos exportados usan este, no lo que se está escribiendo)
  periodo = signal<{ desde: string; hasta: string } | null>(null);
  cargando = signal(false);
  exportando = signal<'pdf' | 'excel' | null>(null);
  intentoEnvio = signal(false);
  errorMsg = signal('');

  totales = computed(() => totalizar(this.filas()));

  faltantes = computed<string[]>(() => {
    const { desde, hasta } = this.model();
    const faltan: string[] = [];
    if (!desde) faltan.push('Elegí la fecha desde la que querés el reporte');
    if (!hasta) faltan.push('Elegí la fecha hasta la que querés el reporte');
    if (desde && hasta && desde > hasta) faltan.push('La fecha "desde" no puede ser posterior a la fecha "hasta"');
    return faltan;
  });

  async ngOnInit() {
    await this.ultimosDias(30);
  }

  // ---- Atajos de período ----
  async ultimosDias(dias: number) {
    const hoy = hoyAr();
    await this.consultar(sumarDias(hoy, -(dias - 1)), hoy);
  }

  async esteMes() {
    const hoy = hoyAr();
    await this.consultar(`${hoy.slice(0, 8)}01`, hoy);
  }

  // ---- Consulta con las fechas elegidas a mano ----
  async verReporte(event: Event) {
    event.preventDefault();
    this.intentoEnvio.set(true);
    if (this.faltantes().length > 0) return;
    await this.consultar(this.model().desde, this.model().hasta);
  }

  private async consultar(desde: string, hasta: string) {
    this.model.set({ desde, hasta });
    this.intentoEnvio.set(false);
    this.errorMsg.set('');
    this.cargando.set(true);
    try {
      this.filas.set(await this.reporteService.getFacturacion(desde, hasta));
      this.periodo.set({ desde, hasta });
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo generar el reporte');
    } finally {
      this.cargando.set(false);
    }
  }

  // ---- Exportación (las librerías se cargan recién al tocar el botón) ----
  async exportarPdf() {
    await this.exportar('pdf');
  }

  async exportarExcel() {
    await this.exportar('excel');
  }

  private async exportar(formato: 'pdf' | 'excel') {
    const periodo = this.periodo();
    if (!periodo) return;

    this.errorMsg.set('');
    this.exportando.set(formato);
    try {
      if (formato === 'pdf') {
        const { descargarReportePdf } = await import('../../../utilidades/reporte-pdf');
        await descargarReportePdf(this.filas(), periodo.desde, periodo.hasta);
      } else {
        const { descargarReporteExcel } = await import('../../../utilidades/reporte-excel');
        await descargarReporteExcel(this.filas(), periodo.desde, periodo.hasta);
      }
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo generar el archivo');
    } finally {
      this.exportando.set(null);
    }
  }

  // Cómo se ve cada celda de la tabla
  valor(fila: TotalesReporte, clave: keyof TotalesReporte, tipo: 'entero' | 'pesos'): string {
    return tipo === 'pesos' ? formatoPesos(fila[clave]) : String(fila[clave]);
  }
}
