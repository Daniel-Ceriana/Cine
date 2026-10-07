export interface CategoriaProductoModel {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
  created_at: string;
}

export type CategoriaProductoPayload = Omit<CategoriaProductoModel, 'id' | 'created_at'>;

export interface ProductoModel {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  costo_puntos: number | null; // puntos que cuesta una unidad al canjearla (null = no se puede canjear)
  imagen_url: string; // obligatoria: la base no deja guardar un producto sin imagen
  orden: number;
  activo: boolean;
  created_at: string;
}

export type ProductoPayload = Omit<ProductoModel, 'id' | 'created_at'>;

// Una categoría con sus productos, para mostrar el catálogo agrupado
export interface CategoriaConProductos extends CategoriaProductoModel {
  productos: ProductoModel[];
}
