import { Service, computed, inject } from '@angular/core';
import { NavRoute } from '../interfaces/nav-route';
import { Rol, RUTA_POR_ROL } from '../modelos/user-model';
import { Auth } from './auth';

const RUTAS_PUBLICAS: NavRoute[] = [
  { url: '/home', nombre: 'Home' },
  { url: '/mi-entrada', nombre: 'Mi entrada' },
  { url: '/login', nombre: 'Login' },
  { url: '/register', nombre: 'Registrar' },
];

const RUTAS_CLIENTE: NavRoute[] = [
  { url: '/home', nombre: 'Home' },
  { url: '/perfil', nombre: 'Perfil' },
  { url: '/logout', nombre: 'Salir' },
];

const RUTAS_ADMIN: NavRoute[] = [
  { url: RUTA_POR_ROL.admin, nombre: 'Home' },
  { url: '/admin/funciones', nombre: 'Funciones' },
  { url: '/admin/peliculas', nombre: 'Peliculas' },
  { url: '/admin/salas', nombre: 'Salas' },
  { url: '/admin/empleados', nombre: 'Empleados' },
  { url: '/admin/productos', nombre: 'Productos' },
  { url: '/admin/combos', nombre: 'Combos' },
  { url: '/admin/cupones', nombre: 'Cupones' },
  { url: '/admin/puntos', nombre: 'Puntos' },
  { url: '/admin/reportes', nombre: 'Reportes' },
  { url: '/admin/graficos', nombre: 'Gráficos' },
  { url: '/admin/configuracion', nombre: 'Configuración' },
  { url: '/logout', nombre: 'Salir' },
];

const RUTAS_EMPLEADO_CANDY: NavRoute[] = [
  { url: RUTA_POR_ROL.empleado_candy, nombre: 'Candy' },
  { url: '/logout', nombre: 'Salir' },
];

const RUTAS_EMPLEADO_ENTRADAS: NavRoute[] = [
  { url: RUTA_POR_ROL.empleado_entradas, nombre: 'Entradas' },
  { url: '/logout', nombre: 'Salir' },
];

// El menú que corresponde a cada rol
const RUTAS_POR_ROL: Record<Rol, NavRoute[]> = {
  cliente: RUTAS_CLIENTE,
  admin: RUTAS_ADMIN,
  empleado_candy: RUTAS_EMPLEADO_CANDY,
  empleado_entradas: RUTAS_EMPLEADO_ENTRADAS,
};

@Service()
export class NavService {
  private auth = inject(Auth);

  // El menú depende de quién es el usuario (no de la URL): sin sesión se ve el público;
  // con sesión, el de su rol. Se recalcula solo cuando inicia o cierra sesión.
  rutas = computed<NavRoute[]>(() => {
    if (!this.auth.haySesion()) return RUTAS_PUBLICAS;

    const rol = this.auth.rol();
    // hay sesión pero el perfil todavía no llegó: se muestra el menú del cliente, que es el más común
    return rol ? RUTAS_POR_ROL[rol] : RUTAS_CLIENTE;
  });
}
