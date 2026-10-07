import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { LogService } from '../../../services/log-service';
import { FiltrosLog, LogModel, UsuarioLog } from '../../../modelos/log-model';
import { SelectorFecha } from '../../compartido/selector-fecha/selector-fecha';
import { AccionLogPipe, EntidadLogPipe, ETIQUETA_ACCION, ETIQUETA_ENTIDAD } from '../../../pipes/log/log.pipes';
import { RolUsuarioPipe } from '../../../pipes/usuario/rol-usuario.pipe';
import { DiaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { hoyAr, sumarDias } from '../../../utilidades/fechas-ar';
import { filasCambios, filasDatos, filasFunciones, textoProducto, tieneDetalle } from '../../../utilidades/log-detalle';

// Cuántos renglones se piden por vez
const POR_PAGINA = 50;
// Por defecto se ve la última semana
const DIAS_INICIALES = 7;

// Log de actividad del admin y los empleados. Lo escriben triggers de la base: acá solo se filtra y se lee.
@Component({
  imports: [FormField, SelectorFecha, AccionLogPipe, EntidadLogPipe, RolUsuarioPipe, DiaArPipe, HoraArPipe],
  selector: 'app-log',
  styleUrl: './log.css',
  templateUrl: './log.html',
})
export class Log implements OnInit {
  private logService = inject(LogService);

  readonly acciones = Object.entries(ETIQUETA_ACCION).map(([valor, nombre]) => ({ valor, nombre }));
  readonly entidades = Object.entries(ETIQUETA_ENTIDAD).map(([valor, nombre]) => ({ valor, nombre }));

  // Los filtros de la búsqueda ('' = todos)
  private model = signal(this.filtrosIniciales());
  filtrosForm = form(this.model);

  usuarios = signal<UsuarioLog[]>([]);
  registros = signal<LogModel[]>([]);
  abiertos = signal<Set<string>>(new Set());
  hayMas = signal(false);
  cargando = signal(false);
  cargandoMas = signal(false);
  intentoEnvio = signal(false);
  errorMsg = signal('');

  // Los filtros con los que se hizo la búsqueda que se está mostrando ("Cargar más" sigue con esos, no con lo que se esté editando)
  private aplicados: FiltrosLog = this.filtrosIniciales();
  private busqueda = 0; // si se busca de nuevo mientras se carga, solo vale la última

  faltantes = computed<string[]>(() => {
    const { desde, hasta } = this.model();
    const faltan: string[] = [];
    if (!desde) faltan.push('Elegí desde qué fecha querés ver la actividad');
    if (!hasta) faltan.push('Elegí hasta qué fecha querés ver la actividad');
    if (desde && hasta && desde > hasta) faltan.push('La fecha "desde" no puede ser posterior a la fecha "hasta"');
    return faltan;
  });

  // Las funciones de formato viven en utilidades/log-detalle.ts; acá solo se exponen a la plantilla
  readonly filasCambios = filasCambios;
  readonly filasDatos = filasDatos;
  readonly filasFunciones = filasFunciones;
  readonly textoProducto = textoProducto;
  readonly tieneDetalle = tieneDetalle;

  private filtrosIniciales(): FiltrosLog {
    const hoy = hoyAr();
    return { usuarioId: '', accion: '', entidad: '', desde: sumarDias(hoy, -(DIAS_INICIALES - 1)), hasta: hoy };
  }

  async ngOnInit() {
    this.logService.getUsuarios().then((u) => this.usuarios.set(u)).catch(() => {}); // sin la lista igual se puede filtrar por lo demás
    await this.buscarConFiltros();
  }

  async buscar(event: Event) {
    event.preventDefault();
    this.intentoEnvio.set(true);
    if (this.faltantes().length > 0) return;
    await this.buscarConFiltros();
  }

  async limpiar() {
    this.model.set(this.filtrosIniciales());
    this.intentoEnvio.set(false);
    await this.buscarConFiltros();
  }

  private async buscarConFiltros() {
    const busqueda = ++this.busqueda;
    this.aplicados = this.model();
    this.errorMsg.set('');
    this.cargando.set(true);
    try {
      const pagina = await this.logService.getPagina(this.aplicados, 0, POR_PAGINA);
      if (busqueda !== this.busqueda) return;
      this.registros.set(pagina);
      this.abiertos.set(new Set());
      this.hayMas.set(pagina.length === POR_PAGINA);
    } catch (e: any) {
      if (busqueda === this.busqueda) this.errorMsg.set(e?.message ?? 'No se pudo cargar el log');
    } finally {
      if (busqueda === this.busqueda) this.cargando.set(false);
    }
  }

  async cargarMas() {
    const busqueda = this.busqueda;
    this.cargandoMas.set(true);
    try {
      const pagina = await this.logService.getPagina(this.aplicados, this.registros().length, POR_PAGINA);
      if (busqueda !== this.busqueda) return;
      this.registros.update((lista) => [...lista, ...pagina]);
      this.hayMas.set(pagina.length === POR_PAGINA);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar más actividad');
    } finally {
      this.cargandoMas.set(false);
    }
  }

  estaAbierto(id: string): boolean {
    return this.abiertos().has(id);
  }

  alternar(id: string) {
    this.abiertos.update((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }
}
