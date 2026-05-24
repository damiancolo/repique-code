/**
 * hands.js — Inicialización, detección y clasificación geométrica de la mano
 */

import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export const PUNTA_IDS = [4, 8, 12, 16, 20];

let handLandmarker = null;
let ultimoTimestamp = -1;

export async function initHands() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

export function detectarManos(video) {
  if (!handLandmarker || video.readyState < 2) return [];
  const ahora = performance.now();
  if (ahora <= ultimoTimestamp) return [];
  ultimoTimestamp = ahora;
  const resultado = handLandmarker.detectForVideo(video, ahora);
  return resultado.landmarks ?? [];
}

// índice, medio, anular, meñique  →  tracks: madera, chico, repique, piano
const PARES_DEDOS = [[8, 6], [12, 10], [16, 14], [20, 18]];

/**
 * Devuelve [bool,bool,bool,bool] con qué dedos están extendidos (mano 0),
 * o null si no hay mano detectada.
 */
export function detectarDedos(manos) {
  if (!manos.length) return null;
  const lm = manos[0];
  if (!lm || lm.length < 21) return null;
  return PARES_DEDOS.map(([tip, pip]) => lm[tip].y < lm[pip].y);
}

/**
 * Devuelve true cuando todos los dedos están juntos en un punto
 * (la expansión del bounding box de las 5 puntas es pequeña).
 */
export function detectarDedosJuntos(manos) {
  if (!manos.length) return false;
  const lm = manos[0];
  if (!lm || lm.length < 21) return false;
  const tips = [4, 8, 12, 16, 20].map(i => lm[i]);
  const xs = tips.map(p => p.x);
  const ys = tips.map(p => p.y);
  const spread = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
  return spread < 0.22;
}

/**
 * Calcula parámetros gestuales a partir de las dos manos.
 * @returns {{ ancho, centroY, area, puntos, forma }}
 */
export function calcularGestos(manos) {
  if (manos.length < 2) return { ancho: null, centroY: null, area: null, puntos: null, forma: null };

  const ordenadas = [...manos].sort((a, b) => {
    const centroA = (a[4].x + a[8].x) / 2;
    const centroB = (b[4].x + b[8].x) / 2;
    return centroB - centroA;
  });

  const [manoIzq, manoDer] = ordenadas;

  // Vértices del cuadrilátero: pulgIzq → indIzq → indDer → pulgDer
  const puntos = [
    manoIzq[4],
    manoIzq[8],
    manoDer[8],
    manoDer[4],
  ];

  const centroIzqX = (manoIzq[4].x + manoIzq[8].x) / 2;
  const centroDerX = (manoDer[4].x + manoDer[8].x) / 2;
  const ancho = Math.abs(centroIzqX - centroDerX);

  const centroY = puntos.reduce((s, p) => s + p.y, 0) / 4;

  // Área: bounding box de pulgares e índices de ambas manos, sin importar orientación
  const ptsArea = [manoIzq[4], manoIzq[8], manoDer[4], manoDer[8]];
  const xsA = ptsArea.map(p => p.x);
  const ysA = ptsArea.map(p => p.y);
  const area = (Math.max(...xsA) - Math.min(...xsA)) * (Math.max(...ysA) - Math.min(...ysA));

  // Pinza: pulgar e índice muy juntos en una mano → La / Si
  function pinzaDist(mano) {
    const dx = mano[4].x - mano[8].x;
    const dy = mano[4].y - mano[8].y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  const derPinza = pinzaDist(manoDer) < 0.07;
  const izqPinza = pinzaDist(manoIzq) < 0.07;

  let forma;
  if (derPinza && !izqPinza) {
    forma = FORMAS.LA;
  } else if (izqPinza && !derPinza) {
    forma = FORMAS.SI;
  } else {
    forma = clasificarForma(puntos);
  }

  return { ancho, centroY, area, puntos, forma };
}

// ─── Clasificación geométrica ────────────────────────────────────────────────

// Nombres de formas exportados para que render y audio los usen como constantes
export const FORMAS = {
  RECTANGULO:     'rectangulo',     // Do
  TRAPECIO_PISO:  'trapecio_piso',  // Re
  TRAPECIO_TECHO: 'trapecio_techo', // Mi
  TRAPECIO_IZQ:   'trapecio_izq',   // Fa
  TRAPECIO_DER:   'trapecio_der',   // Sol
  LA:             'la',             // La — mano derecha girada (índice abajo)
  SI:             'si',             // Si — mano izquierda girada (índice abajo)
};

function vec(a, b)       { return { x: b.x - a.x, y: b.y - a.y }; }
function cross2(v, w)    { return v.x * w.y - v.y * w.x; }
function len2(v)         { return Math.sqrt(v.x * v.x + v.y * v.y); }

// ¿Dos segmentos p1-p2 y p3-p4 se cruzan (excluyendo extremos)?
function segmentosCruzan(p1, p2, p3, p4) {
  const v = vec(p1, p2);
  const w = vec(p3, p4);
  const d = cross2(v, w);
  if (Math.abs(d) < 1e-9) return false; // paralelos
  const t = cross2(vec(p1, p3), w) / d;
  const u = cross2(vec(p1, p3), v) / d;
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98;
}

// ¿El cuadrilátero se auto-intersecta? (lados no adyacentes se cruzan)
function esSelfIntersecting(pts) {
  return (
    segmentosCruzan(pts[0], pts[1], pts[2], pts[3]) ||
    segmentosCruzan(pts[1], pts[2], pts[3], pts[0])
  );
}

// ¿El cuadrilátero es cóncavo? (productos cruzados con signos opuestos)
function esConcavo(pts) {
  const n = pts.length;
  let signo = 0;
  for (let i = 0; i < n; i++) {
    const v1 = vec(pts[i], pts[(i + 1) % n]);
    const v2 = vec(pts[(i + 1) % n], pts[(i + 2) % n]);
    const c  = cross2(v1, v2);
    if (Math.abs(c) < 1e-7) continue;
    const s = c > 0 ? 1 : -1;
    if (signo === 0) signo = s;
    else if (s !== signo) return true;
  }
  return false;
}

// ¿Dos vectores son aproximadamente paralelos?
function sonParalelos(v1, v2, tol = 0.22) {
  const l1 = len2(v1), l2 = len2(v2);
  if (l1 < 1e-6 || l2 < 1e-6) return false;
  return Math.abs(cross2(v1, v2)) / (l1 * l2) < tol;
}

// ¿Los cuatro lados tienen longitud aproximadamente igual?
function sonLadosIguales(pts, tol = 0.28) {
  const lados = [
    len2(vec(pts[0], pts[1])),
    len2(vec(pts[1], pts[2])),
    len2(vec(pts[2], pts[3])),
    len2(vec(pts[3], pts[0])),
  ];
  const avg = lados.reduce((a, b) => a + b, 0) / 4;
  return lados.every(l => Math.abs(l - avg) / avg < tol);
}

/**
 * Clasifica el cuadrilátero en una de 6 formas.
 * Orden de puntos: [pulgIzq, indIzq, indDer, pulgDer]
 *
 * @param {Array<{x,y}>} puntos
 * @returns {string} clave de FORMAS
 */
export function clasificarForma(puntos) {
  if (!puntos || puntos.length !== 4) return null;

  // 1. Auto-intersección o concavidad → sin forma
  if (esSelfIntersecting(puntos)) return null;
  if (esConcavo(puntos)) return null;

  // 2. Paralelismo de pares opuestos
  const [p0, p1, p2, p3] = puntos;
  const v01 = vec(p0, p1); // lado izquierdo
  const v12 = vec(p1, p2); // conexión entre índices
  const v23 = vec(p2, p3); // lado derecho
  const v30 = vec(p3, p0); // conexión entre pulgares

  const parLados  = sonParalelos(v01, v23); // lados izq/der paralelos
  const parBases  = sonParalelos(v12, v30); // bases sup/inf paralelas

  if (parLados && parBases) return FORMAS.RECTANGULO;

  if (parBases) {
    const techoLen = len2(vec(p1, p2));
    const pisoLen  = len2(vec(p0, p3));
    return techoLen >= pisoLen ? FORMAS.TRAPECIO_TECHO : FORMAS.TRAPECIO_PISO;
  }

  if (parLados) {
    const izqLen = len2(vec(p0, p1));
    const derLen = len2(vec(p3, p2));
    return izqLen >= derLen ? FORMAS.TRAPECIO_IZQ : FORMAS.TRAPECIO_DER;
  }

  return null;
}
