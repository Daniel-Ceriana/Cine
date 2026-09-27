import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  form,
  FormField,
  required,
  email,
  minLength,
  maxLength,
  pattern,
  validate,
  submit,
} from '@angular/forms/signals';
import { Auth } from '../../../services/auth';
@Component({
  imports: [FormField, RouterLink],
  selector: 'app-register',
  styleUrls: ['./register.css','../stylesCompartidos/forms.css'],
  templateUrl: './register.html',
})
export class Register {
  private auth = inject(Auth);
  private router = inject(Router);

  errorMsg = signal('');

  tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  coloresOjos = ['Marrón', 'Azul', 'Verde', 'Celeste', 'Gris', 'Negro', 'Avellana'];

  private model = signal({
    nombre: '',
    apellido: '',
    fecha_nacimiento: '',
    tipo_sangre: '',
    color_ojos: '',
    email: '',
    password: '',
    dias_vacaciones:0,
    confirmPassword: '',
  });

  registerForm = form(this.model, (p) => {
    // Nombre y apellido
    required(p.nombre, { message: 'El nombre es obligatorio' });
    minLength(p.nombre, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(p.nombre, 50, { message: 'Máximo 50 caracteres' });
    pattern(p.nombre, /^[\p{L}\s'-]+$/u, { message: 'Solo letras' });

    required(p.apellido, { message: 'El apellido es obligatorio' });
    minLength(p.apellido, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(p.apellido, 50, { message: 'Máximo 50 caracteres' });
    pattern(p.apellido, /^[\p{L}\s'-]+$/u, { message: 'Solo letras' });

    // Fecha de nacimiento: obligatoria, no futura, mayor de 18
    required(p.fecha_nacimiento, { message: 'La fecha de nacimiento es obligatoria' });
    validate(p.fecha_nacimiento, ({ value }) => {
      const v = value();
      if (!v) return null; // ya lo cubre required
      const nacimiento = new Date(v);
      const hoy = new Date();
      if (nacimiento > hoy) {
        return { kind: 'futura', message: 'La fecha no puede ser futura' };
      }
      const limite = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
      if (nacimiento > limite) {
        return { kind: 'menor', message: 'Tenés que ser mayor de 18 años' };
      }
      return null;
    });

    // Selects
    required(p.tipo_sangre, { message: 'Seleccioná un tipo de sangre' });
    required(p.color_ojos, { message: 'Seleccioná un color de ojos' });
    required(p.dias_vacaciones, { message: 'Indicá la cantidad de días de vacaciones' });

    // Credenciales
    required(p.email, { message: 'El email es obligatorio' });
    email(p.email, { message: 'El email no es válido' });

    required(p.password, { message: 'La contraseña es obligatoria' });
    minLength(p.password, 6, { message: 'Mínimo 6 caracteres' });
    maxLength(p.password, 72, { message: 'Máximo 72 caracteres' });

    // Validación entre campos: repetir contraseña
    required(p.confirmPassword, { message: 'Repetí la contraseña' });
    validate(p.confirmPassword, ({ value, valueOf }) =>
      value() && value() !== valueOf(p.password)
        ? { kind: 'mismatch', message: 'Las contraseñas no coinciden' }
        : null,
    );
  });

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');

    await submit(this.registerForm, async () => {
      const { email, password, confirmPassword, ...profile } = this.model();

      try {
        await this.auth.signUp(email, password, profile);
        this.router.navigate(['/']);
      } catch (e: any) {
        this.errorMsg.set(e?.message ?? 'No se pudo crear la cuenta');
      }
    });
  }
}