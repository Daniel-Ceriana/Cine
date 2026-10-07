import { Component, computed, input, output } from '@angular/core';
import { PuntuacionPipe } from '../../../pipes/pelicula/puntuacion.pipe';

// Estrellas de puntuación, hechas a mano (sin librerías). Tiene dos usos:
//  * Para mostrar (por defecto): dibuja `valor` de 0 a 5, con relleno parcial (4,3 se ve 4 estrellas y un poco más).
//  * Para elegir (`editable`): cinco botones; al tocar uno se avisa con `elegida` (1 a 5). Se usa también con el teclado.
@Component({
  imports: [PuntuacionPipe],
  selector: 'app-estrellas',
  styleUrl: './estrellas.css',
  templateUrl: './estrellas.html',
})
export class Estrellas {
  valor = input(0); // 0 a 5
  editable = input(false);
  elegida = output<number>();

  readonly numeros = [1, 2, 3, 4, 5];

  // Ancho de las estrellas llenas, en porcentaje (el valor se limita de 0 a 5)
  relleno = computed(() => `${(Math.min(5, Math.max(0, this.valor())) / 5) * 100}%`);

  elegir(n: number) {
    this.elegida.emit(n);
  }
}
