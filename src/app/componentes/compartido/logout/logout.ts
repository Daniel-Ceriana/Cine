import { Component, inject, OnInit } from '@angular/core';
import { Auth } from '../../../services/auth';
import { Router } from '@angular/router';

@Component({
  imports: [],
  selector: 'app-logout',
  styleUrl: './logout.css',
  templateUrl: './logout.html',
})
export class Logout implements OnInit{

   private auth = inject(Auth);
  private router = inject(Router);

ngOnInit(): void {
    this.logout();
}

  async logout() {
    await this.auth.signOut();
    this.router.navigate(['/login']);
  }
}
