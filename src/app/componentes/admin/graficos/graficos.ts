import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ReporteService } from '../../../services/reporte-service';
import { FilaRanking } from '../../../modelos/ranking-model';
import { GraficoBarras } from '../../compartido/grafico-barras/grafico-barras';
import { hoyAr } from '../../../utilidades/fechas-ar';
import { moverPeriodo, periodoDe, VistaPeriodo } from '../../../utilidades/periodos';

// Gráficos del admin: las películas, los productos y los combos más vendidos de la semana o del mes.
// El período se mide por el día de la función; las compras canceladas no cuentan.
@Component({
  imports: [GraficoBarras],
  selector: 'app-graficos',
  styleUrl: './graficos.css',
  templateUrl: './graficos.html',
})
export class Graficos implements OnInit {
  private reporteService = inject(ReporteService);

  vista = signal<VistaPeriodo>('semana');
  // Un día cualquiera del período que se está mirando (las flechas lo mueven de a una semana o un mes)
  referencia = signal(hoyAr());
  periodo = computed(() => periodoDe(this.vista(), this.referencia()));
  esActual = computed(() => this.periodo().desde === periodoDe(this.vista(), hoyAr()).desde);

  peliculas = signal<FilaRanking[]>([]);
  productos = signal<FilaRanking[]>([]);
  combos = signal<FilaRanking[]>([]);
  cargando = signal(false);
  errorMsg = signal('');

  private consulta = 0; // si se cambia de período mientras se carga, solo vale la última consulta

  async ngOnInit() {
    await this.cargar();
  }

  async elegirVista(vista: VistaPeriodo) {
    this.vista.set(vista);
    await this.cargar();
  }

  async mover(direccion: -1 | 1) {
    this.referencia.set(moverPeriodo(this.vista(), this.referencia(), direccion));
    await this.cargar();
  }

  async hoy() {
    this.referencia.set(hoyAr());
    await this.cargar();
  }

  private async cargar() {
    const consulta = ++this.consulta;
    const { desde, hasta } = this.periodo();
    this.errorMsg.set('');
    this.cargando.set(true);
    try {
      const [peliculas, productos, combos] = await Promise.all([
        this.reporteService.getRanking('peliculas', desde, hasta),
        this.reporteService.getRanking('productos', desde, hasta),
        this.reporteService.getRanking('combos', desde, hasta),
      ]);
      if (consulta !== this.consulta) return;
      this.peliculas.set(peliculas);
      this.productos.set(productos);
      this.combos.set(combos);
    } catch (e: any) {
      if (consulta === this.consulta) this.errorMsg.set(e?.message ?? 'No se pudieron cargar los gráficos');
    } finally {
      if (consulta === this.consulta) this.cargando.set(false);
    }
  }
}
