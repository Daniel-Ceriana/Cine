import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../services/auth';

// A esta página redirige rolMatch cuando hay sesión pero el rol no alcanza para la ruta pedida
@Component({
  imports: [RouterLink],
  selector: 'app-no-autorizado',
  styleUrl: './no-autorizado.css',
  templateUrl: './no-autorizado.html',
})
export class NoAutorizado {
  auth = inject(Auth);
}
