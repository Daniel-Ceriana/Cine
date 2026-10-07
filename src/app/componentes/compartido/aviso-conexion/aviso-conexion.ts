import { Component, DestroyRef, inject, signal } from '@angular/core';

// Barra fija arriba que avisa cuando el dispositivo se queda sin internet. Aparece y desaparece sola.
// La aplicación abre sin conexión (el service worker guarda el esqueleto), pero los datos vienen de Supabase: sin internet no
// se ve la cartelera ni se puede comprar. Las butacas nunca se guardan, así que no se pueden ver desactualizadas.
@Component({
  selector: 'app-aviso-conexion',
  styleUrl: './aviso-conexion.css',
  templateUrl: './aviso-conexion.html',
})
export class AvisoConexion {
  sinConexion = signal(!window.navigator.onLine);

  constructor() {
    const sinInternet = () => this.sinConexion.set(true);
    const conInternet = () => this.sinConexion.set(false);

    window.addEventListener('offline', sinInternet);
    window.addEventListener('online', conInternet);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('offline', sinInternet);
      window.removeEventListener('online', conInternet);
    });
  }
}
