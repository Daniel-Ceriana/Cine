import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Control propio para Signal Forms: se usa con [formField] igual que un <input>.
// El valor es un texto 'YYYY-MM-DD' (o '' si falta alguna parte), el mismo formato que el input type="date".
@Component({
  selector: 'app-selector-fecha',
  styleUrl: './selector-fecha.css',
  templateUrl: './selector-fecha.html',
})
export class SelectorFecha implements FormValueControl<string> {
  value = model('');
  disabled = input(false);
  // Signal Forms escucha este output para marcar el campo como tocado
  touch = output<void>();

  // Rango de años relativo al año actual: nacimiento = 100 atrás / 0 adelante, estreno = 30 atrás / 2 adelante
  aniosAtras = input(100);
  aniosAdelante = input(0);

  // Las partes se guardan aparte porque, mientras falte alguna, el valor del formulario sigue vacío
  protected dia = signal(0);
  protected mes = signal(0);
  protected anio = signal(0);

  protected meses = MESES.map((nombre, i) => ({ numero: i + 1, nombre }));

  protected anios = computed(() => {
    const actual = new Date().getFullYear();
    const hasta = actual + this.aniosAdelante();
    const desde = actual - this.aniosAtras();
    const lista: number[] = [];
    for (let a = hasta; a >= desde; a--) lista.push(a);
    // Al editar, un año guardado fuera del rango no tiene que desaparecer de la lista
    const guardado = this.anio();
    if (guardado && !lista.includes(guardado)) {
      lista.push(guardado);
      lista.sort((a, b) => b - a);
    }
    return lista;
  });

  // Cantidad de días del mes elegido (sin mes o sin año se asume un año bisiesto, así febrero llega a 29)
  protected dias = computed(() => {
    const anio = this.anio() || 2000;
    const cantidad = this.mes() ? new Date(anio, this.mes(), 0).getDate() : 31;
    return Array.from({ length: cantidad }, (_, i) => i + 1);
  });

  constructor() {
    // Cuando el formulario cambia el valor desde afuera (cargar una película, vaciar el form) se actualizan las partes
    effect(() => {
      const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(this.value());
      if (partes) {
        this.anio.set(Number(partes[1]));
        this.mes.set(Number(partes[2]));
        this.dia.set(Number(partes[3]));
      } else if (this.dia() && this.mes() && this.anio()) {
        this.dia.set(0);
        this.mes.set(0);
        this.anio.set(0);
      }
    });
  }

  protected cambiar(parte: 'dia' | 'mes' | 'anio', event: Event) {
    const numero = Number((event.target as HTMLSelectElement).value);
    this[parte].set(numero);

    // Si el día elegido no existe en el nuevo mes (ej. 31 → febrero) se limpia
    if (this.dia() > this.dias().length) this.dia.set(0);

    if (this.dia() && this.mes() && this.anio()) {
      const mm = String(this.mes()).padStart(2, '0');
      const dd = String(this.dia()).padStart(2, '0');
      this.value.set(`${this.anio()}-${mm}-${dd}`);
    } else {
      this.value.set('');
    }
  }

  protected tocar() {
    this.touch.emit();
  }
}
