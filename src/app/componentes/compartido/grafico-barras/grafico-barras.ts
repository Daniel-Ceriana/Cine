import { Component, DestroyRef, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import type { Chart } from 'chart.js';
import { FilaRanking } from '../../../modelos/ranking-model';

// Altura de cada barra del gráfico, en píxeles
const ALTO_BARRA = 46;

// Gráfico de barras horizontales de un ranking, con Chart.js (cargada recién cuando hay algo para dibujar).
// El canvas no lo leen los lectores de pantalla: por eso lleva una descripción en texto y, debajo, la misma
// información en una tabla.
@Component({
  selector: 'app-grafico-barras',
  styleUrl: './grafico-barras.css',
  templateUrl: './grafico-barras.html',
})
export class GraficoBarras {
  titulo = input.required<string>();
  filas = input.required<FilaRanking[]>();
  cargando = input(false);
  unidad = input('unidades'); // lo que se cuenta: 'entradas', 'unidades'...
  color = input('bordo'); // variable de color del tema (src/styles.css): 'bordo', 'rojo', 'mostaza'

  private lienzo = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafico: Chart | null = null;
  private version = 0; // para ignorar un dibujo viejo si llegó uno más nuevo mientras se cargaba Chart.js

  alto = computed(() => `${Math.max(this.filas().length, 1) * ALTO_BARRA + 50}px`);

  descripcion = computed(() => {
    const filas = this.filas();
    if (filas.length === 0) return `${this.titulo()}: sin ventas en este período`;
    return `${this.titulo()}: ${filas.map((f) => `${f.nombre}, ${f.cantidad}`).join('; ')}`;
  });

  constructor() {
    // Cada vez que cambian los datos (o aparece el canvas) se vuelve a dibujar
    effect(() => {
      const canvas = this.lienzo()?.nativeElement ?? null;
      void this.dibujar(canvas, this.filas());
    });
    inject(DestroyRef).onDestroy(() => this.grafico?.destroy());
  }

  private async dibujar(canvas: HTMLCanvasElement | null, filas: FilaRanking[]) {
    const version = ++this.version;
    this.grafico?.destroy();
    this.grafico = null;
    if (!canvas || filas.length === 0) return;

    // Se registra solo lo que se usa (barras, ejes y tooltip): así Chart.js pesa lo mínimo
    const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } = await import('chart.js');
    if (version !== this.version) return;
    Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

    const estilo = getComputedStyle(canvas);
    const colorTema = (nombre: string, respaldo: string) => estilo.getPropertyValue(`--${nombre}`).trim() || respaldo;
    const barra = colorTema(this.color(), '#3A1519');
    const tinta = colorTema('tinta', '#2A1B15');
    const borde = colorTema('crema-borde', '#D9C8A5');
    const fuente = estilo.fontFamily || 'sans-serif';

    this.grafico = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: filas.map((f) => f.nombre),
        datasets: [
          {
            label: this.unidad(),
            data: filas.map((f) => f.cantidad),
            backgroundColor: barra,
            borderColor: colorTema('mostaza', '#E0A526'),
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y', // barras horizontales: los nombres largos entran bien
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0, color: tinta, font: { family: fuente } }, grid: { color: borde } },
          y: { ticks: { color: tinta, font: { family: fuente } }, grid: { display: false } },
        },
      },
    });
  }
}
