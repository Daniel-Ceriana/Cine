import { Pipe, PipeTransform } from '@angular/core';
import { etiquetaCorta, etiquetaLarga, formatearDia, formatearHora, partesAr } from '../../utilidades/fechas-ar';

// Recibe un día suelto ('2026-10-05') o un momento completo ('2026-10-05T21:00:00+00:00').
// Con un momento completo se toma el día que se ve en Argentina.
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const aFecha = (valor: string) => (SOLO_FECHA.test(valor) ? valor : partesAr(valor).fecha);

// '2026-10-05T21:00:00+00:00' -> 'lunes, 5 de octubre'   ·   '2026-10-05' -> 'lunes 5 de octubre'
@Pipe({ name: 'diaAr' })
export class DiaArPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    if (!valor) return '';
    return SOLO_FECHA.test(valor) ? etiquetaLarga(valor) : formatearDia(valor);
  }
}

// '2026-10-05T21:00:00+00:00' -> '18:00' (hora argentina)
@Pipe({ name: 'horaAr' })
export class HoraArPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return valor ? formatearHora(valor) : '';
  }
}

// '2026-10-05' -> 'lun 05/10'
@Pipe({ name: 'fechaCortaAr' })
export class FechaCortaArPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return valor ? etiquetaCorta(aFecha(valor)) : '';
  }
}
