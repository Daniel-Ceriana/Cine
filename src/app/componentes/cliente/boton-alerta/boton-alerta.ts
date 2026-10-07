import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../services/auth';
import { AlertaService } from '../../../services/alerta-service';

// "Avisarme" / "Quitar aviso" de una película próxima. Hace falta cuenta: el aviso llega a Mi perfil.
// Quien lo usa tiene que haber pedido antes `alertaService.cargar()` para que se vea el estado actual.
@Component({
  imports: [RouterLink],
  selector: 'app-boton-alerta',
  styleUrl: './boton-alerta.css',
  templateUrl: './boton-alerta.html',
})
export class BotonAlerta {
  private auth = inject(Auth);
  private alertaService = inject(AlertaService);

  peliculaId = input.required<string>();

  tieneSesion = computed(() => this.auth.perfil() !== null);
  activa = computed(() => this.alertaService.activas().has(this.peliculaId()));
  procesando = signal(false);
  errorMsg = signal('');

  async alternar() {
    this.errorMsg.set('');
    this.procesando.set(true);
    try {
      await this.alertaService.alternar(this.peliculaId());
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cambiar el aviso');
    } finally {
      this.procesando.set(false);
    }
  }
}
