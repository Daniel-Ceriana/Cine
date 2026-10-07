import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import {
  BUTACAS,
  FILAS_MAPA,
  COLUMNAS_MAPA,
  COLUMNAS_PASILLO,
  ButacaPlantilla,
} from '../../../modelos/sala-plantilla';
import { ButacaEstadoVista, OcupacionButaca } from '../../../modelos/compra-model';
import { ETIQUETA_ESTADO_BUTACA, ETIQUETA_TIPO_BUTACA } from '../../../pipes/butaca/butaca.pipes';

interface FilaMapa {
  fila: string; // '' es la fila vacía que separa la J de la L
  butacas: ButacaPlantilla[];
}

// Mapa de butacas de una función. Lo usan el cliente (para elegir) y el admin (para ver ventas).
// No sabe nada de la base: recibe qué está ocupado y avisa qué butaca se tocó.
@Component({
  selector: 'app-mapa-butacas',
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.css',
})
export class MapaButacas {
  ocupacion = input<OcupacionButaca[]>([]);
  seleccionadas = input<string[]>([]); // las que eligió este usuario
  resaltada = input<string | null>(null); // la que el admin está mirando
  butacaClick = output<string>();

  // El plano es siempre el mismo, así que las filas se arman una sola vez
  readonly filas: FilaMapa[] = FILAS_MAPA.map((fila) => ({
    fila,
    butacas: BUTACAS.filter((b) => b.fila === fila),
  }));

  // La grilla tiene una columna por número de butaca; los pasillos (5 y 26) son más angostos
  readonly columnas = Array.from({ length: COLUMNAS_MAPA }, (_, i) =>
    COLUMNAS_PASILLO.includes(i + 1) ? '0.6fr' : '1fr',
  ).join(' ');

  // ---- Teclado ----
  // Las 518 butacas no pueden ser 518 paradas del tabulador. Solo UNA butaca (la "activa") es parada de Tab; con las flechas
  // se pasa a otra y esa pasa a ser la activa. Enter o espacio la eligen, como un clic.
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private filasConButacas = this.filas.filter((f) => f.fila !== '');
  activa = signal(BUTACAS[0].codigo);

  // Si se enfoca una butaca con el mouse o con el teclado, esa queda como la activa
  alEnfocar(codigo: string) {
    this.activa.set(codigo);
  }

  alTeclear(evento: KeyboardEvent, fila: FilaMapa, butaca: ButacaPlantilla) {
    const posicion = fila.butacas.indexOf(butaca);
    const numeroDeFila = this.filasConButacas.indexOf(fila);
    let destino: ButacaPlantilla | undefined;

    switch (evento.key) {
      case 'ArrowRight':
        destino = fila.butacas[posicion + 1];
        break;
      case 'ArrowLeft':
        destino = fila.butacas[posicion - 1];
        break;
      case 'ArrowDown':
        destino = this.masCercana(this.filasConButacas[numeroDeFila + 1], butaca.numero);
        break;
      case 'ArrowUp':
        destino = this.masCercana(this.filasConButacas[numeroDeFila - 1], butaca.numero);
        break;
      case 'Home':
        destino = fila.butacas[0];
        break;
      case 'End':
        destino = fila.butacas[fila.butacas.length - 1];
        break;
      default:
        return; // cualquier otra tecla sigue su camino (Tab, Enter, espacio...)
    }

    evento.preventDefault(); // que las flechas no muevan el scroll de la página
    if (destino) this.host.nativeElement.querySelector<HTMLElement>(`[data-codigo="${destino.codigo}"]`)?.focus();
  }

  // La butaca de otra fila que queda más cerca de la misma columna (las filas no empiezan todas en el mismo número)
  private masCercana(fila: FilaMapa | undefined, numero: number): ButacaPlantilla | undefined {
    return fila?.butacas.reduce((mejor, b) => (Math.abs(b.numero - numero) < Math.abs(mejor.numero - numero) ? b : mejor));
  }

  private porCodigo = computed(() => new Map(this.ocupacion().map((o) => [o.butaca_codigo, o])));

  estadoDe(codigo: string): ButacaEstadoVista {
    if (this.seleccionadas().includes(codigo)) return 'seleccionada';
    return this.porCodigo().get(codigo)?.estado === 'vendida'
      ? 'vendida'
      : this.porCodigo().has(codigo)
        ? 'reservada'
        : 'libre';
  }

  // Texto que se ve al pasar el mouse y que leen los lectores de pantalla: 'A6 · VIP · ocupada'
  titulo(b: ButacaPlantilla): string {
    const partes = [b.codigo];
    if (b.tipo !== 'normal') partes.push(ETIQUETA_TIPO_BUTACA[b.tipo]);

    const estado = this.estadoDe(b.codigo);
    if (estado !== 'libre') partes.push(ETIQUETA_ESTADO_BUTACA[estado].toLowerCase());

    return partes.join(' · ');
  }
}
