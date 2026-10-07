import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface EnlaceAdmin {
  url: string;
  nombre: string;
}

interface GrupoAdmin {
  titulo: string;
  enlaces: EnlaceAdmin[];
}

// Todo lo que puede hacer el admin, agrupado por tema. El menú de arriba (nav) solo tiene las secciones principales:
// acá están todas.
const GRUPOS: GrupoAdmin[] = [
  {
    titulo: 'Cartelera',
    enlaces: [
      { url: '/admin/funciones', nombre: 'Funciones' },
      { url: '/admin/peliculas', nombre: 'Películas' },
      { url: '/admin/salas', nombre: 'Salas' },
    ],
  },
  {
    titulo: 'Candy',
    enlaces: [
      { url: '/admin/productos', nombre: 'Productos' },
      { url: '/admin/combos', nombre: 'Combos' },
    ],
  },
  {
    titulo: 'Clientes',
    enlaces: [
      { url: '/admin/cupones', nombre: 'Cupones' },
      { url: '/admin/puntos', nombre: 'Puntos' },
    ],
  },
  {
    titulo: 'Ventas y control',
    enlaces: [
      { url: '/admin/reportes', nombre: 'Reportes' },
      { url: '/admin/graficos', nombre: 'Gráficos' },
      { url: '/admin/log', nombre: 'Log' },
    ],
  },
  {
    titulo: 'Sistema',
    enlaces: [
      { url: '/admin/empleados', nombre: 'Empleados' },
      // "Configuración" no entra en el mosaico con esta tipografía: acá se llama "Opciones" (la pantalla sigue
      // titulándose "Configuración")
      { url: '/admin/configuracion', nombre: 'Opciones' },
    ],
  },
];

@Component({
  imports: [RouterLink],
  selector: 'app-menu-admin',
  styleUrls: ['../estilosAdmin/estilosMenuAdmin.css', '../estilosAdmin/estilosAdmin.css', './menu-admin.css'],
  templateUrl: './menu-admin.html',
})
export class MenuAdmin {
  readonly grupos = GRUPOS;
}
