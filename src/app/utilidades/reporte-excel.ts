import { FilaReporte } from '../modelos/reporte-model';
import { COLUMNAS_REPORTE, descargarBlob, nombreArchivoReporte, totalizar } from './reporte';

// Formatos de celda de Excel: Excel los muestra según el idioma de la computadora (en Argentina: 12.500,50)
const FORMATO_PESOS = '#,##0.00';
const FORMATO_ENTERO = '#,##0';
const FORMATO_DIA = 'dd/mm/yyyy';

// Arma el .xlsx del reporte y lo descarga. La librería (write-excel-file) se carga recién acá (import dinámico).
// Se usa su versión "universal", que devuelve el archivo como Blob, y se baja con la misma función que usa el resto.
export async function descargarReporteExcel(filas: FilaReporte[], desde: string, hasta: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal');

  const encabezado = (valor: string) => ({
    value: valor,
    fontWeight: 'bold' as const,
    backgroundColor: '#F3D98B',
    align: 'center' as const,
  });

  const celdaNumero = (valor: number, tipo: 'entero' | 'pesos', negrita: boolean) => ({
    value: valor,
    format: tipo === 'pesos' ? FORMATO_PESOS : FORMATO_ENTERO,
    ...(negrita ? { fontWeight: 'bold' as const, backgroundColor: '#E0A526' } : {}),
  });

  const datos = [
    [encabezado('Día'), ...COLUMNAS_REPORTE.map((c) => encabezado(c.titulo))],

    ...filas.map((f) => {
      const [y, m, d] = f.dia.split('-').map(Number);
      return [
        { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: FORMATO_DIA },
        ...COLUMNAS_REPORTE.map((c) => celdaNumero(f[c.clave], c.tipo, false)),
      ];
    }),
  ];

  const totales = totalizar(filas);
  datos.push([
    { value: 'TOTAL', fontWeight: 'bold', backgroundColor: '#E0A526' } as never,
    ...COLUMNAS_REPORTE.map((c) => celdaNumero(totales[c.clave], c.tipo, true)),
  ]);

  const columnas = [{ width: 13 }, ...COLUMNAS_REPORTE.map(() => ({ width: 18 }))];

  const blob = await writeXlsxFile(datos as never, { columns: columnas, sheet: 'Facturación' }).toBlob();
  descargarBlob(blob, `${nombreArchivoReporte(desde, hasta)}.xlsx`);
}
