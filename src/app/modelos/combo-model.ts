export interface ComboModel {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string; // obligatoria, igual que en los productos
  precio: number; // precio fijo: reemplaza el valor de las entradas y los productos que incluye
  cantidad_entradas: number; // cuántas entradas trae cada combo
  orden: number;
  activo: boolean;
  destacado: boolean; // los destacados se muestran primero en la compra
  created_at: string;
}

// Lo que se manda a guardar_combo (el id y la fecha los pone la base)
export type ComboPayload = Omit<ComboModel, 'id' | 'created_at'>;

// Un producto dentro de un combo
export interface ComboItemModel {
  producto_id: string;
  cantidad: number;
  productos: {
    nombre: string;
    precio: number;
    activo?: boolean;
    categorias_producto?: { activa: boolean } | null;
  };
}

export interface ComboConItems extends ComboModel {
  combo_items: ComboItemModel[];
}

// Lo que se manda a definir_candy_compra
export interface ComboPedido {
  combo_id: string;
  cantidad: number;
}

// Un combo elegido en la compra
export interface ItemComboCarrito {
  combo: ComboConItems;
  cantidad: number;
}
