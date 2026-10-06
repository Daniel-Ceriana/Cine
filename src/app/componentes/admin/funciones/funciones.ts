import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { MenuCrearVer } from '../generico/menu-crear-ver/menu-crear-ver';
import { FuncionService } from '../../../services/funcion-service';
import { FuncionConRelaciones, ResumenCancelacion } from '../../../modelos/funcion-model';
import { textoResumenCancelacion } from '../../../utilidades/resumen-cancelacion';
import { partesAr, formatearDia, formatearHora } from '../../../utilidades/fechas-ar';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { DiaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { FormatoSalaPipe } from '../../../pipes/sala/sala.pipes';
import { IdiomaFuncionPipe } from '../../../pipes/funcion/idioma-funcion.pipe';

interface DiaConFunciones {
  fecha: string; // 'YYYY-MM-DD', sirve como clave del día
  etiqueta: string; // 'lunes, 5 de octubre'
  funciones: FuncionConRelaciones[];
}

interface PeliculaConFunciones {
  id: string;
  nombre: string;
  imagen_url: string;
  cantidad: number; // funciones activas
  formatos: string[];
  proxima: string; // inicio de la próxima función activa
}

@Component({
  imports: [MenuCrearVer, FormField, RouterLink, PesosPipe, DiaArPipe, HoraArPipe, FormatoSalaPipe, IdiomaFuncionPipe],
  selector: 'app-funciones',
  styleUrl: './funciones.css',
  templateUrl: './funciones.html',
})
export class Funciones implements OnInit {
  private funcionService = inject(FuncionService);
  private router = inject(Router);

  funciones = signal<FuncionConRelaciones[]>([]);
  cargando = signal(false);
  errorMsg = signal('');
  // Resultado de la última cancelación (para mostrar a quién hay que contactar por fuera)
  ultimaCancelacion = signal<ResumenCancelacion | null>(null);

  // Película cuyo detalle (días y horarios) se está viendo; null = listado de películas
  peliculaId = signal<string | null>(null);

  private filtrosModel = signal({ incluirPasadas: false });
  filtrosForm = form(this.filtrosModel);

  // Funciones que pasan el filtro de "pasadas"
  private visibles = computed(() => {
    const ahora = Date.now();
    const incluirPasadas = this.filtrosModel().incluirPasadas;
    return this.funciones().filter((f) => incluirPasadas || new Date(f.inicio).getTime() >= ahora);
  });

  // Una tarjeta por película que tenga funciones (activas) visibles
  peliculas = computed<PeliculaConFunciones[]>(() => {
    const mapa = new Map<string, PeliculaConFunciones>();

    // visibles() viene ordenada por inicio, así que la primera activa de cada película es la próxima
    for (const f of this.visibles().filter((x) => x.activa)) {
      let p = mapa.get(f.pelicula_id);
      if (!p) {
        p = {
          id: f.pelicula_id,
          nombre: f.peliculas.nombre,
          imagen_url: f.peliculas.imagen_url,
          cantidad: 0,
          formatos: [],
          proxima: f.inicio,
        };
        mapa.set(f.pelicula_id, p);
      }
      p.cantidad++;
      if (!p.formatos.includes(f.salas.formato)) p.formatos.push(f.salas.formato);
    }

    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  peliculaElegida = computed(() => this.peliculas().find((p) => p.id === this.peliculaId()) ?? null);

  // Detalle de la película elegida: sus funciones agrupadas por día
  dias = computed<DiaConFunciones[]>(() => {
    const id = this.peliculaId();
    const dias: DiaConFunciones[] = [];

    for (const fn of this.visibles().filter((f) => f.pelicula_id === id)) {
      const fecha = partesAr(fn.inicio).fecha;
      let dia = dias.find((d) => d.fecha === fecha);
      if (!dia) {
        dia = { fecha, etiqueta: formatearDia(fn.inicio), funciones: [] };
        dias.push(dia);
      }
      dia.funciones.push(fn);
    }
    return dias;
  });

  async ngOnInit() {
    this.cargando.set(true);
    try {
      this.funciones.set(await this.funcionService.getAll());
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las funciones');
    } finally {
      this.cargando.set(false);
    }
  }

  // La película termina a los "duracion" minutos del inicio (sin contar los 30 min de limpieza)
  finPelicula(f: FuncionConRelaciones): string {
    return new Date(new Date(f.inicio).getTime() + f.peliculas.duracion_minutos * 60_000).toISOString();
  }

  onClickModificar(f: FuncionConRelaciones) {
    this.router.navigate(['/admin/funciones/crear'], { queryParams: { id: f.id } });
  }

  // Antes de cancelar se muestra cuántas compras afecta y cómo se compensa; recién ahí se confirma.
  // La base hace todo junto: cancela la función y compensa a los compradores (crédito + notificación).
  async cancelar(f: FuncionConRelaciones) {
    this.errorMsg.set('');
    this.ultimaCancelacion.set(null);

    try {
      const resumen = await this.funcionService.resumenCancelacion([f.id]);
      const funcion = `"${f.peliculas.nombre}" del ${formatearDia(f.inicio)} a las ${formatearHora(f.inicio)}`;
      if (!confirm(`¿Cancelar la función de ${funcion}?

${textoResumenCancelacion(resumen)}`)) return;

      const hecho = await this.funcionService.cancelar(f.id);
      this.funciones.update((lista) => lista.map((x) => (x.id === f.id ? { ...x, activa: false } : x)));
      this.ultimaCancelacion.set(hecho);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cancelar la función');
    }
  }
}
