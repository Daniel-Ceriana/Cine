import { CanDeactivateFn } from '@angular/router';

// Una pantalla que quiere confirmar antes de que el usuario la abandone implementa esto
export interface ConfirmarSalida {
  puedeSalir(): boolean | Promise<boolean>;
}

// canDeactivate genérico: le pregunta a la propia pantalla si se puede salir.
// Se usa en la ruta con `canDeactivate: [confirmarSalidaGuard]`.
export const confirmarSalidaGuard: CanDeactivateFn<ConfirmarSalida> = (pantalla) => pantalla.puedeSalir();
