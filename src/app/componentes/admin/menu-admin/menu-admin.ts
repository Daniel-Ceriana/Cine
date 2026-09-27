import { Component,inject } from '@angular/core';
import { NavService } from '../../../services/nav-service';
import { RouterLink     
 } from '@angular/router';


@Component({
  imports: [RouterLink],
  selector: 'app-menu-admin',
  styleUrls: ['../estilosAdmin/estilosAdmin.css','./menu-admin.css'],
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
