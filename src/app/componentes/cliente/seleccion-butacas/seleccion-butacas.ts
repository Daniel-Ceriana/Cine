import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { ConfirmarSalida } from '../../../guards/salida-guard';
import { FuncionService } from '../../../services/funcion-service';
import { ButacaService } from '../../../services/butaca-service';
import { CompraService } from '../../../services/compra-service';
import { Auth } from '../../../services/auth';
import { FuncionConRelaciones } from '../../../modelos/funcion-model';
import { CompraModel, OcupacionButaca } from '../../../modelos/compra-model';
import { BUTACAS } from '../../../modelos/sala-plantilla';
import { MapaButacas } from '../../compartido/mapa-butacas/mapa-butacas';
import { precioVigente } from '../../../utilidades/precio-funcion';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { DiaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { FormatoSalaPipe } from '../../../pipes/sala/sala.pipes';
import { IdiomaFuncionPipe } from '../../../pipes/funcion/idioma-funcion.pipe';
import { RestriccionEdadPipe } from '../../../pipes/pelicula/restriccion-edad.pipe';
import { TipoButacaPipe } from '../../../pipes/butaca/butaca.pipes';
import { TipoButaca } from '../../../modelos/sala-model';

// Mismo valor que configuracion.max_butacas_por_compra; la base es la que lo hace cumplir
const MAX_BUTACAS = 8;
const REFRESCO_MS = 15_000;

type Paso = 'elegir' | 'pagar' | 'listo';

@Component({
  imports: [
    RouterLink,
    FormField,
    MapaButacas,
    PesosPipe,
    DiaArPipe,
    HoraArPipe,
    FormatoSalaPipe,
    IdiomaFuncionPipe,
    RestriccionEdadPipe,
    TipoButacaPipe,
  ],
  selector: 'app-seleccion-butacas',
  styleUrl: './seleccion-butacas.css',
  templateUrl: './seleccion-butacas.html',
})
export class SeleccionButacas implements OnInit, OnDestroy, ConfirmarSalida {
  private route = inject(ActivatedRoute);
  private funcionService = inject(FuncionService);
  private butacaService = inject(ButacaService);
  private compraService = inject(CompraService);
  private auth = inject(Auth);

  private funcionId = '';
  private cancelarSuscripcion: (() => void) | null = null;
  private refresco: ReturnType<typeof setInterval> | null = null;
  private cuentaRegresiva: ReturnType<typeof setInterval> | null = null;

  funcion = signal<FuncionConRelaciones | null>(null);
  ocupacion = signal<OcupacionButaca[]>([]);
  seleccionadas = signal<string[]>([]);
  recargoVip = signal(0);
  // Perfil de quien tiene sesión (null = compra sin sesión). Lo guarda Auth en memoria, sin pedidos extra.
  perfil = this.auth.perfil;
  cargando = signal(false);
  errorMsg = signal('');
  avisoMsg = signal('');
  intentoEnvio = signal(false);

  paso = signal<Paso>('elegir');
  compra = signal<CompraModel | null>(null);
  segundosRestantes = signal(0);
  procesando = signal(false);

  // Datos del comprador sin sesión y declaración de edad
  private model = signal({ nombre: '', email: '', mayor_declarado: false });
  datosForm = form(this.model);

  readonly maxButacas = MAX_BUTACAS;

  tieneSesion = computed(() => this.perfil() !== null);
  restriccion = computed(() => this.funcion()?.peliculas.restriccion_edad ?? 0);

  // Edad de quien tiene sesión (para avisar antes de que la base rechace la compra)
  private edadUsuario = computed(() => {
    const nacimiento = this.perfil()?.fecha_nacimiento;
    if (!nacimiento) return null;
    const n = new Date(nacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - n.getFullYear();
    if (hoy < new Date(hoy.getFullYear(), n.getMonth(), n.getDate())) edad--;
    return edad;
  });

  // Con cuenta y sin la edad: no puede comprar. Sin cuenta se pide la declaración (casilla).
  menorDeEdad = computed(() => {
    const edad = this.edadUsuario();
    return this.restriccion() > 0 && edad !== null && edad < this.restriccion();
  });

  // Precio base de hoy: preventa antes del estreno (si está configurada) y normal desde el estreno.
  // null = todavía no se venden entradas. La base vuelve a calcularlo al reservar.
  precioBase = computed<number | null>(() => {
    const f = this.funcion();
    return f ? precioVigente(f).precio : null;
  });

  private ocupadas = computed(() => new Set(this.ocupacion().map((o) => o.butaca_codigo)));

  precioDe(codigo: string): number {
    return (this.precioBase() ?? 0) + (this.tipoDe(codigo) === 'vip' ? this.recargoVip() : 0);
  }

  tipoDe(codigo: string): TipoButaca {
    return BUTACAS.find((b) => b.codigo === codigo)?.tipo ?? 'normal';
  }

  total = computed(() => this.seleccionadas().reduce((suma, c) => suma + this.precioDe(c), 0));
  hayVip = computed(() => this.seleccionadas().some((c) => this.tipoDe(c) === 'vip'));

  // Lo que impide continuar, en lenguaje claro
  faltantes = computed<string[]>(() => {
    const m = this.model();
    const faltan: string[] = [];

    if (this.precioBase() === null) faltan.push('La venta de entradas para esta función todavía no está abierta');
    if (this.menorDeEdad()) faltan.push(`Esta película es +${this.restriccion()}: tu cuenta no cumple la edad mínima`);
    if (this.seleccionadas().length === 0) faltan.push('Elegí al menos una butaca en el mapa');

    if (!this.tieneSesion()) {
      if (!m.nombre.trim()) faltan.push('Ingresá tu nombre');
      if (!/^\S+@\S+\.\S+$/.test(m.email.trim())) faltan.push('Ingresá un email válido');
      if (this.restriccion() > 0 && !m.mayor_declarado) {
        faltan.push(`Tenés que declarar que tenés ${this.restriccion()} años o más`);
      }
    }
    return faltan;
  });

  async ngOnInit() {
    this.funcionId = this.route.snapshot.paramMap.get('id') ?? '';
    this.cargando.set(true);
    try {
      const [funcion, recargo] = await Promise.all([
        this.funcionService.getById(this.funcionId),
        this.compraService.getRecargoVip(),
      ]);
      this.funcion.set(funcion);
      this.recargoVip.set(recargo);
      await this.cargarOcupacion();

      this.cancelarSuscripcion = this.butacaService.suscribirCambios(this.funcionId, () => this.cargarOcupacion());
      this.refresco = setInterval(() => this.cargarOcupacion(), REFRESCO_MS);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar la función');
    } finally {
      this.cargando.set(false);
    }
  }

  // canDeactivate: si hay butacas reservadas sin pagar, se pide confirmación antes de salir
  puedeSalir(): boolean {
    if (this.paso() !== 'pagar') return true;
    return confirm('Tenés butacas reservadas sin pagar. Si salís, se liberan. ¿Querés salir igual?');
  }

  ngOnDestroy() {
    this.cancelarSuscripcion?.();
    if (this.refresco) clearInterval(this.refresco);
    this.detenerCuentaRegresiva();
    // si se va sin pagar, las butacas se liberan en el momento (si no, vencen solas)
    const compra = this.compra();
    if (compra && this.paso() === 'pagar') this.compraService.liberar(compra.id).catch(() => {});
  }

  private async cargarOcupacion() {
    try {
      this.ocupacion.set(await this.butacaService.getOcupacion(this.funcionId));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron cargar las butacas');
      return;
    }

    // Si alguien tomó una butaca que yo había elegido, se me quita y se me avisa
    if (this.paso() === 'elegir') {
      const perdidas = this.seleccionadas().filter((c) => this.ocupadas().has(c));
      if (perdidas.length > 0) {
        this.seleccionadas.update((s) => s.filter((c) => !perdidas.includes(c)));
        this.avisoMsg.set(`Otra persona tomó la butaca ${perdidas.join(', ')}. Elegí otra.`);
      }
    }
  }

  onButacaClick(codigo: string) {
    if (this.paso() !== 'elegir') return;
    this.avisoMsg.set('');

    if (this.seleccionadas().includes(codigo)) {
      this.seleccionadas.update((s) => s.filter((c) => c !== codigo));
    } else if (this.ocupadas().has(codigo)) {
      this.avisoMsg.set(`La butaca ${codigo} no está disponible.`);
    } else if (this.seleccionadas().length >= MAX_BUTACAS) {
      this.avisoMsg.set(`Podés elegir hasta ${MAX_BUTACAS} butacas por compra.`);
    } else {
      this.seleccionadas.update((s) => [...s, codigo]);
    }
  }

  // Reserva las butacas por 5 minutos y pasa al pago
  async continuar() {
    this.errorMsg.set('');
    this.avisoMsg.set('');
    this.intentoEnvio.set(true);
    if (this.faltantes().length > 0) return;

    this.procesando.set(true);
    try {
      const m = this.model();
      const compra = await this.compraService.reservar({
        funcion_id: this.funcionId,
        butacas: this.seleccionadas(),
        email: this.tieneSesion() ? undefined : m.email.trim(),
        nombre: this.tieneSesion() ? undefined : m.nombre.trim(),
        mayor_declarado: m.mayor_declarado,
      });
      this.compra.set(compra);
      this.paso.set('pagar');
      this.iniciarCuentaRegresiva(compra.expira_at);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudieron reservar las butacas');
      await this.cargarOcupacion();
    } finally {
      this.procesando.set(false);
    }
  }

  // Pago simulado
  async pagar() {
    const compra = this.compra();
    if (!compra) return;

    this.errorMsg.set('');
    this.procesando.set(true);
    try {
      this.compra.set(await this.compraService.confirmarPago(compra.id));
      this.detenerCuentaRegresiva();
      this.paso.set('listo');
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo confirmar el pago');
      this.volverAElegir(true);
    } finally {
      this.procesando.set(false);
    }
  }

  // Cambiar de butacas antes de pagar: se libera la reserva pero se conserva la elección
  async cambiarButacas() {
    const compra = this.compra();
    if (compra) await this.compraService.liberar(compra.id).catch(() => {});
    this.volverAElegir(false);
  }

  private volverAElegir(limpiarSeleccion: boolean) {
    this.detenerCuentaRegresiva();
    this.compra.set(null);
    if (limpiarSeleccion) this.seleccionadas.set([]);
    this.paso.set('elegir');
    this.cargarOcupacion();
  }

  private iniciarCuentaRegresiva(expiraAt: string) {
    const actualizar = () => {
      const restantes = Math.max(0, Math.floor((new Date(expiraAt).getTime() - Date.now()) / 1000));
      this.segundosRestantes.set(restantes);

      if (restantes === 0 && this.paso() === 'pagar') {
        this.errorMsg.set('Se venció el tiempo de la reserva. Volvé a elegir tus butacas.');
        this.volverAElegir(true);
      }
    };

    this.detenerCuentaRegresiva();
    actualizar();
    this.cuentaRegresiva = setInterval(actualizar, 1000);
  }

  private detenerCuentaRegresiva() {
    if (this.cuentaRegresiva) clearInterval(this.cuentaRegresiva);
    this.cuentaRegresiva = null;
  }

  // 04:59
  tiempo(): string {
    const s = this.segundosRestantes();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
}
