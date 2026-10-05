import { computed, inject, Service, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SignUpProfile, UserModel, Rol } from '../modelos/user-model';
import { SupabaseService } from './supabase-service';

@Service()
export class Auth {
  private supabase = inject(SupabaseService).client;


  private _sesion = signal<Session | null>(null);
  private _perfil = signal<UserModel | null>(null);

  readonly sesion = this._sesion.asReadonly();
  readonly perfil = this._perfil.asReadonly();
  readonly haySesion = computed(() => this._sesion() !== null);
  readonly rol = computed<Rol | null>(() => this._perfil()?.rol ?? null);

  // Se resuelve cuando ya se sabe si hay sesión (y de quién es) al abrir la aplicación
  private inicio: Promise<void>;

  constructor() {
    this.inicio = this.cargarSesionInicial();

    this.supabase.auth.onAuthStateChange((_evento, session) => {
      setTimeout(() => this.aplicarSesion(session), 0);
    });
  }

  private async cargarSesionInicial() {
    const { data } = await this.supabase.auth.getSession();
    await this.aplicarSesion(data.session);
  }

  private async aplicarSesion(session: Session | null) {
    this._sesion.set(session);

    if (!session) {
      this._perfil.set(null);
      return;
    }
    if (this._perfil()?.id === session.user.id) return;

    try {
      this._perfil.set(await this.getProfile(session.user.id));
    } catch {
      this._perfil.set(null);
    }
  }

  // Vuelve a leer el perfil (por ejemplo, para ver el saldo de puntos actualizado después de una compra)
  async refrescarPerfil() {
    const id = this._sesion()?.user.id;
    if (!id) return;
    try {
      this._perfil.set(await this.getProfile(id));
    } catch {
      // si falla, queda el perfil anterior
    }
  }

  // Los guards esperan esto antes de decidir, para no juzgar con la sesión todavía sin cargar
  esperarInicio(): Promise<void> {
    return this.inicio;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.mensajeDeLogin(error.message));

    // Se espera a tener el perfil para que, al terminar, el rol ya esté disponible
    await this.aplicarSesion(data.session);
    return data;
  }

  private mensajeDeLogin(mensaje: string): string {
    if (mensaje === 'Invalid login credentials') {
      return 'El email o la contraseña no son correctos. Revisá los datos e intentá de nuevo.';
    }
    return mensaje;
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
      // La confirmacion por mail esta desactivada, supabase devuelve la sesion automaticamente asi que aca la saco
      if (data.session) await this.signOut();
    }

    return data;
  }

  async signOut() {
    await this.supabase.auth.signOut();
    await this.aplicarSesion(null);
  }

  //para leer el estado de memoria
  async hasSession(): Promise<boolean> {
    await this.inicio;
    return this.haySesion();
  }

  async getCurrentRole(): Promise<Rol | null> {
    await this.inicio;
    return this.rol();
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
