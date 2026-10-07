import { Component, inject, OnInit, signal } from '@angular/core';
import { PeliculaService } from '../../../services/peliculas-service';
import { FuncionService } from '../../../services/funcion-service';
import { AlertaService } from '../../../services/alerta-service';
import { PeliculaConGeneros } from '../../../modelos/pelicula-model';
import { esProxima } from '../../../utilidades/proximamente';
import { ItemPelicula } from '../../compartido/item-pelicula/item-pelicula';
import { BotonAlerta } from '../boton-alerta/boton-alerta';

// "Próximamente": las películas que se estrenan más adelante y todavía no se pueden comprar, de la más cercana a la más
// lejana, cada una con su botón "Avisarme". Cuando abre la venta pasan solas a la cartelera.
@Component({
  imports: [ItemPelicula, BotonAlerta],
  selector: 'app-proximamente',
  styleUrl: './proximamente.css',
  templateUrl: './proximamente.html',
})
export class Proximamente implements OnInit {
  private peliculasService = inject(PeliculaService);
  private funcionService = inject(FuncionService);
  private alertaService = inject(AlertaService);

  proximas = signal<PeliculaConGeneros[]>([]);

  async ngOnInit() {
    try {
      const [peliculas, enPreventa] = await Promise.all([
        this.peliculasService.getAll(true),
        this.funcionService.getPeliculasEnPreventa(),
        this.alertaService.cargar().catch(() => {}), // sin los avisos igual se ven las películas
      ]);
      this.proximas.set(
        peliculas
          .filter((p) => esProxima(p, enPreventa))
          .sort((a, b) => a.fecha_estreno.localeCompare(b.fecha_estreno)),
      );
    } catch {
      // es un extra de la cartelera: si falla, la cartelera se ve igual
    }
  }
}
