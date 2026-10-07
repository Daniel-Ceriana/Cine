import { CambioLog, DetalleLog, ItemFuncionLog, ItemProductoLog } from '../modelos/log-model';
import { ETIQUETA_ROL } from '../pipes/usuario/rol-usuario.pipe';
import { etiquetaCorta, partesAr } from './fechas-ar';

// Cómo se leen los campos que guardan los triggers: nombres de campo y valores en lenguaje del cine.

const ETIQUETA_CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  descripcion: 'Descripción',
  sinopsis: 'Sinopsis',
  duracion_minutos: 'Duración (minutos)',
  restriccion_edad: 'Restricción de edad',
  fecha_estreno: 'Estreno',
  precio_preventa: 'Precio de preventa',
  dias_preventa: 'Días de preventa',
  precio_base: 'Precio base',
  precio: 'Precio',
  costo_puntos: 'Costo en puntos',
  cantidad_entradas: 'Entradas que incluye',
  activa: 'Activa',
  activo: 'Activo',
  destacada: 'Destacada',
  destacado: 'Destacado',
  imagen_url: 'Imagen',
  numero: 'Número',
  formato: 'Formato',
  orden: 'Orden',
  tipo: 'Tipo',
  porcentaje: 'Descuento (%)',
  edad_min: 'Edad desde',
  edad_max: 'Edad hasta',
  valor: 'Valor',
  clave: 'Clave',
  rol: 'Rol',
  inicio: 'Inicio',
  idioma: 'Idioma',
  con_preventa: 'Con preventa',
  sala: 'Sala',
  categoria: 'Categoría',
  categoria_id: 'Categoría',
  codigo: 'Código',
  pelicula: 'Película',
};

const CAMPOS_PESOS = new Set(['precio', 'precio_base', 'precio_preventa']);

// 'precio_base' -> 'Precio base'   ·   un campo desconocido se muestra legible igual
export function etiquetaCampo(campo: string): string {
  if (ETIQUETA_CAMPO[campo]) return ETIQUETA_CAMPO[campo];
  const texto = campo.replaceAll('_', ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// '2026-10-05T21:00:00+00:00' -> 'lun 05/10 18:00' (hora argentina)
export function momento(iso: string): string {
  const p = partesAr(iso);
  return `${etiquetaCorta(p.fecha)} ${p.hora}`;
}

// Un valor guardado -> texto para mostrar: pesos, Sí/No, fechas, roles...
export function valorLegible(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (campo === 'imagen_url') return 'Imagen cargada';
  if (campo.endsWith('_id')) return 'otro'; // los identificadores no se leen: solo se avisa que cambió
  if (CAMPOS_PESOS.has(campo)) return `$ ${Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
  if (campo === 'inicio' && typeof valor === 'string') return momento(valor);
  if (campo === 'fecha_estreno' && typeof valor === 'string') {
    const [y, m, d] = valor.split('-');
    return `${d}/${m}/${y}`;
  }
  if (campo === 'idioma') return valor === 'subtitulada' ? 'Subtitulada' : 'Castellano';
  if (campo === 'rol') return ETIQUETA_ROL[valor as keyof typeof ETIQUETA_ROL] ?? String(valor);
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

export interface FilaCambio {
  campo: string;
  antes: string;
  despues: string;
}

export interface FilaDato {
  campo: string;
  valor: string;
}

export function filasCambios(cambios: Record<string, CambioLog> | undefined): FilaCambio[] {
  return Object.entries(cambios ?? {}).map(([campo, c]) => ({
    campo: etiquetaCampo(campo),
    antes: valorLegible(campo, c.antes),
    despues: valorLegible(campo, c.despues),
  }));
}

export function filasDatos(datos: Record<string, unknown> | undefined): FilaDato[] {
  return Object.entries(datos ?? {}).map(([campo, valor]) => ({
    campo: etiquetaCampo(campo),
    valor: valorLegible(campo, valor),
  }));
}

export interface FilaFuncion {
  cuando: string; // 'lun 05/10 18:00'
  lineas: string[]; // qué se creó o qué cambió en esa función
}

// Una función de un renglón que junta varias: cuándo es y qué se hizo con ella
export function filasFunciones(funciones: ItemFuncionLog[] | undefined): FilaFuncion[] {
  return (funciones ?? []).map((f) => {
    if (f.cambios) {
      return {
        cuando: momento(f.inicio),
        lineas: filasCambios(f.cambios).map((c) => `${c.campo}: ${c.antes} → ${c.despues}`),
      };
    }
    const datos = [
      f.sala ? `Sala ${f.sala}` : null,
      f.idioma ? valorLegible('idioma', f.idioma) : null,
      f.precio_base !== undefined ? valorLegible('precio_base', f.precio_base) : null,
      f.con_preventa ? 'Con preventa' : null,
    ].filter((x): x is string => x !== null);
    return { cuando: momento(f.inicio), lineas: datos.length > 0 ? [datos.join(' · ')] : [] };
  });
}

// Un producto de un combo: '+ 1 × Gaseosa'  ·  '− Alfajor'  ·  'Pochoclos: 1 → 2'
export function textoProducto(p: ItemProductoLog): string {
  const nombre = p.producto ?? 'Producto eliminado';
  if (p.antes === null) return `+ ${p.despues} × ${nombre}`;
  if (p.despues === null) return `− ${nombre}`;
  return `${nombre}: ${p.antes} → ${p.despues}`;
}

// Hay algo para desplegar en este renglón
export function tieneDetalle(detalle: DetalleLog | null): boolean {
  return !!detalle && (!!detalle.datos || !!detalle.cambios || !!detalle.funciones || !!detalle.productos);
}
