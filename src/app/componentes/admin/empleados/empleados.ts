import { Component, inject, signal, OnInit } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { EmpleadoService, CuentaPersonal } from '../../../services/empleado-service';
import { Auth } from '../../../services/auth';
import { Rol } from '../../../modelos/user-model';
import { RolUsuarioPipe, ETIQUETA_ROL } from '../../../pipes/usuario/rol-usuario.pipe';

// Roles que se pueden asignar, en el orden en que se muestran
const ROLES: Rol[] = ['empleado_entradas', 'empleado_candy', 'admin', 'cliente'];

// El admin asigna o quita el rol de personal a una cuenta que ya está registrada.
// Las cuentas del personal se crean como cualquier otra (registro) y acá se les da el rol.
@Component({
  imports: [FormField, RolUsuarioPipe],
  selector: 'app-empleados',
  styleUrl: './empleados.css',
  templateUrl: './empleados.html',
})
export class Empleados implements OnInit {
  private empleadoService = inject(EmpleadoService);
  private auth = inject(Auth);

  readonly roles = ROLES.map((valor) => ({ valor, etiqueta: ETIQUETA_ROL[valor] }));

  personal = signal<CuentaPersonal[]>([]);
  encontrada = signal<CuentaPersonal | null>(null);
  rolElegido = signal<Rol>('empleado_entradas');
  cargando = signal(false);
  guardando = signal(false);
  errorMsg = signal('');
  okMsg = signal('');

  private model = signal({ email: '' });
  busquedaForm = form(this.model);

  async ngOnInit() {
    await this.cargarPersonal();
  }

  private async cargarPersonal() {
    this.cargando.set(true);
    try {
      this.personal.set(await this.empleadoService.getPersonal());
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar el personal');
    } finally {
      this.cargando.set(false);
    }
  }

  async buscar(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');
    this.okMsg.set('');
    this.encontrada.set(null);

    const email = this.model().email.trim();
    if (!email) {
      this.errorMsg.set('Ingresá el email de la cuenta');
      return;
    }

    try {
      const cuenta = await this.empleadoService.buscarPorEmail(email);
      if (!cuenta) {
        this.errorMsg.set('No hay ninguna cuenta con ese email. La persona tiene que registrarse primero.');
        return;
      }
      this.encontrada.set(cuenta);
      this.rolElegido.set(cuenta.rol === 'cliente' ? 'empleado_entradas' : cuenta.rol);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo buscar la cuenta');
    }
  }

  async guardar() {
    const cuenta = this.encontrada();
    if (!cuenta) return;
    await this.asignar(cuenta, this.rolElegido());
    this.encontrada.set(null);
    this.model.set({ email: '' });
  }

  async quitar(cuenta: CuentaPersonal) {
    if (!confirm(`¿Quitarle el rol de personal a ${cuenta.nombre} ${cuenta.apellido}? Pasa a ser cliente.`)) return;
    await this.asignar(cuenta, 'cliente');
  }

  private async asignar(cuenta: CuentaPersonal, rol: Rol) {
    this.errorMsg.set('');
    this.okMsg.set('');

    // evita que el admin se quite a sí mismo el acceso por error
    if (cuenta.id === this.auth.perfil()?.id && rol !== 'admin') {
      this.errorMsg.set('No podés quitarte a vos mismo el rol de administrador.');
      return;
    }

    this.guardando.set(true);
    try {
      await this.empleadoService.cambiarRol(cuenta.id, rol);
      this.okMsg.set(`${cuenta.nombre} ${cuenta.apellido} ahora es: ${ETIQUETA_ROL[rol]}.`);
      await this.cargarPersonal();
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cambiar el rol');
    } finally {
      this.guardando.set(false);
    }
  }
}
