import { Service,signal,computed, inject } from '@angular/core';
import { NavRoute } from '../interfaces/nav-route';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';



const RUTAS_PUBLICAS: NavRoute[] = [
  { url: '/home', nombre: 'Home' },
  { url: '/login', nombre: 'Login' },
  { url: '/register', nombre: 'Registrar' },
];

const RUTAS_CLIENTE: NavRoute[] = [
  { url: '/home', nombre: 'Home' },
  { url: '/perfil', nombre: 'Perfil' },
  { url: '/logout', nombre: 'Salir' },
];

const RUTAS_ADMIN: NavRoute[] = [
  { url: '/homeadmin', nombre: 'Home' },
  { url: '/admin/funciones', nombre: 'Funciones' },
  { url: '/admin/peliculas', nombre: 'Peliculas' },
  { url: '/admin/productos', nombre: 'Productos' },
  { url: '/admin/cupones', nombre: 'Cupones' },
  { url: '/logout', nombre: 'Salir' },
];
const RUTAS_EMPLEADO_CANDY: NavRoute[] = [
  { url: '/home', nombre: 'Home' },
  { url: '/candy', nombre: 'Candy' },
  { url: '/logout', nombre: 'Salir' },
];

    // this.nav.setRutas([
    //   { url: '/home', nombre: 'Home' },
    //   { url: '/Crearalgo', nombre: 'Crear algo' },
    //   { url: '/Crearalgo2', nombre: 'Crear otra cosa' },
    // ]);


@Service()
export class NavService {

private router = inject(Router);

  private _rutaActual = signal(this.router.url);
  // rutaActual = this._rutaActual.asReadonly();
constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this._rutaActual.set(e.urlAfterRedirects);
      });
  }


  private _override = signal<NavRoute[] | null>(null);

  
  rutas = computed<NavRoute[]>(() => {
    const actual = this._rutaActual();
    
    if (actual.startsWith('/admin') || actual.startsWith('/homeadmin')) {
      return RUTAS_ADMIN;
    }
    if (actual.startsWith('/perfil')) {
      return RUTAS_CLIENTE;
    }
    return RUTAS_PUBLICAS;
    
  });
  // rutas = computed(() => this._override() ?? this.porDefecto);
  // setRutas(rutas: NavRoute[]) {
  //   this._override.set(rutas);
  // }

  // reset() {
  //   this._override.set(null);
  // }
}
