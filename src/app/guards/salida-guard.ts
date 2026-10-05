import { CanDeactivateFn } from '@angular/router';

// Una pantalla que quiere confirmar antes de que el usuario la abandone implementa esto
export interface ConfirmarSalida {
  puedeSalir(): boolean | Promise<boolean>;
}

// Confirmación para los formularios: solo pregunta si hay cambios sin guardar
export function confirmarDescartar(hayCambios: boolean): boolean {
  return !hayCambios || confirm('Tenés cambios sin guardar. Si salís, se pierden. ¿Querés salir igual?');
}

// canDeactivate genérico: le pregunta a la propia pantalla si se puede salir.
// Se usa en la ruta con `canDeactivate: [confirmarSalidaGuard]`.
export const confirmarSalidaGuard: CanDeactivateFn<ConfirmarSalida> = (pantalla) => pantalla.puedeSalir();
