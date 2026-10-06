import { Component, inject, OnInit, signal } from '@angular/core';
import { ConfiguracionService } from '../../../services/configuracion-service';
import { ConfiguracionModel } from '../../../modelos/credito-model';

// Cómo se muestra cada valor de la tabla configuracion y qué se acepta
interface Parametro {
  nombre: string;
  unidad: string;
  minimo: number;
  entero: boolean;
}

const PARAMETROS: Record<string, Parametro> = {
  recargo_vip: { nombre: 'Recargo de las butacas VIP', unidad: 'pesos', minimo: 0, entero: false },
  max_butacas_por_compra: { nombre: 'Máximo de butacas por compra', unidad: 'butacas', minimo: 1, entero: true },
  minutos_reserva: { nombre: 'Tiempo de reserva mientras se paga', unidad: 'minutos', minimo: 1, entero: true },
  horas_cancelacion: { nombre: 'Cancelación de compras hasta', unidad: 'horas antes de la función', minimo: 0, entero: true },
};

// El admin cambia los valores que antes solo se podían tocar en la base.
// La base los lee en cada reserva y cancelación, así que el cambio vale desde el momento en que se guarda.
@Component({
  selector: 'app-configuracion',
  styleUrl: './configuracion.css',
  templateUrl: './configuracion.html',
})
export class Configuracion implements OnInit {
  private configuracionService = inject(ConfiguracionService);

  valores = signal<ConfiguracionModel[]>([]);
  // lo que se está escribiendo en cada campo, por clave (texto, porque puede estar vacío mientras se escribe)
  ediciones = signal<Record<string, string>>({});
  cargando = signal(false);
  guardandoClave = signal<string | null>(null);
  errorMsg = signal('');
  okMsg = signal('');

  async ngOnInit() {
    this.cargando.set(true);
    try {
      // solo los valores que esta pantalla sabe explicar
      const todas = (await this.configuracionService.getTodas()).filter((c) => c.clave in PARAMETROS);
      this.valores.set(todas);
      this.ediciones.set(Object.fromEntries(todas.map((c) => [c.clave, String(c.valor)])));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar la configuración');
    } finally {
      this.cargando.set(false);
    }
  }

  parametro(clave: string): Parametro {
    return PARAMETROS[clave];
  }

  editar(clave: string, texto: string) {
    this.ediciones.update((e) => ({ ...e, [clave]: texto }));
  }

  async guardar(c: ConfiguracionModel) {
    this.errorMsg.set('');
    this.okMsg.set('');

    const p = PARAMETROS[c.clave];
    const valor = Number(this.ediciones()[c.clave].replace(',', '.'));
    if (this.ediciones()[c.clave].trim() === '' || Number.isNaN(valor) || valor < p.minimo || (p.entero && !Number.isInteger(valor))) {
      this.errorMsg.set(
        `"${p.nombre}" tiene que ser un número ${p.entero ? 'entero ' : ''}igual o mayor a ${p.minimo}`,
      );
      return;
    }

    this.guardandoClave.set(c.clave);
    try {
      await this.configuracionService.guardar(c.clave, valor);
      this.valores.update((lista) => lista.map((x) => (x.clave === c.clave ? { ...x, valor } : x)));
      this.okMsg.set(`Se guardó "${p.nombre}".`);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo guardar');
    } finally {
      this.guardandoClave.set(null);
    }
  }
}
