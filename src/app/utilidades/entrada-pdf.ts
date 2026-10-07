import { formatearDia, formatearHora } from './fechas-ar';
import { ETIQUETA_TIPO_BUTACA } from '../pipes/butaca/butaca.pipes';
import { FormatoSala, TipoButaca } from '../modelos/sala-model';
import { IdiomaFuncion } from '../modelos/funcion-model';

// Datos que lleva la entrada
export interface DatosEntrada {
  codigo: string; // 'K7Q2-9XMD'
  pelicula: string;
  inicio: string; // ISO con zona horaria
  salaNumero: number;
  formato: FormatoSala;
  idioma: IdiomaFuncion;
  butacas: { codigo: string; tipo: TipoButaca }[];
  productos?: { nombre: string; cantidad: number }[]; // candy de la compra (se retira con el mismo código)
  comprador: string;
  total: number;
  restriccionEdad: number;
}

// Colores de la identidad visual del cine, en RGB (jsPDF no usa variables CSS)
const BORDO: [number, number, number] = [58, 21, 25];
const MOSTAZA: [number, number, number] = [224, 165, 38];
const CREMA: [number, number, number] = [255, 248, 232];
const BORDE: [number, number, number] = [217, 200, 165];
const TINTA: [number, number, number] = [42, 27, 21];
const ROJO: [number, number, number] = [200, 54, 43];

// Devuelve el QR como imagen (data URL) para mostrarlo en pantalla o pegarlo en el PDF.
// El QR contiene el mismo código que el empleado puede escribir a mano.
// La librería se carga recién acá (import dinámico) para no engordar el paquete inicial.
export async function generarQr(codigo: string): Promise<string> {
  const qr = await import('qrcode');
  const toDataURL = qr.toDataURL ?? (qr as any).default.toDataURL;
  return toDataURL(codigo, { margin: 1, width: 400, errorCorrectionLevel: 'M', color: { dark: '#3A1519', light: '#FFFFFF' } });
}

// Arma el PDF de la entrada (una hoja A4 con el ticket) y lo descarga
export async function descargarEntradaPdf(datos: DatosEntrada): Promise<void> {
  const [{ jsPDF }, qrUrl] = await Promise.all([import('jspdf'), generarQr(datos.codigo)]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ---- Ticket ----
  const x = 15;
  const y = 20;
  const ancho = 180;
  // '2 × Gaseosa, 1 × Alfajor': si hay candy, el ticket crece para que entre
  const textoProductos = (datos.productos ?? []).map((p) => `${p.cantidad} × ${p.nombre}`).join(', ');
  const lineasProductos = textoProductos ? Math.ceil(textoProductos.length / 40) : 0;
  const alto = 125 + (lineasProductos > 0 ? 9.5 + lineasProductos * 5 : 0);
  const cortex = x + 128; // línea de corte entre los datos y el talón del QR

  doc.setFillColor(...CREMA);
  doc.setDrawColor(...BORDE);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, ancho, alto, 3, 3, 'FD');

  // Cabecera
  doc.setFillColor(...BORDO);
  doc.roundedRect(x, y, ancho, 22, 3, 3, 'F');
  doc.rect(x, y + 12, ancho, 10, 'F'); // cuadra las esquinas de abajo de la cabecera
  doc.setFillColor(...MOSTAZA);
  doc.rect(x, y + 22, ancho, 1.6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MOSTAZA);
  doc.setFontSize(24);
  doc.text('CINE', x + 8, y + 14.5);
  doc.setFontSize(11);
  doc.text('ENTRADA', x + ancho - 8, y + 14, { align: 'right' });

  // ---- Datos (columna izquierda) ----
  const izq = x + 8;
  let fila = y + 36;
  const anchoTexto = cortex - izq - 8;

  doc.setTextColor(...TINTA);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titulo = doc.splitTextToSize(datos.pelicula, anchoTexto) as string[];
  doc.text(titulo, izq, fila);
  fila += titulo.length * 7 + 3;

  const linea = (etiqueta: string, valor: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 100, 90);
    doc.text(etiqueta.toUpperCase(), izq, fila);
    fila += 4.5;

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TINTA);
    const lineas = doc.splitTextToSize(valor, anchoTexto) as string[];
    doc.text(lineas, izq, fila);
    fila += lineas.length * 5 + 3;
  };

  linea('Función', `${capitalizar(formatearDia(datos.inicio))} · ${formatearHora(datos.inicio)} hs`);
  linea('Sala', `Sala ${datos.salaNumero} · ${datos.formato} · ${capitalizar(datos.idioma)}`);
  linea(
    datos.butacas.length === 1 ? 'Butaca' : 'Butacas',
    datos.butacas
      .map((b) => (b.tipo === 'normal' ? b.codigo : `${b.codigo} (${ETIQUETA_TIPO_BUTACA[b.tipo]})`))
      .join(', '),
  );
  if (textoProductos) linea('Candy', textoProductos);
  linea('A nombre de', datos.comprador);
  linea('Total pagado', `$ ${Number(datos.total).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`);

  // ---- Línea de corte y talón (columna derecha) ----
  doc.setDrawColor(...BORDE);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(cortex, y + 26, cortex, y + alto - 4);
  doc.setLineDashPattern([], 0);

  const anchoTalon = x + ancho - cortex;
  const tamQr = 40;
  const qrX = cortex + (anchoTalon - tamQr) / 2;
  doc.addImage(qrUrl, 'PNG', qrX, y + 36, tamQr, tamQr);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 100, 90);
  doc.text('CÓDIGO DE LA ENTRADA', cortex + anchoTalon / 2, y + 82, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...BORDO);
  doc.text(datos.codigo, cortex + anchoTalon / 2, y + 90, { align: 'center' });

  // ---- Aviso de edad ----
  const pie = y + alto + 8; // las indicaciones van debajo del ticket
  if (datos.restriccionEdad > 0) {
    doc.setFillColor(251, 227, 223);
    doc.setDrawColor(...ROJO);
    doc.setLineWidth(0.4);
    doc.roundedRect(izq, y + alto - 24, cortex - izq - 8, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ROJO);
    const aviso = doc.splitTextToSize(
      `Película +${datos.restriccionEdad}: los menores de ${datos.restriccionEdad} años deben asistir acompañados de un adulto.`,
      cortex - izq - 16,
    ) as string[];
    doc.text(aviso, izq + 4, y + alto - 18.5);
  }

  // ---- Indicaciones ----
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...TINTA);
  const indicaciones = [
    'Cómo usar tu entrada',
    '• Presentá el QR o el código en la puerta de la sala. La entrada se puede usar una sola vez.',
    '• Si tu compra incluye productos del candy, con el mismo código los retirás en el candy bar (también una sola vez).',
    '• Llegá con tiempo: el ingreso se habilita 60 minutos antes de la función.',
  ];
  doc.setFont('helvetica', 'bold');
  doc.text(indicaciones[0], x, pie + 4);
  doc.setFont('helvetica', 'normal');
  const cuerpo = doc.splitTextToSize(indicaciones.slice(1).join('\n'), ancho) as string[];
  doc.text(cuerpo, x, pie + 10);

  doc.save(`entrada-${datos.codigo}.pdf`);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
