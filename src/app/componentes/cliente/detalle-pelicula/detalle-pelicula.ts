import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PeliculaService } from '../../../services/peliculas-service';
import { FuncionService } from '../../../services/funcion-service';
import { PeliculaConGeneros } from '../../../modelos/pelicula-model';
import { FuncionConRelaciones } from '../../../modelos/funcion-model';
import { partesAr, formatearDia, formatearHora, etiquetaLarga } from '../../../utilidades/fechas-ar';
import { precioVigente, VigenciaPrecio } from '../../../utilidades/precio-funcion';

interface FuncionConPrecio {
  funcion: FuncionConRelaciones;
  vigencia: VigenciaPrecio;
}

interface DiaConFunciones {
  fecha: string; // 'YYYY-MM-DD'
  etiqueta: string; // 'lunes, 5 de octubre'
  funciones: FuncionConPrecio[];
}

// Detalle de una película: datos, sinopsis y sus próximas funciones agrupadas por día
@Component({
  imports: [RouterLink],
  selector: 'app-detalle-pelicula',
  styleUrl: './detalle-pelicula.css',
  templateUrl: './detalle-pelicula.html',
})
export class DetallePelicula implements OnInit {
  private route = inject(ActivatedRoute);
  private peliculasService = inject(PeliculaService);
  private funcionService = inject(FuncionService);

  pelicula = signal<PeliculaConGeneros | null>(null);
  funciones = signal<FuncionConRelaciones[]>([]);
  cargando = signal(false);
  errorMsg = signal('');

  readonly hora = formatearHora;
  readonly fechaLarga = etiquetaLarga;

  dias = computed<DiaConFunciones[]>(() => {
    const dias: DiaConFunciones[] = [];

    // las funciones ya vienen ordenadas por fecha y hora
    for (const funcion of this.funciones()) {
      const fecha = partesAr(funcion.inicio).fecha;
      let dia = dias.find((d) => d.fecha === fecha);
      if (!dia) {
        dia = { fecha, etiqueta: formatearDia(funcion.inicio), funciones: [] };
        dias.push(dia);
      }
      dia.funciones.push({ funcion, vigencia: precioVigente(funcion) });
    }
    return dias;
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.cargando.set(true);
    try {
      const [pelicula, funciones] = await Promise.all([
        this.peliculasService.getByIdConGeneros(id),
        this.funcionService.getProximasDePelicula(id),
      ]);
      this.pelicula.set(pelicula);
      this.funciones.set(funciones);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar la película');
    } finally {
      this.cargando.set(false);
    }
  }

  pesos(monto: number): string {
    return `$ ${Number(monto).toLocaleString('es-AR')}`;
  }
}
