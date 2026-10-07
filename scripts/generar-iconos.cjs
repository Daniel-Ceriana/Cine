// Genera los íconos de la PWA (public/icons y public/favicon.ico) con la identidad del cine:
// fondo bordó y una entrada de cine mostaza con muescas, línea de puntos y una estrella.
//
// Uso:  node scripts/generar-iconos.cjs
//
// Es una herramienta de un solo uso: no forma parte de la aplicación ni de sus dependencias. Usa `pngjs`, que ya está en
// node_modules porque lo trae otra librería. Dibuja todo a mano (sin tipografías ni imágenes): cada punto del ícono se
// pinta según si cae dentro de una forma (rectángulo redondeado, círculo, estrella), y para suavizar los bordes se
// toman varias muestras por píxel.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const BORDO = [0x3a, 0x15, 0x19];
const MOSTAZA = [0xe0, 0xa5, 0x26];

const SALIDA = path.join(__dirname, '..', 'public');
const MUESTRAS = 4; // 4 x 4 muestras por píxel

// ---- Formas (todo en coordenadas de 0 a 1) ----
const dentroDeRectRedondeado = (x, y, cx, cy, w, h, r) => {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  if (dx <= 0 || dy <= 0) return Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2;
  return dx * dx + dy * dy <= r * r;
};

const dentroDeCirculo = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

// Estrella de cinco puntas: se arma el polígono y se prueba con el método del rayo
const puntosEstrella = (cx, cy, rExterior, rInterior) =>
  Array.from({ length: 10 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? rExterior : rInterior;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  });

const dentroDePoligono = (x, y, puntos) => {
  let dentro = false;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const [xi, yi] = puntos[i];
    const [xj, yj] = puntos[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};

// ---- El dibujo ----
// `escala` agranda o achica la entrada (los íconos maskable la llevan más chica, para que entre en el círculo seguro).
// `forma`: 'redondeado' (esquinas transparentes), 'completo' (fondo en todo el cuadrado).
function colorEn(x, y, escala, forma) {
  // el fondo
  if (forma === 'redondeado' && !dentroDeRectRedondeado(x, y, 0.5, 0.5, 1, 1, 0.2)) return null; // transparente

  // la entrada, centrada
  const ancho = 0.6 * escala;
  const alto = 0.42 * escala;
  const izq = 0.5 - ancho / 2;
  const radioMuesca = 0.055 * escala;

  const enEntrada =
    dentroDeRectRedondeado(x, y, 0.5, 0.5, ancho, alto, 0.05 * escala) &&
    !dentroDeCirculo(x, y, izq, 0.5, radioMuesca) && // muesca izquierda
    !dentroDeCirculo(x, y, izq + ancho, 0.5, radioMuesca); // muesca derecha
  if (!enEntrada) return BORDO;

  // la estrella en el cuerpo de la entrada
  const estrella = puntosEstrella(izq + ancho * 0.36, 0.5, 0.115 * escala, 0.05 * escala);
  if (dentroDePoligono(x, y, estrella)) return BORDO;

  // la línea de puntos que separa el talón
  const xPuntos = izq + ancho * 0.72;
  for (let i = 0; i < 5; i++) {
    const yPunto = 0.5 - alto / 2 + alto * (0.12 + i * 0.19);
    if (dentroDeCirculo(x, y, xPuntos, yPunto, 0.018 * escala)) return BORDO;
  }

  return MOSTAZA;
}

// Un PNG cuadrado de `tam` píxeles
function dibujar(tam, escala, forma) {
  const png = new PNG({ width: tam, height: tam });
  const n = MUESTRAS * MUESTRAS;

  for (let py = 0; py < tam; py++) {
    for (let px = 0; px < tam; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < MUESTRAS; sy++) {
        for (let sx = 0; sx < MUESTRAS; sx++) {
          const color = colorEn((px + (sx + 0.5) / MUESTRAS) / tam, (py + (sy + 0.5) / MUESTRAS) / tam, escala, forma);
          if (color) {
            r += color[0]; g += color[1]; b += color[2]; a += 1;
          }
        }
      }
      const i = (py * tam + px) * 4;
      png.data[i] = a ? Math.round(r / a) : 0;
      png.data[i + 1] = a ? Math.round(g / a) : 0;
      png.data[i + 2] = a ? Math.round(b / a) : 0;
      png.data[i + 3] = Math.round((a / n) * 255);
    }
  }
  return PNG.sync.write(png);
}

function guardar(ruta, datos) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, datos);
  console.log('  ', path.relative(path.join(__dirname, '..'), ruta), `(${datos.length} bytes)`);
}

// ---- Íconos de la app ----
console.log('Íconos normales (esquinas redondeadas):');
for (const tam of [72, 96, 128, 144, 152, 192, 384, 512]) {
  guardar(path.join(SALIDA, 'icons', `icon-${tam}x${tam}.png`), dibujar(tam, 1.12, 'redondeado'));
}

console.log('Íconos maskable (fondo completo y la entrada dentro del 80 % central):');
for (const tam of [192, 512]) {
  guardar(path.join(SALIDA, 'icons', `maskable-${tam}x${tam}.png`), dibujar(tam, 1, 'completo'));
}

console.log('Ícono para iOS (Apple le pone sus propias esquinas, por eso va a fondo completo):');
guardar(path.join(SALIDA, 'icons', 'apple-touch-icon.png'), dibujar(180, 1.05, 'completo'));

// ---- Favicon: un .ico que adentro lleva dos PNG (32 y 48 px) ----
console.log('Favicon:');
const imagenes = [32, 48].map((tam) => ({ tam, datos: dibujar(tam, 1.12, 'redondeado') }));
const cabecera = Buffer.alloc(6);
cabecera.writeUInt16LE(0, 0); // reservado
cabecera.writeUInt16LE(1, 2); // tipo: ícono
cabecera.writeUInt16LE(imagenes.length, 4);

let desplazamiento = 6 + 16 * imagenes.length;
const entradas = imagenes.map(({ tam, datos }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(tam, 0); // ancho
  e.writeUInt8(tam, 1); // alto
  e.writeUInt8(0, 2); // sin paleta
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); // planos
  e.writeUInt16LE(32, 6); // bits por píxel
  e.writeUInt32LE(datos.length, 8);
  e.writeUInt32LE(desplazamiento, 12);
  desplazamiento += datos.length;
  return e;
});
guardar(path.join(SALIDA, 'favicon.ico'), Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.datos)]));

console.log('Listo.');
