import { inject, Service } from '@angular/core';
// import { SupabaseClient } from '@supabase/supabase-js';
import { SignUpProfile, UserModel } from '../modelos/user-model';
import { SupabaseService } from './supabase-service';

@Service()
export class Auth {
    private supabase=inject(SupabaseService).client;

   signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signUp(email: string, password: string, profile: SignUpProfile) {
    // Crear el usuario en auth.users
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('No se pudo crear el usuario');

    // Darle los datos del perfil en profiles
    const { error: profileError } = await this.supabase
      .from('profiles')
      .insert({ id: data.user.id, email: data.user.email, ...profile });

    if (profileError) throw profileError;

    return data;
  }

  signOut() {
    return this.supabase.auth.signOut();
  }

  getUser() {
    return this.supabase.auth.getUser();
  }

  async getProfile(userId: string): Promise<UserModel> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<UserModel>();

    if (error) throw error;
    return data;
  }
}