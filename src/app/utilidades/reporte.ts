import { FilaReporte, TotalesReporte } from '../modelos/reporte-model';

// Qué columnas tiene el reporte y cómo se muestran. Las usan la tabla de la pantalla, el PDF y el Excel,
// así los tres siempre dicen lo mismo.
export interface ColumnaReporte {
  clave: keyof TotalesReporte;
  titulo: string; // encabezado completo (pantalla y Excel)
  corto: string; // encabezado angosto (PDF)
  tipo: 'entero' | 'pesos';
}

export const COLUMNAS_REPORTE: ColumnaReporte[] = [
  { clave: 'compras', titulo: 'Compras', corto: 'Compras', tipo: 'entero' },
  { clave: 'entradas', titulo: 'Entradas vendidas', corto: 'Entradas', tipo: 'entero' },
  { clave: 'entradas_con_puntos', titulo: 'Entradas con puntos', corto: 'Con puntos', tipo: 'entero' },
  { clave: 'ventas_entradas', titulo: 'Ventas en entradas ($)', corto: 'Ventas entradas', tipo: 'pesos' },
  { clave: 'ventas_candy', titulo: 'Ventas en candy ($)', corto: 'Ventas candy', tipo: 'pesos' },
  { clave: 'ventas_total', titulo: 'Ventas totales ($)', corto: 'Ventas totales', tipo: 'pesos' },
  { clave: 'credito_usado', titulo: 'Crédito usado ($)', corto: 'Crédito usado', tipo: 'pesos' },
  { clave: 'cobrado_dinero', titulo: 'Cobrado en dinero ($)', corto: 'Cobrado en dinero', tipo: 'pesos' },
  { clave: 'canceladas', titulo: 'Compras canceladas', corto: 'Compras canc.', tipo: 'entero' },
  { clave: 'entradas_canceladas', titulo: 'Entradas canceladas', corto: 'Entradas canc.', tipo: 'entero' },
  { clave: 'cancelado', titulo: 'Cancelado ($)', corto: 'Cancelado', tipo: 'pesos' },
  { clave: 'neto', titulo: 'Neto ($)', corto: 'Neto', tipo: 'pesos' },
];

// Suma todas las filas del período
export function totalizar(filas: FilaReporte[]): TotalesReporte {
  const total = Object.fromEntries(COLUMNAS_REPORTE.map((c) => [c.clave, 0])) as unknown as TotalesReporte;
  for (const fila of filas) {
    for (const c of COLUMNAS_REPORTE) total[c.clave] += fila[c.clave];
  }
  // se redondea a centavos para que la suma de decimales no deje restos
  for (const c of COLUMNAS_REPORTE) if (c.tipo === 'pesos') total[c.clave] = Math.round(total[c.clave] * 100) / 100;
  return total;
}

// 12500.5 -> '12.500,50'   (formato argentino, sin el signo $: el encabezado ya dice que son pesos)
export function formatoPesos(monto: number): string {
  return monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// '2026-10-05' -> '05/10/2026'
export function fechaCompleta(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function textoPeriodo(desde: string, hasta: string): string {
  return desde === hasta ? fechaCompleta(desde) : `${fechaCompleta(desde)} al ${fechaCompleta(hasta)}`;
}

// Nombre de los archivos exportados, sin extensión
export function nombreArchivoReporte(desde: string, hasta: string): string {
  return `reporte-facturacion_${desde}_a_${hasta}`;
}

// Baja un archivo generado en el navegador
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
