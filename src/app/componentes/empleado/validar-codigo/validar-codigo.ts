import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { ValidacionService } from '../../../services/validacion-service';
import { ResultadoCodigo, SeccionValidacion } from '../../../modelos/validacion-model';
import { DiaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { FormatoSalaPipe } from '../../../pipes/sala/sala.pipes';
import { IdiomaFuncionPipe } from '../../../pipes/funcion/idioma-funcion.pipe';
import { TipoButacaPipe } from '../../../pipes/butaca/butaca.pipes';
import { RestriccionEdadPipe } from '../../../pipes/pelicula/restriccion-edad.pipe';

interface Textos {
  titulo: string;
  subtitulo: string;
  boton: string; // acción que confirma
  exito: string;
}

const TEXTOS: Record<SeccionValidacion, Textos> = {
  entrada: {
    titulo: 'Validar entradas',
    subtitulo: 'Ingreso a la sala',
    boton: 'Confirmar ingreso',
    exito: 'Ingreso registrado',
  },
  candy: {
    titulo: 'Entrega de candy',
    subtitulo: 'Retiro de productos',
    boton: 'Registrar entrega',
    exito: 'Entrega registrada',
  },
};

// Pantalla de los empleados: ingresan el código a mano, ven a qué compra corresponde y confirman.
// Es la misma pantalla para entradas y para candy; la ruta indica cuál es en `data.seccion`.
// (No hay lector de QR real, por eso solo existe el ingreso manual.)
@Component({
  imports: [FormField, DiaArPipe, HoraArPipe, FormatoSalaPipe, IdiomaFuncionPipe, TipoButacaPipe, RestriccionEdadPipe],
  selector: 'app-validar-codigo',
  styleUrl: './validar-codigo.css',
  templateUrl: './validar-codigo.html',
})
export class ValidarCodigo {
  private route = inject(ActivatedRoute);
  private validacion = inject(ValidacionService);

  readonly seccion: SeccionValidacion = this.route.snapshot.data['seccion'];
  readonly textos = TEXTOS[this.seccion];

  private model = signal({ codigo: '' });
  codigoForm = form(this.model);

  resultado = signal<ResultadoCodigo | null>(null); // lo que se consultó, antes de confirmar
  confirmado = signal<ResultadoCodigo | null>(null); // lo que se acaba de validar
  errorMsg = signal('');
  consultando = signal(false);
  validando = signal(false);

  async consultar(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.confirmado.set(null);
    this.resultado.set(null);

    const codigo = this.model().codigo.trim();
    if (!codigo) {
      this.errorMsg.set('Ingresá el código de la entrada');
      return;
    }

    this.consultando.set(true);
    try {
      this.resultado.set(await this.validacion.consultar(codigo, this.seccion));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo consultar el código');
    } finally {
      this.consultando.set(false);
    }
  }

  async confirmar() {
    this.errorMsg.set('');
    this.validando.set(true);
    try {
      this.confirmado.set(await this.validacion.validar(this.model().codigo, this.seccion));
      this.resultado.set(null);
      this.model.set({ codigo: '' }); // listo para el siguiente
    } catch (e: any) {
      // ej.: otro empleado lo validó un instante antes
      this.errorMsg.set(e?.message ?? 'No se pudo validar');
      this.resultado.set(null);
    } finally {
      this.validando.set(false);
    }
  }

  limpiar() {
    this.resultado.set(null);
    this.confirmado.set(null);
    this.errorMsg.set('');
  }
}
