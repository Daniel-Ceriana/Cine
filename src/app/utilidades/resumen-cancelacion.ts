import { ResumenCancelacion } from '../modelos/funcion-model';

function pesos(monto: number): string {
  return `$ ${Number(monto).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

// Explica en lenguaje claro qué le pasa a cada comprador al cancelar funciones.
// Se usa en el confirm() antes de cancelar, con los números que calcula la base.
export function textoResumenCancelacion(r: ResumenCancelacion): string {
  if (r.compras_con_cuenta + r.compras_anonimas === 0) return 'Ninguna compra se ve afectada.';

  const lineas: string[] = [];
  if (r.compras_con_cuenta > 0) {
    lineas.push(
      `• ${r.compras_con_cuenta} compra(s) con cuenta: se les acredita ${pesos(r.credito_total)} de crédito y se les avisa en su perfil.`,
    );
  }
  if (r.compras_anonimas > 0) {
    lineas.push(
      `• ${r.compras_anonimas} compra(s) sin cuenta (${pesos(r.total_anonimas)}): se cancelan y se liberan las butacas, ` +
        'pero no se les puede avisar ni acreditar. Vas a ver sus datos para contactarlos.',
    );
  }
  return lineas.join('\n');
}
