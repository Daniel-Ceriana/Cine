export type TipoNotificacion = 'compra' | 'canje' | 'sistema' | 'cancelacion';

// Aviso que se ve en "Mi perfil" (el sistema no envía mails)
export interface NotificacionModel {
  id: string;
  usuario_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  compra_id: string | null;
  leida: boolean;
  created_at: string;
}
