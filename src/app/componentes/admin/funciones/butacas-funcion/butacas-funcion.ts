import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FuncionService } from '../../../../services/funcion-service';
import { ButacaService } from '../../../../services/butaca-service';
import { FuncionConRelaciones } from '../../../../modelos/funcion-model';
import { OcupacionButaca } from '../../../../modelos/compra-model';
import { BUTACAS, TOTAL_BUTACAS } from '../../../../modelos/sala-plantilla';
import { MapaButacas } from '../../../compartido/mapa-butacas/mapa-butacas';
import { formatearDia, formatearHora } from '../../../../utilidades/fechas-ar';

// Cada tanto se vuelve a consultar por si se perdió algún aviso de tiempo real
// y para que las reservas vencidas desaparezcan del mapa.
const REFRESCO_MS = 15_000;

@Component({
  imports: [RouterLink, MapaButacas],
  selector: 'app-butacas-funcion',
  styleUrl: './butacas-funcion.css',
  templateUrl: './butacas-funcion.html',
})
export class ButacasFuncion implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private funcionService = inject(FuncionService);
  private butacaService = inject(ButacaService);

  private funcionId = '';
  private cancelarSuscripcion: (() => void) | null = null;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  funcion = signal<FuncionConRelaciones | null>(null);
  ocupacion = signal<OcupacionButaca[]>([]);
  codigoElegido = signal<string | null>(null);
  cargando = signal(false);
  errorMsg = signal('');

  vendidas = computed(() => this.ocupacion().filter((o) => o.estado === 'vendida'));
  enProceso = computed(() => this.ocupacion().filter((o) => o.estado === 'reservada').length);
  libres = computed(() => TOTAL_BUTACAS - this.ocupacion().length);
  recaudacion = computed(() => this.vendidas().reduce((suma, o) => suma + Number(o.precio), 0));

  // Datos de la butaca que se tocó en el mapa
  detalle = computed(() => {
    const codigo = this.codigoElegido();
    if (!codigo) return null;
    return {
      codigo,
      tipo: BUTACAS.find((b) => b.codigo === codigo)?.tipo ?? 'normal',
      ocupacion: this.ocupacion().find((o) => o.butaca_codigo === codigo) ?? null,
    };
  });

  async ngOnInit() {
    this.funcionId = this.route.snapshot.paramMap.get('id') ?? '';
    this.cargando.set(true);
    try {
      this.funcion.set(await this.funcionService.getById(this.funcionId));
      await this.cargarOcupacion();

      // Cada vez que alguien reserva, paga o libera una butaca de esta función, se recarga
      this.cancelarSuscripcion = this.butacaService.suscribirCambios(this.funcionId, () => this.cargarOcupacion());
      this.temporizador = setInterval(() => this.cargarOcupacion(), REFRESCO_MS);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar la función');
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    this.cancelarSuscripcion?.();
    if (this.temporizador) clearInterval(this.temporizador);
  }

  private async cargarOcupacion() {
    try {
      this.ocupacion.set(await this.butacaService.getOcupacion(this.funcionId));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las butacas');
    }
  }

  onButacaClick(codigo: string) {
    this.codigoElegido.set(this.codigoElegido() === codigo ? null : codigo);
  }

  dia(iso: string): string {
    return formatearDia(iso);
  }

  hora(iso: string): string {
    return formatearHora(iso);
  }

  pesos(monto: number): string {
    return `$ ${Number(monto).toLocaleString('es-AR')}`;
  }

  fechaHora(iso: string): string {
    return `${formatearDia(iso)} ${formatearHora(iso)}`;
  }
}
