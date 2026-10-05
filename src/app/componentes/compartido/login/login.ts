import { Component,inject,signal } from '@angular/core';
import { Router} from '@angular/router';
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
import { ConfirmarSalida, confirmarDescartar } from '../../../guards/salida-guard';

import { Rol, RUTA_POR_ROL } from '../../../modelos/user-model';


const rutaPorRol: Record<Rol, string> = {
  admin: '/admin',
  empleado_candy: '/candy',
  empleado_entradas: '/entradas',
  cliente: '/home',
};


@Component({
  imports: [FormField],
  selector: 'app-login',
  // styleUrl: './login.css',
  styleUrls: ['./login.css','../stylesCompartidos/forms.css'],
  templateUrl: './login.html',
})
export class Login implements ConfirmarSalida {
  private auth = inject(Auth);
  private router = inject(Router);

  errorMsg = signal('');


private model = signal({
    email: '',
    password: '',
  });

  

  loginForm = form(this.model,(p)=>{

    required(p.email, { message: 'El email es obligatorio' });
    email(p.email, { message: 'El email no es válido' });

    required(p.password, { message: 'La contraseña es obligatoria' });
  })


  // canDeactivate: si el formulario tiene cambios sin guardar, se pide confirmación antes de salir
  puedeSalir(): boolean {
    return confirmarDescartar(this.loginForm().dirty());
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');

    await submit(this.loginForm, async () => {
      const { email, password} = this.model();
      try {
        await this.auth.signIn(email, password);
        const rol = await this.auth.getCurrentRole().catch(() => null);
        this.loginForm().reset(); // ya se envió: salir no es perder cambios
        this.router.navigate([RUTA_POR_ROL[rol ?? 'cliente']]);
      } catch (e: any) {
        this.errorMsg.set(e?.message ?? 'No se pudo iniciar sesión');
      }
    });
  }

}
