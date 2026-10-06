import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Auth } from '../../../services/auth';
import { PuntosService } from '../../../services/puntos-service';
import { NotificacionService } from '../../../services/notificacion-service';
import { CompraService } from '../../../services/compra-service';
import { CreditoService } from '../../../services/credito-service';
import { ConfiguracionService } from '../../../services/configuracion-service';
import { TarjetaCompra } from '../../compartido/tarjeta-compra/tarjeta-compra';
import { CompraDetalle } from '../../../modelos/compra-model';
import { MovimientoCredito } from '../../../modelos/credito-model';
import { MovimientoPuntos } from '../../../modelos/puntos-model';
import { NotificacionModel } from '../../../modelos/notificacion-model';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { DiaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { PuntosPipe, TipoMovimientoPipe } from '../../../pipes/puntos/puntos.pipes';

type Pestana = 'compras' | 'resumen' | 'notificaciones';
type FiltroMovimientos = 'todos' | 'canjes';

// "Mi perfil": mis compras (con cancelación), puntos, crédito, datos y notificaciones.
// (El sistema no envía mails: todos los avisos se ven acá.)
@Component({
  imports: [TarjetaCompra, PesosPipe, DiaArPipe, HoraArPipe, PuntosPipe, TipoMovimientoPipe],
  selector: 'app-perfil',
  styleUrl: './perfil.css',
  templateUrl: './perfil.html',
})
export class Perfil implements OnInit {
  private auth = inject(Auth);
  private puntosService = inject(PuntosService);
  private notificacionService = inject(NotificacionService);
  private compraService = inject(CompraService);
  private creditoService = inject(CreditoService);
  private configuracionService = inject(ConfiguracionService);

  perfil = this.auth.perfil;
  email = computed(() => this.auth.sesion()?.user.email ?? '');

  pestana = signal<Pestana>('compras');
  filtro = signal<FiltroMovimientos>('todos');

  movimientos = signal<MovimientoPuntos[]>([]);
  notificaciones = signal<NotificacionModel[]>([]);
  compras = signal<CompraDetalle[]>([]);
  movimientosCredito = signal<MovimientoCredito[]>([]);
  horasCancelacion = signal(2);
  cancelandoId = signal<string | null>(null);
  okMsg = signal('');
  cargando = signal(false);
  errorMsg = signal('');

  movimientosVisibles = computed(() =>
    this.filtro() === 'canjes' ? this.movimientos().filter((m) => m.tipo === 'canje') : this.movimientos(),
  );
  noLeidas = computed(() => this.notificaciones().filter((n) => !n.leida).length);

  async ngOnInit() {
    const id = this.perfil()?.id;
    if (!id) return;

    this.cargando.set(true);
    try {
      // el saldo se relee por si cambió desde que se abrió la aplicación (ej.: después de una compra)
      const [movimientos, notificaciones, compras, movimientosCredito, horas] = await Promise.all([
        this.puntosService.getMovimientos(id),
        this.notificacionService.getMias(id),
        this.compraService.getMias(id),
        this.creditoService.getMovimientos(id),
        this.configuracionService.getValor('horas_cancelacion').catch(() => 2),
        this.auth.refrescarPerfil(),
      ]);
      this.movimientos.set(movimientos);
      this.notificaciones.set(notificaciones);
      this.compras.set(compras);
      this.movimientosCredito.set(movimientosCredito);
      this.horasCancelacion.set(horas);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar tu perfil');
    } finally {
      this.cargando.set(false);
    }
  }

  async marcarLeida(n: NotificacionModel) {
    if (n.leida) return;
    try {
      await this.notificacionService.marcarLeida(n.id);
      this.notificaciones.update((lista) => lista.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo marcar como leída');
    }
  }

  async marcarTodasLeidas() {
    const id = this.perfil()?.id;
    if (!id || this.noLeidas() === 0) return;
    try {
      await this.notificacionService.marcarTodasLeidas(id);
      this.notificaciones.update((lista) => lista.map((x) => ({ ...x, leida: true })));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron marcar como leídas');
    }
  }

  // Cancela la compra: la base libera las butacas, acredita el crédito y devuelve/quita los puntos.
  // Después se vuelve a leer todo lo que cambió (compras, saldos, historiales y el aviso nuevo).
  async cancelarCompra(compra: CompraDetalle) {
    const id = this.perfil()?.id;
    if (!id) return;

    this.errorMsg.set('');
    this.okMsg.set('');
    this.cancelandoId.set(compra.id);
    try {
      await this.compraService.cancelar(compra.id);
      const [compras, movimientosCredito, movimientos, notificaciones] = await Promise.all([
        this.compraService.getMias(id),
        this.creditoService.getMovimientos(id),
        this.puntosService.getMovimientos(id),
        this.notificacionService.getMias(id),
        this.auth.refrescarPerfil(),
      ]);
      this.compras.set(compras);
      this.movimientosCredito.set(movimientosCredito);
      this.movimientos.set(movimientos);
      this.notificaciones.set(notificaciones);
      this.okMsg.set('Compra cancelada. El crédito ya está en tu cuenta.');
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cancelar la compra');
    } finally {
      this.cancelandoId.set(null);
    }
  }
}
