import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuCrearVer } from '../generico/menu-crear-ver/menu-crear-ver';
import { SalaService } from '../../../services/sala-service';
import { SalaModel } from '../../../modelos/sala-model';
import { TOTAL_BUTACAS } from '../../../modelos/sala-plantilla';
import { FormatoSalaPipe, EstadoSalaPipe } from '../../../pipes/sala/sala.pipes';

@Component({
  imports: [MenuCrearVer, FormatoSalaPipe, EstadoSalaPipe],
  selector: 'app-salas',
  styleUrl: './salas.css',
  templateUrl: './salas.html',
})
export class Salas implements OnInit {
  private salaService = inject(SalaService);
  private router = inject(Router);

  salas = signal<SalaModel[]>([]);
  cargando = signal(false);
  errorMsg = signal('');

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      this.salas.set(await this.salaService.getAll());
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las salas');
    } finally {
      this.cargando.set(false);
    }
  }

  // todas las salas comparten la misma distribución de butacas
  readonly totalButacas = TOTAL_BUTACAS;

  onClickModificar(sala: SalaModel) {
    this.router.navigate(['/admin/salas/crear'], { queryParams: { id: sala.id } });
  }

  async alternarActiva(sala: SalaModel) {
    this.errorMsg.set('');
    try {
      await this.salaService.modificar(sala.id, {
        numero: sala.numero,
        nombre: sala.nombre,
        formato: sala.formato,
        activa: !sala.activa,
      });
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cambiar el estado de la sala');
    }
  }

  async eliminar(sala: SalaModel) {
    if (!confirm(`¿Eliminar la ${sala.nombre}?`)) return;

    this.errorMsg.set('');
    try {
      await this.salaService.eliminar(sala.id);
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo eliminar la sala');
    }
  }
}
