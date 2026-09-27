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
@Component({
  imports: [FormField],
  selector: 'app-login',
  // styleUrl: './login.css',
  styleUrls: ['./login.css','../stylesCompartidos/forms.css'],
  templateUrl: './login.html',
})
export class Login {
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


  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');

    await submit(this.loginForm, async () => {
      const { email, password} = this.model();
      try {
        await this.auth.signIn(email, password);
        this.router.navigate(['/']);
      } catch (e: any) {
        this.errorMsg.set(e?.message ?? 'No se pudo iniciar sesión');
      }
    });
  }

}
