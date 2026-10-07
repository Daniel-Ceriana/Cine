export type AccionLog =
  | 'crear'
  | 'modificar'
  | 'eliminar'
  | 'activar'
  | 'desactivar'
  | 'cancelar'
  | 'cambiar_rol'
  | 'validar_entrada'
  | 'entregar_candy';

export type EntidadLog =
  | 'funcion'
  | 'pelicula'
  | 'sala'
  | 'producto'
  | 'categoria'
  | 'combo'
  | 'combo_productos'
  | 'cupon'
  | 'recompensa'
  | 'configuracion'
  | 'empleado'
  | 'compra';

// Un campo que cambió, con su valor anterior y el nuevo
export interface CambioLog {
  antes: unknown;
  despues: unknown;
}

// Una función dentro de un renglón que junta varias (una serie creada, modificada o cancelada de una vez)
export interface ItemFuncionLog {
  inicio: string;
  sala?: number | null;
  idioma?: string;
  precio_base?: number;
  con_preventa?: boolean;
  cambios?: Record<string, CambioLog>;
}

// Un producto de un combo que se agregó (antes null), se sacó (despues null) o cambió de cantidad
export interface ItemProductoLog {
  producto: string | null;
  antes: number | null;
  despues: number | null;
}

// Lo que el trigger guardó de cada acción. Según la acción viene una de estas partes:
//  datos     -> creación o eliminación (todos los campos) y validaciones
//  cambios   -> modificación (campo: antes y después)
//  funciones -> funciones creadas, modificadas o canceladas juntas
//  productos -> cambios en los productos de un combo
export interface DetalleLog {
  datos?: Record<string, unknown>;
  cambios?: Record<string, CambioLog>;
  cantidad?: number;
  funciones?: ItemFuncionLog[];
  productos?: ItemProductoLog[];
}

// Un renglón del log de actividad (tabla log_actividad)
export interface LogModel {
  id: string;
  created_at: string;
  usuario_id: string | null;
  usuario_nombre: string; // se guarda al momento de la acción
  usuario_rol: 'admin' | 'empleado_entradas' | 'empleado_candy' | 'cliente';
  accion: AccionLog;
  entidad: EntidadLog;
  entidad_id: string | null;
  descripcion: string;
  detalle: DetalleLog | null;
}

// Usuario con actividad, para el filtro (vista log_usuarios)
export interface UsuarioLog {
  usuario_id: string;
  usuario_nombre: string;
  usuario_rol: string;
}

// Lo que se puede filtrar en la pantalla ('' = todos)
export interface FiltrosLog {
  usuarioId: string;
  accion: string;
  entidad: string;
  desde: string; // 'YYYY-MM-DD' en hora argentina
  hasta: string;
}
