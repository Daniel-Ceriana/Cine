export type TipoCupon = 'primera_compra' | 'rango_edad';

export interface CuponModel {
  id: string;
  nombre: string;
  tipo: TipoCupon;
  porcentaje: number; // 0 a 100
  edad_min: number | null; // solo en cupones por rango de edad (inclusive)
  edad_max: number | null; // null = sin tope
  activo: boolean;
  created_at: string;
}

export type CuponPayload = Omit<CuponModel, 'id' | 'created_at'>;

// El cupón que le corresponde hoy a quien está comprando (lo decide la base)
export interface CuponAplicable {
  id: string;
  nombre: string;
  tipo: TipoCupon;
  porcentaje: number;
}
