import { Component, DestroyRef, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

// Cada cuánto se busca una versión nueva mientras la app está abierta
const BUSCAR_CADA_MS = 15 * 60 * 1000;

// Aviso de "hay una versión nueva". El service worker de Angular baja la versión nueva en segundo plano, pero la app abierta
// sigue con la vieja hasta recargar. Acá se le avisa a la persona y ella elige cuándo actualizar (así no se interrumpe una compra).
// Solo funciona en producción, igual que el service worker.
@Component({
  selector: 'app-aviso-version',
  styleUrl: './aviso-version.css',
  templateUrl: './aviso-version.html',
})
export class AvisoVersion {
  private actualizaciones = inject(SwUpdate);

  hayVersionNueva = signal(false);
  actualizando = signal(false);

  constructor() {
    if (!this.actualizaciones.isEnabled) return;

    // La versión nueva ya está descargada y lista para usar
    const suscripcion = this.actualizaciones.versionUpdates
      .pipe(filter((evento): evento is VersionReadyEvent => evento.type === 'VERSION_READY'))
      .subscribe(() => this.hayVersionNueva.set(true));

    // Se busca una versión nueva cada tanto y cada vez que la persona vuelve a la app
    const buscar = () => this.actualizaciones.checkForUpdate().catch(() => false);
    const cadaTanto = setInterval(buscar, BUSCAR_CADA_MS);
    const alVolver = () => {
      if (document.visibilityState === 'visible') buscar();
    };
    document.addEventListener('visibilitychange', alVolver);

    inject(DestroyRef).onDestroy(() => {
      suscripcion.unsubscribe();
      clearInterval(cadaTanto);
      document.removeEventListener('visibilitychange', alVolver);
    });
  }

  async actualizar() {
    this.actualizando.set(true);
    try {
      await this.actualizaciones.activateUpdate();
    } finally {
      document.location.reload();
    }
  }

  despues() {
    this.hayVersionNueva.set(false);
  }
}
