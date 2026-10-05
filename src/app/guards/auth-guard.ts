import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { Rol, RUTA_POR_ROL } from '../modelos/user-model';



const ROLES_CON_PANEL: Rol[] = ['admin', 'empleado_entradas', 'empleado_candy'];

// Exige sesión iniciada; si no hay, va a la pantalla que explica que hay que iniciar sesión
export const sesionMatch: CanMatchFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.esperarInicio();
  return auth.haySesion() ? true : router.createUrlTree(['/no-autorizado']);
};

// Exige uno de los roles indicados en `data.roles` de la ruta.
//   sin sesión           -> pantalla "sin permiso" (pide iniciar sesión)
//   con sesión, otro rol -> pantalla "sin permiso" (la cuenta no alcanza)
export const rolMatch: CanMatchFn = async (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const permitidos = (route.data?.['roles'] ?? []) as Rol[];

  await auth.esperarInicio();
  if (!auth.haySesion()) return router.createUrlTree(['/no-autorizado']);

  const rol = auth.rol();
  return rol && permitidos.includes(rol) ? true : router.createUrlTree(['/no-autorizado']);
};

// Rutas del público: las ven visitantes y clientes. El personal con panel propio va a su panel.
export const clienteMatch: CanMatchFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.esperarInicio();
  const rol = auth.rol();

  if (!auth.haySesion() || !rol || rol === 'cliente') return true; // visitante o cliente
  return ROLES_CON_PANEL.includes(rol) ? router.createUrlTree([RUTA_POR_ROL[rol]]) : true;
};

// Para /login y /register: si ya hay sesión, va al inicio que le corresponde según su rol
export const invitadoMatch: CanMatchFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.esperarInicio();
  if (!auth.haySesion()) return true;

  const rol = auth.rol();
  return router.createUrlTree([rol && ROLES_CON_PANEL.includes(rol) ? RUTA_POR_ROL[rol] : '/home']);
};
