import { Component,inject } from '@angular/core';
import { NavService } from '../../../services/nav-service';

@Component({
  imports: [],
  selector: 'app-menu-admin',
  styleUrl: './menu-admin.css',
  templateUrl: './menu-admin.html',
})
export class MenuAdmin {

   private nav = inject(NavService);

  constructor() {
    // this.nav.setRutas([
    //   { url: '/home', nombre: 'Home' },
    //   { url: '/Crearalgo', nombre: 'Crear algo' },
    //   { url: '/Crearalgo2', nombre: 'Crear otra cosa' },
    // ]);
  }

}
