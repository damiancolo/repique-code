/**
 * render.js — Video + overlay de landmarks + cuadrilátero gestual
 */

import { PUNTA_IDS } from './hands.js';
import { state } from './state.js';

const COLOR_PUNTO = '#e63946';
const COLOR_LINEA = 'rgba(255, 255, 255, 0.22)';
const COLOR_CUAD  = 'rgba(230, 57, 70, 0.08)';
const COLOR_CUAD_BORDE = 'rgba(230, 57, 70, 0.5)';

const CONEXIONES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

const LABEL_FORMA = {
  rectangulo:    'Do   C3',
  trapecio_piso: 'Re   D3',
  trapecio_techo:'Mi   E3',
  trapecio_izq:  'Fa   F3',
  trapecio_der:  'Sol  G3',
  la:            'La   A3',
  si:            'Si   B3',
};

const TRACKS = ['madera', 'chico', 'repique', 'piano'];

export function renderFrame(ctx, video, canvas, manos, puntosGesto, forma,
  trackStates     = [false,false,false,false],
  framesPorDedo   = [0,0,0,0],
  framesActivar   = 90,
  framesCierre    = 0,
  framesCierreMax = 10,
) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-w, 0);
  ctx.globalAlpha = 0.4;
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  if (puntosGesto) dibujarCuadrilatero(ctx, puntosGesto, w, h);

  if (state.mostrarOverlay) {
    for (const landmarks of manos) {
      dibujarEsqueleto(ctx, landmarks, w, h);
      dibujarPuntas(ctx, landmarks, w, h);
    }
  }

  if (state.audioIniciado) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '300 13px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${state.bpm} bpm`, w - 24, 32);
    if (forma && LABEL_FORMA[forma]) {
      ctx.fillStyle = 'rgba(230, 57, 70, 0.7)';
      ctx.fillText(LABEL_FORMA[forma], w - 24, 54);
    }
    ctx.textAlign = 'left';
  }

  if (state.audioIniciado) {
    const baseX = 24;
    const baseY = h - 28;
    ctx.font = '300 11px "Space Grotesk", system-ui, sans-serif';

    TRACKS.forEach((label, i) => {
      const activo   = trackStates[i];
      const progreso = Math.min(framesPorDedo[i] / framesActivar, 1);
      const cargando = !activo && progreso > 0;
      const x = baseX + i * 72;

      ctx.beginPath();
      ctx.arc(x, baseY - 14, 3, 0, Math.PI * 2);
      if (activo) {
        ctx.fillStyle   = '#e63946';
        ctx.shadowColor = '#e63946';
        ctx.shadowBlur  = 7;
      } else {
        ctx.fillStyle  = cargando ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      if (cargando) {
        ctx.beginPath();
        ctx.arc(x, baseY - 14, 8, -Math.PI / 2, -Math.PI / 2 + progreso * Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = activo ? 'rgba(230,57,70,0.9)' : cargando ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
      ctx.fillText(label, x - 14, baseY);
    });

    if (framesCierre > 0) {
      const t  = Math.min(framesCierre / framesCierreMax, 1);
      const cx = baseX + 1.5 * 72;
      const cy = baseY - 14;
      const r  = 1.5 * 72 * 0.5 + 8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
      ctx.strokeStyle = `rgba(230,57,70,${0.3 + 0.6 * t})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }
  }
}

function dibujarCuadrilatero(ctx, puntos, w, h) {
  const coords = puntos.map(p => [(1 - p.x) * w, p.y * h]);

  ctx.beginPath();
  ctx.moveTo(...coords[0]);
  for (let i = 1; i < coords.length; i++) ctx.lineTo(...coords[i]);
  ctx.closePath();

  ctx.fillStyle = COLOR_CUAD;
  ctx.fill();

  ctx.strokeStyle = COLOR_CUAD_BORDE;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#e63946';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = COLOR_CUAD_BORDE;
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
  for (const idx of PUNTA_IDS) {
    const p = landmarks[idx];
    ctx.shadowColor = COLOR_PUNTO;
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc((1 - p.x) * w, p.y * h, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_PUNTO;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}
