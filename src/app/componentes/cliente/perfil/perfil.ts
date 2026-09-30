import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Auth } from '../../../services/auth';
import { PuntosService } from '../../../services/puntos-service';
import { NotificacionService } from '../../../services/notificacion-service';
import { MovimientoPuntos } from '../../../modelos/puntos-model';
import { NotificacionModel } from '../../../modelos/notificacion-model';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { DiaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { PuntosPipe, TipoMovimientoPipe } from '../../../pipes/puntos/puntos.pipes';

type Pestana = 'resumen' | 'notificaciones';
type FiltroMovimientos = 'todos' | 'canjes';

// "Mi perfil": datos de la cuenta, puntos con su historial y notificaciones.
// (El sistema no envía mails: todos los avisos se ven acá.)
@Component({
  imports: [PesosPipe, DiaArPipe, HoraArPipe, PuntosPipe, TipoMovimientoPipe],
  selector: 'app-perfil',
  styleUrl: './perfil.css',
  templateUrl: './perfil.html',
})
export class Perfil implements OnInit {
  private auth = inject(Auth);
  private puntosService = inject(PuntosService);
  private notificacionService = inject(NotificacionService);

  perfil = this.auth.perfil;
  email = computed(() => this.auth.sesion()?.user.email ?? '');

  pestana = signal<Pestana>('resumen');
  filtro = signal<FiltroMovimientos>('todos');

  movimientos = signal<MovimientoPuntos[]>([]);
  notificaciones = signal<NotificacionModel[]>([]);
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
      const [movimientos, notificaciones] = await Promise.all([
        this.puntosService.getMovimientos(id),
        this.notificacionService.getMias(id),
        this.auth.refrescarPerfil(),
      ]);
      this.movimientos.set(movimientos);
      this.notificaciones.set(notificaciones);
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
}
