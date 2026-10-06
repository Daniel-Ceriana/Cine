// Movimiento del crédito de la cuenta (no es lo mismo que los puntos)
export interface MovimientoCredito {
  id: string;
  usuario_id: string;
  monto: number; // positivo si se acredita (cancelación), negativo si se usa para pagar
  descripcion: string;
  compra_id: string | null;
  created_at: string;
}

// Fila de la tabla configuracion (valores que el admin puede cambiar)
export interface ConfiguracionModel {
  clave: string;
  valor: number;
  descripcion: string | null;
}
