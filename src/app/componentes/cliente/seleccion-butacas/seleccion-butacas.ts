import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';
import { ConfirmarSalida } from '../../../guards/salida-guard';
import { FuncionService } from '../../../services/funcion-service';
import { ButacaService } from '../../../services/butaca-service';
import { CompraService } from '../../../services/compra-service';
import { ConfiguracionService } from '../../../services/configuracion-service';
import { CuponService } from '../../../services/cupon-service';
import { PuntosService } from '../../../services/puntos-service';
import { Auth } from '../../../services/auth';
import { FuncionConRelaciones } from '../../../modelos/funcion-model';
import { CompraModel, OcupacionButaca } from '../../../modelos/compra-model';
import { CuponAplicable } from '../../../modelos/cupon-model';
import { BUTACAS } from '../../../modelos/sala-plantilla';
import { MapaButacas } from '../../compartido/mapa-butacas/mapa-butacas';
import { precioVigente } from '../../../utilidades/precio-funcion';
import { generarQr, descargarEntradaPdf } from '../../../utilidades/entrada-pdf';
import { PesosPipe } from '../../../pipes/comunes/pesos.pipe';
import { DiaArPipe, HoraArPipe } from '../../../pipes/comunes/fechas-ar.pipes';
import { FormatoSalaPipe } from '../../../pipes/sala/sala.pipes';
import { IdiomaFuncionPipe } from '../../../pipes/funcion/idioma-funcion.pipe';
import { RestriccionEdadPipe } from '../../../pipes/pelicula/restriccion-edad.pipe';
import { TipoButacaPipe } from '../../../pipes/butaca/butaca.pipes';
import { TipoButaca } from '../../../modelos/sala-model';

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
  private cuponService = inject(CuponService);
  private configuracionService = inject(ConfiguracionService);
  private puntosService = inject(PuntosService);
  private auth = inject(Auth);

  private funcionId = '';
  private cancelarSuscripcion: (() => void) | null = null;
  private refresco: ReturnType<typeof setInterval> | null = null;
  private cuentaRegresiva: ReturnType<typeof setInterval> | null = null;

  funcion = signal<FuncionConRelaciones | null>(null);
  ocupacion = signal<OcupacionButaca[]>([]);
  seleccionadas = signal<string[]>([]);
  recargoVip = signal(0);
  cuponMio = signal<CuponAplicable | null>(null); // el cupón que le corresponde hoy (solo con cuenta)
  costoEntradaPuntos = signal<number | null>(null); // puntos que cuesta canjear una entrada (null = no disponible)
  conPuntos = signal<string[]>([]); // butacas que se eligió pagar con puntos
  usarCredito = signal(false); // pagar con el crédito de la cuenta todo lo que alcance
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
  qrUrl = signal(''); // imagen del QR de la compra confirmada
  descargando = signal(false);

  // Datos del comprador sin sesión y declaración de edad
  private model = signal({ nombre: '', email: '', mayor_declarado: false });
  datosForm = form(this.model);

  // configuracion.max_butacas_por_compra (la base es la que lo hace cumplir; acá es para avisar antes)
  maxButacas = signal(8);

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

  // Lo que se cobra en dinero por una butaca: los puntos cubren la entrada, pero el recargo VIP se paga igual
  precioDe(codigo: string): number {
    const recargo = this.tipoDe(codigo) === 'vip' ? this.recargoVip() : 0;
    const entrada = this.conPuntosValidas().includes(codigo) ? 0 : (this.precioBase() ?? 0);
    return entrada + recargo;
  }

  tipoDe(codigo: string): TipoButaca {
    return BUTACAS.find((b) => b.codigo === codigo)?.tipo ?? 'normal';
  }

  // ---- Puntos y cupón ----
  saldoPuntos = computed(() => this.perfil()?.puntos ?? 0);
  puedeCanjear = computed(() => this.tieneSesion() && this.costoEntradaPuntos() !== null);

  // Solo cuentan las butacas para canje que siguen elegidas (si se desmarca una butaca, deja de canjearse)
  conPuntosValidas = computed(() => this.conPuntos().filter((c) => this.seleccionadas().includes(c)));
  puntosUsados = computed(() => this.conPuntosValidas().length * (this.costoEntradaPuntos() ?? 0));

  // ¿alcanzan los puntos para canjear una butaca más?
  alcanzanPuntos = computed(
    () => this.saldoPuntos() >= this.puntosUsados() + (this.costoEntradaPuntos() ?? Infinity),
  );

  // La base vuelve a calcular todo esto al reservar; acá es para mostrarlo antes
  subtotal = computed(() => this.seleccionadas().reduce((suma, c) => suma + this.precioDe(c), 0));
  descuento = computed(() => {
    const cupon = this.cuponMio();
    return cupon ? Math.round(this.subtotal() * cupon.porcentaje) / 100 : 0;
  });
  total = computed(() => this.subtotal() - this.descuento());

  // Crédito de la cuenta (lo que dejó una cancelación): cubre hasta el total y el resto se paga normalmente
  saldoCredito = computed(() => this.perfil()?.credito ?? 0);
  creditoAplicado = computed(() => (this.usarCredito() ? Math.min(this.saldoCredito(), this.total()) : 0));
  aPagar = computed(() => this.total() - this.creditoAplicado());

  // 1 punto por cada peso pagado en dinero (el crédito no suma puntos). Solo con cuenta.
  puntosGanados = computed(() => (this.tieneSesion() ? Math.floor(this.aPagar()) : 0));
  puntosGanadosCompra = computed(() => {
    const c = this.compra();
    return c ? Math.floor(c.total - c.credito_usado) : 0;
  });
  // Lo que falta pagar con el medio de pago, ya con el crédito de la compra reservada
  aPagarCompra = computed(() => {
    const c = this.compra();
    return c ? c.total - c.credito_usado : 0;
  });

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
      const [funcion, recargo, maxButacas] = await Promise.all([
        this.funcionService.getById(this.funcionId),
        this.compraService.getRecargoVip(),
        this.configuracionService.getValor('max_butacas_por_compra').catch(() => 8),
      ]);
      this.funcion.set(funcion);
      this.recargoVip.set(recargo);
      this.maxButacas.set(maxButacas);

      // Con cuenta: cupón que le corresponde y cuánto cuesta canjear una entrada
      if (this.tieneSesion()) {
        const [cupon, costo] = await Promise.all([
          this.cuponService.getMio().catch(() => null),
          this.puntosService.getCostoEntrada().catch(() => null),
        ]);
        this.cuponMio.set(cupon);
        this.costoEntradaPuntos.set(costo);
      }

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
    } else if (this.seleccionadas().length >= this.maxButacas()) {
      this.avisoMsg.set(`Podés elegir hasta ${this.maxButacas()} butacas por compra.`);
    } else {
      this.seleccionadas.update((s) => [...s, codigo]);
    }
  }

  // Marca o desmarca una butaca para pagarla con puntos
  alternarPuntos(codigo: string) {
    if (this.conPuntosValidas().includes(codigo)) {
      this.conPuntos.update((c) => c.filter((x) => x !== codigo));
    } else if (this.alcanzanPuntos()) {
      this.conPuntos.update((c) => [...c, codigo]);
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
        butacas_con_puntos: this.conPuntosValidas(),
        usar_credito: this.usarCredito(),
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
      const confirmada = await this.compraService.confirmarPago(compra.id);
      this.compra.set(confirmada);
      this.detenerCuentaRegresiva();
      this.paso.set('listo');
      this.auth.refrescarPerfil(); // para que el saldo de puntos quede actualizado

      // El QR se genera solo, con el mismo código de la compra
      this.qrUrl.set(await generarQr(confirmada.codigo).catch(() => ''));
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo confirmar el pago');
      this.volverAElegir(true);
    } finally {
      this.procesando.set(false);
    }
  }

  // Descarga la entrada en PDF (datos de la función, butacas, QR y código)
  async descargarPdf() {
    const compra = this.compra();
    const f = this.funcion();
    if (!compra || !f) return;

    this.descargando.set(true);
    this.errorMsg.set('');
    try {
      await descargarEntradaPdf({
        codigo: compra.codigo,
        pelicula: f.peliculas.nombre,
        inicio: f.inicio,
        salaNumero: f.salas.numero,
        formato: f.salas.formato,
        idioma: f.idioma,
        butacas: this.seleccionadas().map((codigo) => ({ codigo, tipo: this.tipoDe(codigo) })),
        comprador: compra.nombre,
        total: compra.total,
        restriccionEdad: this.restriccion(),
      });
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo generar el PDF');
    } finally {
      this.descargando.set(false);
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
    if (limpiarSeleccion) {
      this.seleccionadas.set([]);
      this.conPuntos.set([]);
      this.usarCredito.set(false);
    }
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
