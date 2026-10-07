export type TipoNotificacion = 'compra' | 'canje' | 'sistema' | 'cancelacion' | 'estreno';

// Aviso que se ve en "Mi perfil" (el sistema no envía mails)
export interface NotificacionModel {
  id: string;
  usuario_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  compra_id: string | null;
  pelicula_id: string | null; // si el aviso es de una película (ej.: se abrió la venta), para ir a verla
  leida: boolean;
  created_at: string;
}
