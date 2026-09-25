import { Service,signal,computed } from '@angular/core';
import { NavRoute } from '../interfaces/nav-route';


@Service()
export class NavService {
  private readonly porDefecto: NavRoute[] = [
    { url: '/home', nombre: 'Home' },
    { url: '/login', nombre: 'Login' },
    { url: '/register', nombre: 'Registrar' },
  ];

  private _override = signal<NavRoute[] | null>(null);

  rutas = computed(() => this._override() ?? this.porDefecto);

  setRutas(rutas: NavRoute[]) {
    this._override.set(rutas);
  }

  reset() {
    this._override.set(null);
  }
}
