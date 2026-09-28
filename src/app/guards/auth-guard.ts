import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { Rol, RUTA_POR_ROL } from '../modelos/user-model';

// Exige sesión iniciada
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return (await auth.hasSession()) ? true : router.createUrlTree(['/login']);
};

// Exige un rol permitido (se define en data.roles de la ruta)
export const roleGuard: CanActivateFn = async (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const permitidos = (route.data['roles'] ?? []) as Rol[];

  const rol = await auth.getCurrentRole().catch(() => null);
  if (!rol) return router.createUrlTree(['/login']);

  return permitidos.includes(rol) ? true : router.createUrlTree(['/no-autorizado']);
};

// Para rutas de cliente: el personal es redirigido a su panel
export const clienteGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!(await auth.hasSession())) return true; // visitante anónimo

  const rol = await auth.getCurrentRole().catch(() => null);
  if (!rol || rol === 'cliente') return true;

  return router.createUrlTree([RUTA_POR_ROL[rol]]);
};

// Para /login y /register: si ya hay sesión, va a su home según el rol
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!(await auth.hasSession())) return true;

  const rol = await auth.getCurrentRole().catch(() => null);
  return router.createUrlTree([rol ? RUTA_POR_ROL[rol] : '/home']);
};