import { Component, inject, signal, OnInit } from '@angular/core';
import { PuntosService } from '../../../services/puntos-service';
import { RecompensaModel } from '../../../modelos/puntos-model';

interface Edicion {
  costo: string; // texto, porque el campo puede estar vacío mientras se escribe
  activa: boolean;
}

// El admin define cuántos puntos cuesta canjear cada recompensa.
// Los puntos se ganan solos: 1 por cada peso efectivamente pagado (ya con el descuento aplicado).
@Component({
  selector: 'app-puntos',
  styleUrl: './puntos.css',
  templateUrl: './puntos.html',
})
export class Puntos implements OnInit {
  private puntosService = inject(PuntosService);

  recompensas = signal<RecompensaModel[]>([]);
  // lo que se está editando de cada recompensa, por id
  ediciones = signal<Record<string, Edicion>>({});
  cargando = signal(false);
  guardandoId = signal<string | null>(null);
  errorMsg = signal('');
  okMsg = signal('');

  async ngOnInit() {
    this.cargando.set(true);
    try {
      const lista = await this.puntosService.getRecompensas();
      this.recompensas.set(lista);
      this.ediciones.set(
        Object.fromEntries(lista.map((r) => [r.id, { costo: String(r.costo_puntos), activa: r.activa }])),
      );
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las recompensas');
    } finally {
      this.cargando.set(false);
    }
  }

  editar(id: string, cambios: Partial<Edicion>) {
    this.ediciones.update((e) => ({ ...e, [id]: { ...e[id], ...cambios } }));
  }

  async guardar(r: RecompensaModel) {
    this.errorMsg.set('');
    this.okMsg.set('');

    const edicion = this.ediciones()[r.id];
    const costo = Number(edicion.costo);
    if (!Number.isInteger(costo) || costo <= 0) {
      this.errorMsg.set('El costo en puntos tiene que ser un número entero mayor a 0');
      return;
    }

    this.guardandoId.set(r.id);
    try {
      await this.puntosService.modificarRecompensa(r.id, { costo_puntos: costo, activa: edicion.activa });
      this.recompensas.update((lista) =>
        lista.map((x) => (x.id === r.id ? { ...x, costo_puntos: costo, activa: edicion.activa } : x)),
      );
      this.okMsg.set(`Se guardó "${r.nombre}".`);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo guardar');
    } finally {
      this.guardandoId.set(null);
    }
  }
}
