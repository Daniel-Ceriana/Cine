import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { CompraService } from '../../../services/compra-service';
import { Auth } from '../../../services/auth';
import { CompraDetalle } from '../../../modelos/compra-model';
import { ConfirmarSalida, confirmarDescartar } from '../../../guards/salida-guard';
import { TarjetaCompra } from '../../compartido/tarjeta-compra/tarjeta-compra';

// "Mi entrada": quien compró sin cuenta no tiene sesión, así que recupera su entrada con
// el código de la compra y el email que usó. Con cuenta, las compras están en Mi perfil.
// Desde acá no se cancela: el crédito se acredita en una cuenta y quien compró sin cuenta no tiene.
@Component({
  imports: [RouterLink, FormField, TarjetaCompra],
  selector: 'app-mi-entrada',
  styleUrl: './mi-entrada.css',
  templateUrl: './mi-entrada.html',
})
export class MiEntrada implements ConfirmarSalida {
  private compraService = inject(CompraService);
  private auth = inject(Auth);

  private model = signal({ codigo: '', email: '' });
  datosForm = form(this.model);

  tieneSesion = computed(() => this.auth.perfil() !== null);
  compra = signal<CompraDetalle | null>(null);
  buscando = signal(false);
  intentoEnvio = signal(false);
  errorMsg = signal('');

  // Lo que impide buscar, en lenguaje claro
  faltantes = computed<string[]>(() => {
    const m = this.model();
    const faltan: string[] = [];
    if (!m.codigo.trim()) faltan.push('Ingresá el código de tu entrada (por ejemplo K7Q2-9XMD)');
    if (!/^\S+@\S+\.\S+$/.test(m.email.trim())) faltan.push('Ingresá el email con el que compraste');
    return faltan;
  });

  // canDeactivate: si escribió algo y no buscó, se pide confirmación antes de salir
  puedeSalir(): boolean {
    return confirmarDescartar(this.datosForm().dirty() && !this.compra());
  }

  async buscar(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.intentoEnvio.set(true);
    if (this.faltantes().length > 0) return;

    this.buscando.set(true);
    this.compra.set(null);
    try {
      const m = this.model();
      this.compra.set(await this.compraService.buscarEntrada(m.codigo.trim(), m.email.trim()));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo buscar la entrada');
    } finally {
      this.buscando.set(false);
    }
  }
}
