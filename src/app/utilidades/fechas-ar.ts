// El cine trabaja siempre en hora argentina (UTC-3, sin horario de verano),
// sin importar la zona horaria de la computadora de quien usa el sistema.
export const ZONA_AR = 'America/Argentina/Buenos_Aires';
const OFFSET_AR = '-03:00';

// Date -> 'YYYY-MM-DD' usando el día que se ve en el calendario (día local del navegador)
export function fechaISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// 'YYYY-MM-DD' -> Date local a las 12:00 (al mediodía para que ningún cambio de zona corra el día)
export function fechaDesdeISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

// Día de hoy en Argentina, 'YYYY-MM-DD'
export function hoyAr(): string {
  return partesAr(new Date().toISOString()).fecha;
}

// 'YYYY-MM-DD' + n días -> 'YYYY-MM-DD'
export function sumarDias(iso: string, dias: number): string {
  const d = fechaDesdeISO(iso);
  d.setDate(d.getDate() + dias);
  return fechaISO(d);
}

// Lunes de la semana de esa fecha (la semana va de lunes a domingo)
export function lunesDe(iso: string): string {
  const d = fechaDesdeISO(iso);
  const diasDesdeLunes = (d.getDay() + 6) % 7; // lunes = 0 ... domingo = 6
  return sumarDias(iso, -diasDesdeLunes);
}

// Día de la semana de una fecha 'YYYY-MM-DD' (domingo = 0, como Date.getDay)
export function diaSemana(iso: string): number {
  return fechaDesdeISO(iso).getDay();
}

// 'lun 05/10'
export function etiquetaCorta(iso: string): string {
  const d = fechaDesdeISO(iso);
  const dia = new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(d).replace('.', '');
  return `${dia} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 'lunes 5 de octubre'
export function etiquetaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    fechaDesdeISO(iso),
  );
}

// Momento absoluto (ISO con zona) -> día y hora tal como se ven en Argentina
export function partesAr(iso: string): { fecha: string; hora: string } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_AR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));

  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}`,
  };
}

// 'YYYY-MM-DD' + 'HH:mm' (hora argentina) -> ISO con zona, para mandar a la base
export function aIsoAr(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00${OFFSET_AR}`;
}

// 'HH:mm' -> Date (solo importa la hora) para el timepicker de Material
export function horaADate(hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  return new Date(2000, 0, 1, h, m);
}

// Date del timepicker -> 'HH:mm'
export function dateAHora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatearDia(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_AR,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

export function formatearHora(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_AR,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}
