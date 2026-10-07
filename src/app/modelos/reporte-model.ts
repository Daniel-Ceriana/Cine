// Una fila del reporte de facturación: un día con movimiento (función SQL reporte_facturacion)
export interface FilaReporte {
  dia: string; // 'YYYY-MM-DD', en hora argentina
  compras: number; // compras pagadas ese día
  entradas: number; // butacas vendidas (incluye las canjeadas con puntos)
  entradas_con_puntos: number; // de esas, las pagadas con puntos (no son dinero)
  ventas_entradas: number; // ventas de la película (el valor de las entradas de los combos cuenta acá)
  ventas_candy: number; // ventas de productos y combos (la parte que supera el valor de sus entradas)
  ventas_total: number;
  credito_usado: number; // parte pagada con crédito (no es dinero nuevo)
  cobrado_dinero: number; // ventas_total - credito_usado
  canceladas: number; // compras canceladas ese día (del cliente o del cine)
  entradas_canceladas: number;
  cancelado: number; // total de esas compras, devuelto como crédito
  neto: number; // ventas_total - cancelado
}

// Las filas se suman en una fila de totales (sin día)
export type TotalesReporte = Omit<FilaReporte, 'dia'>;
