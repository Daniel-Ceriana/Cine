import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { MenuCrearVer } from '../generico/menu-crear-ver/menu-crear-ver';
import { FuncionService } from '../../../services/funcion-service';
import { PeliculaService } from '../../../services/peliculas-service';
import { FuncionConRelaciones } from '../../../modelos/funcion-model';
import { PeliculaConGeneros } from '../../../modelos/pelicula-model';
import { partesAr, formatearDia, formatearHora } from '../../../utilidades/fechas-ar';

interface DiaConFunciones {
  fecha: string; // 'YYYY-MM-DD', sirve como clave del día
  etiqueta: string; // 'lunes, 5 de octubre'
  funciones: FuncionConRelaciones[];
}

@Component({
  imports: [MenuCrearVer, FormField],
  selector: 'app-funciones',
  styleUrl: './funciones.css',
  templateUrl: './funciones.html',
})
export class Funciones implements OnInit {
  private funcionService = inject(FuncionService);
  private peliculasService = inject(PeliculaService);
  private router = inject(Router);

  funciones = signal<FuncionConRelaciones[]>([]);
  peliculas = signal<PeliculaConGeneros[]>([]);
  cargando = signal(false);
  errorMsg = signal('');

  private filtrosModel = signal({
    pelicula_id: '',
    incluirPasadas: false,
  });
  filtrosForm = form(this.filtrosModel);

  // Funciones filtradas y agrupadas por día (ya vienen ordenadas por inicio desde la base)
  dias = computed<DiaConFunciones[]>(() => {
    const f = this.filtrosModel();
    const ahora = Date.now();

    const filtradas = this.funciones().filter(
      (fn) =>
        (!f.pelicula_id || fn.pelicula_id === f.pelicula_id) &&
        (f.incluirPasadas || new Date(fn.inicio).getTime() >= ahora),
    );

    const dias: DiaConFunciones[] = [];
    for (const fn of filtradas) {
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
      const [funciones, peliculas] = await Promise.all([
        this.funcionService.getAll(),
        this.peliculasService.getAll(),
      ]);
      this.funciones.set(funciones);
      this.peliculas.set(peliculas);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las funciones');
    } finally {
      this.cargando.set(false);
    }
  }

  hora(iso: string): string {
    return formatearHora(iso);
  }

  // La película termina a los "duracion" minutos del inicio (sin contar los 30 min de limpieza)
  horaFin(f: FuncionConRelaciones): string {
    const fin = new Date(new Date(f.inicio).getTime() + f.peliculas.duracion_minutos * 60_000);
    return formatearHora(fin.toISOString());
  }

  onClickModificar(f: FuncionConRelaciones) {
    this.router.navigate(['/admin/funciones/crear'], { queryParams: { id: f.id } });
  }

  async cancelar(f: FuncionConRelaciones) {
    // TODO: cuando existan las entradas, avisar si la función ya tiene tickets vendidos
    // y otorgar puntos equivalentes a los usuarios que las compraron.
    if (!confirm(`¿Cancelar la función de "${f.peliculas.nombre}" del ${formatearDia(f.inicio)} a las ${this.hora(f.inicio)}?`)) {
      return;
    }

    this.errorMsg.set('');
    try {
      await this.funcionService.cancelar(f.id);
      this.funciones.update((lista) => lista.map((x) => (x.id === f.id ? { ...x, activa: false } : x)));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cancelar la función');
    }
  }
}
