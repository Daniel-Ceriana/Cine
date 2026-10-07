import { Component, inject, OnInit, signal } from '@angular/core';
import { ListadoPeliculas } from '../../compartido/listado-peliculas/listado-peliculas';
import { ItemPelicula } from '../../compartido/item-pelicula/item-pelicula';
import { PeliculaService } from '../../../services/peliculas-service';
import { FuncionService } from '../../../services/funcion-service';
import { AlertaService } from '../../../services/alerta-service';
import { Proximamente } from '../proximamente/proximamente';
import { PeliculaConGeneros } from '../../../modelos/pelicula-model';

// Días que cuenta el ranking de más vendidas
const DIAS_RANKING = 30;

@Component({
  imports: [ListadoPeliculas, ItemPelicula, Proximamente],
  selector: 'app-home-cliente',
  styleUrl: './home-cliente.css',
  templateUrl: './home-cliente.html',
})
export class HomeCliente implements OnInit {
  private peliculasService = inject(PeliculaService);
  private funcionService = inject(FuncionService);
  private alertaService = inject(AlertaService);

  masVendidas = signal<PeliculaConGeneros[]>([]);
  enPreventa = signal<Set<string>>(new Set());
  readonly dias = DIAS_RANKING;

  async ngOnInit() {
    // Si abrió la venta de una película con alerta, se genera el aviso (se ve en Mi perfil)
    this.alertaService.revisar().catch(() => {});

    try {
      const [masVendidas, enPreventa] = await Promise.all([
        this.peliculasService.getMasVendidas(DIAS_RANKING, 3),
        this.funcionService.getPeliculasEnPreventa(),
      ]);
      this.masVendidas.set(masVendidas);
      this.enPreventa.set(enPreventa);
    } catch {
      // el ranking es un extra: si falla, se ve igual el listado completo
    }
  }
}
