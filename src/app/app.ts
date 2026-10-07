import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Nav } from './componentes/compartido/nav/nav';
import { AvisoConexion } from './componentes/compartido/aviso-conexion/aviso-conexion';
import { AvisoVersion } from './componentes/compartido/aviso-version/aviso-version';

@Component({
  imports: [RouterOutlet, Nav, AvisoConexion, AvisoVersion],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('tp1');

  private principal = viewChild<ElementRef<HTMLElement>>('principal');

  // "Saltar al contenido": mueve el foco al contenido principal, salteando el menú. Sin esto, quien navega con teclado
  // tiene que pasar por todos los enlaces del menú en cada pantalla.
  saltarAlContenido(event: Event) {
    event.preventDefault();
    this.principal()?.nativeElement.focus();
  }
}
