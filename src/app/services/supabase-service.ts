import { Injectable,Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// @Injectable({
//   providedIn: 'root'
// })

//Duda-> en este caso service esta de mas?
//inyectable se que no va porque no lo voy a usar
@Service()
//solamente conecta con la base de datos, lo demas lo hago con los otros archivos
export class SupabaseService {

  public client: SupabaseClient;

  constructor() {
    this.client = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }
}