import { Component, input } from '@angular/core';
import { RouterLink} from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-menu-crear-ver',
  styleUrls:['../../estilosAdmin/estilosMenuAdmin.css','./menu-crear-ver.css'] ,
  templateUrl: './menu-crear-ver.html',
})
export class MenuCrearVer {
 modificar = input<boolean>(true);

}
