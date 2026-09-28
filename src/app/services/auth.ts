import { inject, Service } from '@angular/core';
import { SignUpProfile, UserModel,Rol } from '../modelos/user-model';
import { SupabaseService } from './supabase-service';

@Service()
export class Auth {
private supabase = inject(SupabaseService).client;

  signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signUp(email: string, password: string, profile: SignUpProfile) {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('No se pudo crear el usuario');

    try {
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({ id: data.user.id, email: data.user.email, ...profile });
      if (profileError) throw profileError;
    } finally {
      // Si la confirmación de email está desactivada, signUp deja sesión.
      // La cerramos para que el usuario tenga que loguearse a mano.
      if (data.session) await this.supabase.auth.signOut();
    }

    return data;
  }

  signOut() {
    return this.supabase.auth.signOut();
  }

  async hasSession(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    return !!data.session;
  }

  async getCurrentRole(): Promise<Rol | null> {
    const { data } = await this.supabase.auth.getSession();
    if (!data.session) return null;
    const profile = await this.getProfile(data.session.user.id);
    return profile.rol;
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