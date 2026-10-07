import { Component, inject, signal, computed, viewChild, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PeliculaService } from '../../../services/peliculas-service';
import { AlertaService } from '../../../services/alerta-service';
import { BotonAlerta } from '../boton-alerta/boton-alerta';
import { FuncionService } from '../../../services/funcion-service';
import { PeliculaConGeneros } from '../../../modelos/pelicula-model';
import { FuncionConRelaciones } from '../../../modelos/funcion-model';
import { partesAr, formatearDia, hoyAr } from '../../../utilidades/fechas-ar';
import { precioVigente, VigenciaPrecio } from '../../../utilidades/precio-funcion';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { DuracionPipe } from '../../../pipes/comunes/duracion.pipe';
import { DiaArPipe, FechaCortaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { FormatoSalaPipe } from '../../../pipes/sala/sala.pipes';
import { IdiomaFuncionPipe } from '../../../pipes/funcion/idioma-funcion.pipe';
import { RestriccionEdadPipe } from '../../../pipes/pelicula/restriccion-edad.pipe';
import { ReseniasPelicula } from '../resenias-pelicula/resenias-pelicula';
import { ConfirmarSalida } from '../../../guards/salida-guard';

interface FuncionConPrecio {
  funcion: FuncionConRelaciones;
  vigencia: VigenciaPrecio;
}

interface DiaConFunciones {
  fecha: string; // 'YYYY-MM-DD'
  etiqueta: string; // 'lunes, 5 de octubre'
  funciones: FuncionConPrecio[];
}

// Detalle de una película: datos, sinopsis, las reseñas y sus próximas funciones. Las funciones se eligen por día:
// chips con los días que tienen funciones y, abajo, las funciones del día elegido.
@Component({
  imports: [RouterLink, ReseniasPelicula, BotonAlerta, PesosPipe, DuracionPipe, DiaArPipe, FechaCortaArPipe, HoraArPipe, FormatoSalaPipe, IdiomaFuncionPipe, RestriccionEdadPipe],
  selector: 'app-detalle-pelicula',
  styleUrl: './detalle-pelicula.css',
  templateUrl: './detalle-pelicula.html',
})
export class DetallePelicula implements OnInit, ConfirmarSalida {
  private route = inject(ActivatedRoute);
  private peliculasService = inject(PeliculaService);
  private funcionService = inject(FuncionService);
  private alertaService = inject(AlertaService);

  pelicula = signal<PeliculaConGeneros | null>(null);
  funciones = signal<FuncionConRelaciones[]>([]);
  cargando = signal(false);
  errorMsg = signal('');

  // La reseña sin guardar se consulta en la sección de reseñas (canDeactivate)
  private resenias = viewChild(ReseniasPelicula);

  // Día elegido en los chips (null = todavía no eligió: se muestra el primero)
  private diaElegido = signal<string | null>(null);

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

  // Solo hay chips para los días que tienen alguna función; si el elegido ya no está, vale el primero
  diaActual = computed<DiaConFunciones | null>(() => {
    const dias = this.dias();
    return dias.find((d) => d.fecha === this.diaElegido()) ?? dias[0] ?? null;
  });

  // Película próxima: se estrena más adelante y ninguna función se puede comprar todavía. Ofrece "Avisarme".
  esProxima = computed(() => {
    const p = this.pelicula();
    return !!p && hoyAr() < p.fecha_estreno && this.dias().every((d) => d.funciones.every((f) => f.vigencia.precio === null));
  });

  elegirDia(fecha: string) {
    this.diaElegido.set(fecha);
  }

  puedeSalir(): boolean {
    return this.resenias()?.puedeSalir() ?? true;
  }

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
      await this.alertaService.cargar().catch(() => {}); // para marcar si ya pidió el aviso
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar la película');
    } finally {
      this.cargando.set(false);
    }
  }
}
