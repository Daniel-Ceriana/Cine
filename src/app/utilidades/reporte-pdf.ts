import { FilaReporte } from '../modelos/reporte-model';
import {
  COLUMNAS_REPORTE,
  fechaCompleta,
  formatoPesos,
  nombreArchivoReporte,
  textoPeriodo,
  totalizar,
} from './reporte';

// Colores de la identidad visual del cine, en RGB (jsPDF no usa variables CSS)
const BORDO: [number, number, number] = [58, 21, 25];
const MOSTAZA: [number, number, number] = [224, 165, 38];
const CREMA: [number, number, number] = [255, 248, 232];
const BORDE: [number, number, number] = [217, 200, 165];
const TINTA: [number, number, number] = [42, 27, 21];

// Arma el PDF del reporte (hoja A4 horizontal) y lo descarga. jsPDF se carga recién acá (import dinámico).
// La tabla se dibuja a mano: si no entran todas las filas en una hoja, sigue en la siguiente con el encabezado repetido.
export async function descargarReportePdf(filas: FilaReporte[], desde: string, hasta: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  const margen = 10;
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const anchoDia = 22;
  const anchoCol = (anchoPagina - margen * 2 - anchoDia) / COLUMNAS_REPORTE.length;
  const altoFila = 6.5;
  const altoEncabezado = 11;

  // ---- Título ----
  doc.setFillColor(...BORDO);
  doc.rect(0, 0, anchoPagina, 20, 'F');
  doc.setFillColor(...MOSTAZA);
  doc.rect(0, 20, anchoPagina, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MOSTAZA);
  doc.setFontSize(18);
  doc.text('CINE', margen, 13);
  doc.setFontSize(11);
  doc.text('REPORTE DE FACTURACIÓN', anchoPagina - margen, 13, { align: 'right' });

  doc.setTextColor(...TINTA);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${textoPeriodo(desde, hasta)}`, margen, 29);
  doc.text(
    'Cada compra cuenta el día en que se pagó; las canceladas, el día en que se cancelaron. Importes en pesos.',
    margen,
    34,
  );

  // ---- Tabla ----
  let y = 40;

  const encabezado = () => {
    doc.setFillColor(...BORDO);
    doc.rect(margen, y, anchoDia + anchoCol * COLUMNAS_REPORTE.length, altoEncabezado, 'F');
    doc.setTextColor(...CREMA);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Día', margen + 2, y + 6.5);
    COLUMNAS_REPORTE.forEach((c, i) => {
      const x = margen + anchoDia + anchoCol * (i + 1) - 1.5;
      const lineas = doc.splitTextToSize(c.corto, anchoCol - 2) as string[];
      doc.text(lineas, x, y + (lineas.length > 1 ? 4.5 : 6.5), { align: 'right' });
    });
    y += altoEncabezado;
  };

  const fila = (dia: string, valores: (string | number)[], resaltada: boolean, negrita: boolean) => {
    if (resaltada) {
      doc.setFillColor(...CREMA);
      doc.rect(margen, y, anchoDia + anchoCol * COLUMNAS_REPORTE.length, altoFila, 'F');
    }
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.15);
    doc.line(margen, y + altoFila, margen + anchoDia + anchoCol * COLUMNAS_REPORTE.length, y + altoFila);

    doc.setTextColor(...TINTA);
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.text(dia, margen + 2, y + 4.4);
    valores.forEach((v, i) => {
      doc.text(String(v), margen + anchoDia + anchoCol * (i + 1) - 1.5, y + 4.4, { align: 'right' });
    });
    y += altoFila;
  };

  const texto = (valor: number, tipo: 'entero' | 'pesos') => (tipo === 'pesos' ? formatoPesos(valor) : String(valor));

  encabezado();
  filas.forEach((f, i) => {
    // si la fila (y la de totales que va al final) no entra, se sigue en otra hoja
    if (y + altoFila > altoPagina - margen - altoFila) {
      doc.addPage();
      y = margen;
      encabezado();
    }
    fila(fechaCompleta(f.dia), COLUMNAS_REPORTE.map((c) => texto(f[c.clave], c.tipo)), i % 2 === 1, false);
  });

  // ---- Totales ----
  if (y + altoFila > altoPagina - margen) {
    doc.addPage();
    y = margen;
    encabezado();
  }
  const totales = totalizar(filas);
  doc.setFillColor(...MOSTAZA);
  doc.rect(margen, y, anchoDia + anchoCol * COLUMNAS_REPORTE.length, altoFila, 'F');
  fila('TOTAL', COLUMNAS_REPORTE.map((c) => texto(totales[c.clave], c.tipo)), false, true);

  if (filas.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No hubo ventas ni cancelaciones en este período.', margen, y + 10);
  }

  doc.save(`${nombreArchivoReporte(desde, hasta)}.pdf`);
}
