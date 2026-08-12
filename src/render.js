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

// Los tres tercios del modo acordes. Deben coincidir con LIM_AGUDO/LIM_GRAVE
// de main.js: acá sólo se dibujan.
const TERCIO_AGUDO = 0.36;
const TERCIO_GRAVE = 0.64;

export function renderFrame(ctx, video, canvas, manos, puntosGesto, forma, acordes, mayores) {
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

  if (acordes && acordes.activo) dibujarTercios(ctx, w, h, acordes.registro);

  if (forma === 'dos_triangulos' && manos.length >= 2) {
    dibujarDosTriangulos(ctx, manos, w, h);
  } else if (puntosGesto) {
    dibujarCuadrilatero(ctx, puntosGesto, w, h);
    // La línea de los mayores va con el cuadrilátero, no con el acid: ahí las
    // manos están cruzadas y una línea más sólo confunde.
    if (mayores) dibujarLineaMayores(ctx, mayores, w, h);
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
    const y = state.audioIniciado ? 54 : 32;

    if (acordes && acordes.activo) {
      // El acorde en grande y en cifrado, que es lo que se lee de un vistazo;
      // el nombre y el registro debajo, más chicos
      if (acordes.cifrado) {
        ctx.fillStyle = 'rgba(230,57,70,0.9)';
        ctx.font = '600 30px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText(acordes.cifrado, w - 24, y + 22);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '300 12px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText(`${acordes.nombre} · ${acordes.registro}`, w - 24, y + 40);
      }
    } else if (forma && LABEL_FORMA[forma]) {
      ctx.fillStyle = 'rgba(230,57,70,0.75)';
      ctx.fillText(LABEL_FORMA[forma], w - 24, y);
    }

    // Lectura de calibración del mayor. Está para afinar los umbrales con manos
    // de verdad; una vez calibrado, esta línea se puede borrar.
    if (mayores) {
      const leer = m => `${m.razon.toFixed(2)}${m.estirado ? ' ▲' : ' ▾'}`;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = '300 11px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(`mayor  izq ${leer(mayores[0])}   der ${leer(mayores[1])}`, w - 24, y + 62);
    }
    ctx.textAlign = 'left';
  }
}

/** Las tres franjas del modo acordes, con la activa apenas encendida */
function dibujarTercios(ctx, w, h, registro) {
  const y1 = h * TERCIO_AGUDO;
  const y2 = h * TERCIO_GRAVE;

  const activa = { agudo: [0, y1], medio: [y1, y2], grave: [y2, h] }[registro];
  if (activa) {
    ctx.fillStyle = 'rgba(230,57,70,0.05)';
    ctx.fillRect(0, activa[0], w, activa[1] - activa[0]);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.moveTo(0, y1); ctx.lineTo(w, y1);
  ctx.moveTo(0, y2); ctx.lineTo(w, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font = '300 10px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AGUDO', 24, y1 - 12);
  ctx.fillText('MEDIO', 24, y2 - 12);
  ctx.fillText('GRAVE', 24, h - 12);
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

/**
 * Línea entre los dos dedos mayores.
 *
 * Recogidos, se ancla en los nudillos y queda por dentro de la figura, a la
 * altura de la palma. Al estirar un mayor, ese extremo salta a la punta y sube
 * por encima del lado que une los índices: la figura gana un techo.
 *
 * Ese salto ES el indicador. Se ve el momento exacto en que el dedo entra, sin
 * leer nada — y cada extremo va por su cuenta, porque las manos son
 * independientes.
 */
function dibujarLineaMayores(ctx, mayores, w, h) {
  const pts = mayores.map(m => [(1 - m.punto.x) * w, m.punto.y * h]);

  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  ctx.lineTo(...pts[1]);
  ctx.strokeStyle = COLOR_BORDE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  mayores.forEach((m, i) => {
    const [x, y] = pts[i];
    if (m.estirado) {
      // Punta: círculo lleno con halo — el extremo está «puesto»
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_FILL;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_PUNTO;
      ctx.fill();
    } else {
      // Nudillo: aro hueco y chico — el extremo está en reposo
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = COLOR_BORDE;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
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
