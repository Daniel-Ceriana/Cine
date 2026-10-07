import { fechaDesdeISO, fechaISO, lunesDe, sumarDias } from './fechas-ar';

// Los gráficos se miran por semana (de lunes a domingo) o por mes calendario.
export type VistaPeriodo = 'semana' | 'mes';

export interface Periodo {
  desde: string; // 'YYYY-MM-DD'
  hasta: string; // 'YYYY-MM-DD'
  etiqueta: string; // 'Semana del 05/10 al 11/10'  ·  'Octubre 2026'
}

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// El período (semana o mes) que contiene a la fecha de referencia
export function periodoDe(vista: VistaPeriodo, referencia: string): Periodo {
  if (vista === 'semana') {
    const desde = lunesDe(referencia);
    const hasta = sumarDias(desde, 6);
    return { desde, hasta, etiqueta: `Semana del ${diaMes(desde)} al ${diaMes(hasta)}` };
  }

  const d = fechaDesdeISO(referencia);
  const desde = fechaISO(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const hasta = fechaISO(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); // día 0 del mes siguiente = último de este
  const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(d);
  return { desde, hasta, etiqueta: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
}

// Una fecha de referencia dentro del período anterior (-1) o siguiente (+1)
export function moverPeriodo(vista: VistaPeriodo, referencia: string, direccion: -1 | 1): string {
  if (vista === 'semana') return sumarDias(referencia, 7 * direccion);

  const d = fechaDesdeISO(referencia);
  return fechaISO(new Date(d.getFullYear(), d.getMonth() + direccion, 1, 12));
}
