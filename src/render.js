/**
 * render.js — Video + overlay monocromático (sin shadowBlur para rendimiento móvil)
 */

import { PUNTA_IDS } from './hands.js';
import { state } from './state.js';

// Sin shadowBlur — rojo para el cuadrilátero, resto monocromático
const COLOR_LINEA      = 'rgba(255,255,255,0.18)';
const COLOR_FILL       = 'rgba(230,57,70,0.08)';
const COLOR_BORDE      = 'rgba(230,57,70,0.55)';
const COLOR_PUNTO      = 'rgba(230,57,70,0.9)';
// Dos triángulos: blanco semitransparente (sin shadowBlur)
const COLOR_TRI_A_FILL = 'rgba(255,255,255,0.07)';
const COLOR_TRI_A_BORDE= 'rgba(255,255,255,0.60)';
const COLOR_TRI_B_FILL = 'rgba(255,255,255,0.04)';
const COLOR_TRI_B_BORDE= 'rgba(255,255,255,0.35)';

const CONEXIONES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

const LABEL_FORMA = {
  rectangulo:    'Rectángulo   Do',
  trapecio_piso: 'Trapecio piso   Re',
  trapecio_techo:'Trapecio techo   Mi',
  trapecio_izq:  'Trapecio izq.   Fa',
  trapecio_der:  'Trapecio der.   Sol',
  la:            'Pinza der.   La',
  si:            'Pinza izq.   Si',
  do_alto:       'Pulgares arriba   Do₂',
  dos_triangulos:'▲ ▲   Acid',
};

export function renderFrame(ctx, video, canvas, manos, puntosGesto, forma) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Video espejado en escala de grises (sin contrast para ahorrar GPU en móvil)
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-w, 0);
  ctx.globalAlpha = 0.4;
  ctx.filter = 'grayscale(1)';
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  if (forma === 'dos_triangulos' && manos.length >= 2) {
    dibujarDosTriangulos(ctx, manos, w, h);
  } else if (puntosGesto) {
    dibujarCuadrilatero(ctx, puntosGesto, w, h);
  }

  if (state.mostrarOverlay) {
    for (const landmarks of manos) {
      dibujarEsqueleto(ctx, landmarks, w, h);
      dibujarPuntas(ctx, landmarks, w, h);
    }
  }

  // El nombre de la nota se ve siempre que la voz de notas esté sonando, haya
  // ritmo o no. El bpm solo cuando hay ritmo: sin transporte no dice nada.
  if (state.notasIniciadas) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '300 13px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (state.audioIniciado) ctx.fillText(`${state.bpm} bpm`, w - 24, 32);
    if (forma && LABEL_FORMA[forma]) {
      ctx.fillStyle = 'rgba(230,57,70,0.75)';
      ctx.fillText(LABEL_FORMA[forma], w - 24, state.audioIniciado ? 54 : 32);
    }
    ctx.textAlign = 'left';
  }
}

function dibujarDosTriangulos(ctx, manos, w, h) {
  const ordenadas = [...manos].sort((a, b) =>
    ((b[4].x + b[8].x) / 2) - ((a[4].x + a[8].x) / 2)
  );

  const estilos = [
    { fill: COLOR_TRI_A_FILL, stroke: COLOR_TRI_A_BORDE, r: 3.5 },
    { fill: COLOR_TRI_B_FILL, stroke: COLOR_TRI_B_BORDE, r: 3   },
  ];

  for (let i = 0; i < 2; i++) {
    const lm  = ordenadas[i];
    const est = estilos[i];
    const pts = [4, 8, 0].map(idx => [(1 - lm[idx].x) * w, lm[idx].y * h]);

    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.lineTo(...pts[1]);
    ctx.lineTo(...pts[2]);
    ctx.closePath();
    ctx.fillStyle   = est.fill;
    ctx.fill();
    ctx.strokeStyle = est.stroke;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.fillStyle = est.stroke;
    for (const pt of pts) {
      ctx.beginPath();
      ctx.arc(...pt, est.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function dibujarCuadrilatero(ctx, puntos, w, h) {
  const coords = puntos.map(p => [(1 - p.x) * w, p.y * h]);

  ctx.beginPath();
  ctx.moveTo(...coords[0]);
  for (let i = 1; i < coords.length; i++) ctx.lineTo(...coords[i]);
  ctx.closePath();
  ctx.fillStyle = COLOR_FILL;
  ctx.fill();
  ctx.strokeStyle = COLOR_BORDE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = COLOR_BORDE;
  for (const [x, y] of coords) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function dibujarEsqueleto(ctx, landmarks, w, h) {
  ctx.strokeStyle = COLOR_LINEA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [a, b] of CONEXIONES) {
    const pa = landmarks[a], pb = landmarks[b];
    ctx.moveTo((1 - pa.x) * w, pa.y * h);
    ctx.lineTo((1 - pb.x) * w, pb.y * h);
  }
  ctx.stroke();
}

function dibujarPuntas(ctx, landmarks, w, h) {
  ctx.fillStyle = COLOR_PUNTO;
  for (const idx of PUNTA_IDS) {
    const p = landmarks[idx];
    ctx.beginPath();
    ctx.arc((1 - p.x) * w, p.y * h, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
