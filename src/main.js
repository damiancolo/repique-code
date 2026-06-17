/**
 * main.js — Bootstrap de Repique Code
 */

import { initHands, detectarManos, calcularGestos, detectarVictoria } from './hands.js';
import { renderFrame } from './render.js';
import { startAudio, stopAudio, setVolumen, actualizarBPM, actualizarFiltro, actualizarArea, actualizarNota, resetTracks, setModoTecno, actualizarWow, resetNotaAcid, resumeContextSync, cambiarRitmo, BANCO_PATRONES, CANDOMBE_REAL_IDX, efectoTechnoDrop, efectoRiser, efectoStab, efectoImpacto, efectoArpegio, efectoLaser, efectoShimmer, efectoPluck, efectoSweep, efectoEscaleraSube, efectoEscaleraBaja, armarLooper, pararLooper, onLooperEstado, getLooperEstado, dispararGesto, BIBLIOTECA, GESTOS_BAILE, getAsignaciones, setAsignacion, previewSonido, setFamilia, getFamilia } from './audio.js';
import { state } from './state.js';

const video         = document.getElementById('video');
const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const canvasPaint   = document.getElementById('canvas-paint');
const ctxPaint      = canvasPaint.getContext('2d');
const btnStart      = document.getElementById('btn-start');
const btnStop       = document.getElementById('btn-stop');
const btnPaint      = document.getElementById('btn-paint');
const volInput      = document.getElementById('volume');
const status        = document.getElementById('status');
const lockIndicator = document.getElementById('lock-indicator');
const paleta        = document.getElementById('paleta');
const btnLimpiar    = document.getElementById('btn-limpiar');
const colorBtns     = document.querySelectorAll('.color-btn');
const btnRitmo      = document.getElementById('btn-ritmo');
const menuRitmo     = document.getElementById('menu-ritmo');
const ritmoBtns     = document.querySelectorAll('.ritmo-btn');
const vinculosCanvas = document.getElementById('vinculos-canvas');
const vinculosCtx    = vinculosCanvas.getContext('2d');

async function init() {
  function redimensionar() {
    canvas.width          = window.innerWidth;
    canvas.height         = window.innerHeight;
    canvasPaint.width     = window.innerWidth;
    canvasPaint.height    = window.innerHeight;
    vinculosCanvas.width  = window.innerWidth;
    vinculosCanvas.height = window.innerHeight;
  }
  redimensionar();
  window.addEventListener('resize', redimensionar);

  // Webcam
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise((r) => video.addEventListener('loadeddata', r, { once: true }));
    await video.play();
    status.textContent = 'Cargando modelo…';
  } catch (err) {
    status.textContent = 'Error: sin acceso a la cámara';
    console.error('[Repique Code] Webcam:', err);
    return;
  }

  // MediaPipe
  try {
    await initHands();
    status.textContent = '';
    btnStart.disabled = false;
  } catch (err) {
    status.textContent = 'Error cargando MediaPipe';
    console.error('[Repique Code] MediaPipe:', err);
    return;
  }

  // ── Debounce de forma (cuadrilátero) ────────────────────────────────────────
  const FRAMES_FORMA = 4;
  let formaCandidato = null;
  let framesCandidato = 0;
  let formaConfirmada = null;
  let enModoTecno = false;
  let areaHold = 0;
  const AREA_HOLD_MAX = 10;

  // ── Lock de tempo/tono ───────────────────────────────────────────────────────
  const FRAMES_DOS_PINZAS = 8;
  const FRAMES_VICTORIA   = 8;
  let locked = false;
  let dosPinzasCount  = 0;
  let dosPinzasActivo = false;
  let victoriaCount   = 0;
  let victoriaActivo  = false;

  // ── Sliders de tempo y filtro ────────────────────────────────────────────────
  let _bpmTarget   = 120;
  let _filtroT     = 0.73; // ≈ 4000 Hz, estado inicial del filtro
  let _gestureDrag = null; // { tipo: 'bpm'|'filtro', startY, startVal }
  let tempoLocked  = false; // candado manual del slider de tempo
  let filtroLocked = false; // candado manual del slider de graves/agudos

  // ── Vínculos ─────────────────────────────────────────────────────────────────
  const FRAMES_SHAKA  = 15;
  const SAT_MIN_SPEED  = 420;  // px/s — necesita un flick deliberado y rápido
  const SAT_JERK_RATIO = 3.5;  // speed actual debe ser 3.5× el promedio reciente (contraste claro)
  const SAT_COOLDOWN   = 500;  // ms entre lanzamientos
  let shakaCount      = 0;
  let shakaActivo     = false;
  let vinculosVisible = false;
  let _satellites     = [];
  let _prevPointers   = []; // [{ x, y, speeds:[] }] — una entrada por mano señalando
  let _lastSatTime    = 0;

  // Posiciones de las estrellas de Vínculos (normalizadas 0-1, mismas que Vinculos.jsx)
  const VINCULOS_STARS = [
    { x:0.18,  y:0.58,  mag:-1.46, color:[202,215,255] },
    { x:0.1,   y:0.85,  mag:-0.74, color:[255,244,232] },
    { x:0.74,  y:0.28,  mag:-0.05, color:[255,210,161] },
    { x:0.6,   y:0.1,   mag: 0.03, color:[202,215,255] },
    { x:0.33,  y:0.15,  mag: 0.08, color:[255,244,232] },
    { x:0.24,  y:0.44,  mag: 0.13, color:[181,199,255] },
    { x:0.3,   y:0.5,   mag: 0.34, color:[255,248,240] },
    { x:0.22,  y:0.37,  mag: 0.42, color:[255,181,107] },
    { x:0.29,  y:0.32,  mag: 0.86, color:[255,181,107] },
    { x:0.83,  y:0.6,   mag: 0.96, color:[255,136,102] },
    { x:0.67,  y:0.47,  mag: 0.97, color:[181,199,255] },
    { x:0.9,   y:0.74,  mag: 1.16, color:[202,215,255] },
    { x:0.54,  y:0.06,  mag: 1.25, color:[232,240,255] },
    { x:0.5,   y:0.37,  mag: 1.4,  color:[181,199,255] },
    { x:0.5,   y:0.03,  mag: 1.98, color:[255,248,232] },
    { x:0.36,  y:0.2,   mag: 1.58, color:[232,240,255] },
    { x:0.38,  y:0.24,  mag: 1.14, color:[255,210,161] },
    { x:0.2,   y:0.4,   mag: 1.64, color:[181,199,255] },
    { x:0.215, y:0.42,  mag: 1.69, color:[181,199,255] },
    { x:0.21,  y:0.435, mag: 1.77, color:[202,215,255] },
    { x:0.225, y:0.41,  mag: 2.23, color:[202,215,255] },
    { x:0.05,  y:0.92,  mag: 0.46, color:[181,199,255] },
    { x:0.78,  y:0.78,  mag: 0.61, color:[181,199,255] },
    { x:0.62,  y:0.22,  mag: 0.77, color:[255,248,240] },
    { x:0.55,  y:0.52,  mag: 1.04, color:[181,199,255] },
    { x:0.42,  y:0.12,  mag: 1.8,  color:[255,244,232] },
    { x:0.45,  y:0.08,  mag: 1.79, color:[255,210,161] },
    { x:0.14,  y:0.65,  mag: 1.84, color:[255,244,232] },
    { x:0.88,  y:0.65,  mag: 1.87, color:[255,248,240] },
    { x:0.12,  y:0.78,  mag: 1.86, color:[255,210,161] },
  ];
  const CONN_RADIUS     = 0.18; // sat → estrella (igual que en Vínculos)
  const SAT_CONN_RADIUS = 0.22; // sat → sat

  function setLocked(val) {
    locked = val;
    lockIndicator.textContent   = locked ? '⏸ bloqueado' : '';
    lockIndicator.style.opacity = locked ? '0.7' : '0';
  }

  // ── Modo pintar ──────────────────────────────────────────────────────────────
  // El orden DEBE coincidir con los botones de #fila-colores en index.html
  const COLORES_PINCEL = [
    '#e63946', '#ff6b35', '#f4d03f', '#a3e635', '#27ae60', '#2dd4bf',
    '#38bdf8', '#4a90e2', '#a855f7', '#ec4899', '#ffffff', '#C44A1A',
  ];
  // Versión translúcida para la brocha, derivada del pincel
  const COLORES_BROCHA = COLORES_PINCEL.map(hex => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.22)`;
  });
  // Gesto de dedo → índice en la paleta (mantiene los tonos bien distintos):
  // ☝ índice=rojo · ✌ medio=azul · 💍 anular=verde · 🤙 meñique=amarillo · 👍 pulgar=naranja
  const DEDO_A_COLOR = [0, 7, 4, 2, 1];

  // ── Estilos, tamaños y espejo ────────────────────────────────────────────────
  const TAM_LINEA    = [3, 6, 12];   // s / m / l
  const TAM_BROCHA   = [20, 32, 52];
  const RADIO_SPRAY  = [12, 20, 32];
  const RADIOS_BORRA = [16, 28, 48];
  let estiloActual = 'linea';        // linea | neon | spray | arcoiris
  let tamIdx       = 1;
  let espejoModo   = 0;              // 0 = no · 1 = espejo ×2 · 2 = mandala ×6
  let _hue         = 0;              // estado del arcoíris

  // ── Deshacer (snapshots del buffer) ──────────────────────────────────────────
  const SNAPSHOTS_MAX = 4;
  let _snapshots = [];
  let _borrando  = false;
  function guardarSnapshot() {
    const c = document.createElement('canvas');
    c.width  = bufCanvas.width;
    c.height = bufCanvas.height;
    c.getContext('2d').drawImage(bufCanvas, 0, 0);
    _snapshots.push(c);
    if (_snapshots.length > SNAPSHOTS_MAX) _snapshots.shift();
  }
  // Índices landmark de las puntas y articulaciones PIP de los 4 dedos
  const FINGER_TIPS = [8, 12, 16, 20]; // índice, medio, anular, meñique
  const FINGER_PIPS = [6, 10, 14, 18];
  let modoPintar     = false;
  let colorIdx       = 0;
  // Pintura viva: el dibujo late con el beat del secuenciador
  let _pulse         = 0;  // envolvente 1→0 que dispara cada negra
  let _lastStepPulse = -2;

  // ── Modo baile: efectos reactivos al movimiento y al beat ───────────────────
  let modoBaile    = false;
  let efectoActual = 'estela'; // estela | quetzal | particulas | fuego | rayo | ondas
  let _beatBaile   = false;    // flanco de beat para los efectos (lo consume renderBaile)
  let _hueBaile    = 200;
  let _baileHands  = [];       // [{x, y, vx, vy, speed, trail:[{x,y}]}]
  let _parts       = [];       // partículas vivas
  let _ondas       = [];       // círculos en expansión
  let _estrellas   = [];       // estrellas de la galaxia
  // Gestos-efecto: movimientos de baile que disparan sonidos electrónicos
  let _coolGesto     = { drop: 0, riser: 0, stab: 0, impact: 0, arp: 0, laser: 0, cielo: 0, pluck: 0, sweep: 0, escalera: 0 };
  let _cieloFrames   = 0;             // frames con las dos manos al cielo
  let _halos         = [];            // anillos localizados al disparar un gesto
  let _distManosPrev = null;          // distancia entre palmas en el frame anterior
  let ultimoPtoBuf   = null;
  let ultimoGesture  = null;
  let colorSeleccion = null; // { idx, inicio, sx, sy }
  const MS_SELECCION = 2000;

  // Offscreen buffer — mismo tamaño que canvas para coords 1:1
  const bufCanvas = document.createElement('canvas');
  const bufCtx    = bufCanvas.getContext('2d');
  function sincBuf() {
    // Sólo redimensionar si cambió (evita borrar el dibujo)
    if (bufCanvas.width !== canvas.width || bufCanvas.height !== canvas.height) {
      // Guardar contenido, redimensionar, restaurar
      const tmp = document.createElement('canvas');
      tmp.width  = bufCanvas.width;
      tmp.height = bufCanvas.height;
      tmp.getContext('2d').drawImage(bufCanvas, 0, 0);
      bufCanvas.width  = canvas.width;
      bufCanvas.height = canvas.height;
      bufCtx.drawImage(tmp, 0, 0);
    }
  }

  /**
   * Detecta el gesto de pintura en una mano.
   * 'dibujar' → solo índice extendido (señalar)
   * 'brocha'  → índice + medio + anular extendidos
   * null      → gesto no reconocido
   */
  function detectarGesturePintura(mano) {
    const ext = (tip, pip) => mano[tip].y < mano[pip].y - 0.025;
    const idxE = ext(8,  6);
    const midE = ext(12, 10);
    const rinE = ext(16, 14);
    const pinE = ext(20, 18);
    if (idxE && midE && rinE && !pinE) return 'brocha';
    if (idxE && !midE && !rinE && !pinE) return 'dibujar';
    return null;
  }

  /** Punta de mayor (12) pegada a la punta de índice (8) → control de tempo */
  function dosDeadosPegados(mano) {
    return Math.hypot(mano[8].x - mano[12].x, mano[8].y - mano[12].y) < 0.08;
  }

  /** Verifica que los dedos proyectados estén encima del área de un slider en pantalla */
  function dedosSobreSlider(mano, wrapId) {
    const rect = document.getElementById(wrapId).getBoundingClientRect();
    // Coordenadas espejadas (igual que el canvas de render)
    const sx = (1 - (mano[8].x + mano[12].x) / 2) * window.innerWidth;
    const sy = ((mano[8].y + mano[12].y) / 2) * window.innerHeight;
    const margenH = 55; // horizontal
    const margenV = 55; // vertical — zona de enganche inicial
    return sx >= rect.left - margenH && sx <= rect.right  + margenH &&
           sy >= rect.top  - margenV && sy <= rect.bottom + margenV;
  }

  /** Índice extendido (señalar) — sin importar los demás dedos */
  function indiceApunta(mano) {
    return mano[8].y < mano[6].y - 0.02;
  }

  /** Puño: todos los dedos cerrados */
  function esPuno(mano) {
    return FINGER_TIPS.every((tip, i) => mano[tip].y >= mano[FINGER_PIPS[i]].y - 0.02);
  }

  /** Shaka 🤙: pulgar arriba + meñique arriba, índice/medio/anular cerrados */
  function gestoSurfista(mano) {
    const thumbUp  = mano[4].y  < mano[2].y  - 0.04;
    const pinkyUp  = mano[20].y < mano[18].y - 0.025;
    const idxClose = mano[8].y  >= mano[6].y  - 0.02;
    const midClose = mano[12].y >= mano[10].y - 0.02;
    const rinClose = mano[16].y >= mano[14].y - 0.02;
    return thumbUp && pinkyUp && idxClose && midClose && rinClose;
  }

  /**
   * Dibuja una estrella igual que en Vínculos: núcleo + halo radial.
   * nx, ny: posición normalizada (0-1). mag: magnitud (-1 = satélite brillante).
   */
  function drawVStar(nx, ny, mag, col, tw) {
    const W  = vinculosCanvas.width;
    const H  = vinculosCanvas.height;
    const px = nx * W;
    const py = ny * H;
    const f  = Math.max(0.15, 1 - mag / 6);
    const sz = f * 2.6;
    const a  = Math.min(1, f * 0.92 * tw);
    const gr = vinculosCtx.createRadialGradient(px, py, 0, px, py, sz * 4.5);
    gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${(a * 0.22).toFixed(3)})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    vinculosCtx.fillStyle = gr;
    vinculosCtx.beginPath();
    vinculosCtx.arc(px, py, sz * 4.5, 0, Math.PI * 2);
    vinculosCtx.fill();
    vinculosCtx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
    vinculosCtx.beginPath();
    vinculosCtx.arc(px, py, sz, 0, Math.PI * 2);
    vinculosCtx.fill();
  }

  /** Línea de conexión satélite → estrella nombrada (igual que drawConnection en Vínculos) */
  function drawVConn(sat, star, alpha) {
    const W  = vinculosCanvas.width;
    const H  = vinculosCanvas.height;
    const x1 = sat.x * W;
    const y1 = sat.y * H;
    const x2 = star.x * W;
    const y2 = star.y * H;
    const c  = star.color;
    const a  = alpha.toFixed(3);
    const grad = vinculosCtx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0,   `rgba(150,210,255,${(alpha * 0.85).toFixed(3)})`);
    grad.addColorStop(0.6, `rgba(120,185,235,${(alpha * 0.45).toFixed(3)})`);
    grad.addColorStop(1,   `rgba(${c[0]},${c[1]},${c[2]},${(alpha * 0.25).toFixed(3)})`);
    vinculosCtx.strokeStyle = grad;
    vinculosCtx.lineWidth   = 1.2;
    vinculosCtx.beginPath();
    vinculosCtx.moveTo(x1, y1);
    vinculosCtx.lineTo(x2, y2);
    vinculosCtx.stroke();
    // Halo en el extremo de la estrella
    const pg = vinculosCtx.createRadialGradient(x2, y2, 0, x2, y2, 7);
    pg.addColorStop(0, `rgba(150,210,255,${(alpha * 0.3).toFixed(3)})`);
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    vinculosCtx.fillStyle = pg;
    vinculosCtx.beginPath();
    vinculosCtx.arc(x2, y2, 7, 0, Math.PI * 2);
    vinculosCtx.fill();
  }

  /** Línea de conexión satélite → satélite */
  function drawSatConn(s1, s2, alpha) {
    const W  = vinculosCanvas.width;
    const H  = vinculosCanvas.height;
    const x1 = s1.x * W;
    const y1 = s1.y * H;
    const x2 = s2.x * W;
    const y2 = s2.y * H;
    const grad = vinculosCtx.createLinearGradient(x1, y1, x2, y2);
    const a = (alpha * 0.65).toFixed(3);
    grad.addColorStop(0, `rgba(150,210,255,${a})`);
    grad.addColorStop(1, `rgba(150,210,255,${a})`);
    vinculosCtx.strokeStyle = grad;
    vinculosCtx.lineWidth   = 0.9;
    vinculosCtx.beginPath();
    vinculosCtx.moveTo(x1, y1);
    vinculosCtx.lineTo(x2, y2);
    vinculosCtx.stroke();
  }

  /** Lanza un satélite. nx, ny normalizados (0-1); vxPx, vyPx en px/s */
  function launchSatellite(nx, ny, vxPx, vyPx) {
    const W   = vinculosCanvas.width  || window.innerWidth;
    const H   = vinculosCanvas.height || window.innerHeight;
    // Velocidad normalizada: escalar para que cruce la pantalla en ~18-35 s
    const vxN = (vxPx / W) * 0.14;
    const vyN = (vyPx / H) * 0.14;
    _satellites.push({ x: nx, y: ny, vx: vxN, vy: vyN, age: 0, maxLife: 14 });
  }

  /** Actualiza física y dibuja todos los satélites + conexiones estilo Vínculos */
  function updateSatellites(dt) {
    vinculosCtx.clearRect(0, 0, vinculosCanvas.width, vinculosCanvas.height);
    _satellites = _satellites.filter(s => s.age < s.maxLife);
    const now = performance.now() / 1000;

    // ─ 1. Conexiones sat→sat (debajo de todo) ────────────────────────────────
    for (let i = 0; i < _satellites.length; i++) {
      for (let j = i + 1; j < _satellites.length; j++) {
        const s1   = _satellites[i];
        const s2   = _satellites[j];
        const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
        if (dist < SAT_CONN_RADIUS) {
          const lifeFade = Math.min((s1.maxLife - s1.age) / 3, (s2.maxLife - s2.age) / 3, 1);
          const alpha    = (1 - dist / SAT_CONN_RADIUS) * lifeFade;
          drawSatConn(s1, s2, alpha);
        }
      }
    }

    // ─ 2. Conexiones sat→estrella + cuerpo del satélite ─────────────────────
    for (const s of _satellites) {
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
      s.age += dt;

      const fadeIn   = Math.min(s.age / 0.8, 1);
      const lifeFade = Math.min((s.maxLife - s.age) / 3, 1);
      const presence = fadeIn * lifeFade;

      // Conexiones a las estrellas cercanas (máx 6, igual que Vínculos)
      const nearby = VINCULOS_STARS
        .map(star => ({ star, dist: Math.hypot(s.x - star.x, s.y - star.y) }))
        .filter(d => d.dist < CONN_RADIUS)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 6);

      for (const { star, dist } of nearby) {
        const alpha = (1 - dist / CONN_RADIUS) * presence * 0.9;
        drawVConn(s, star, alpha);
      }

      // Dibujar el satélite como estrella brillante (mag=-1 → máximo brillo)
      const tw = 0.78 + 0.22 * Math.sin(now * 0.5 + s.x * 11 + s.y * 7);
      drawVStar(s.x, s.y, -1, [195, 220, 255], tw * presence);
    }
  }

  /**
   * En la mano "selectora": detecta exactamente un dedo/pulgar extendido.
   * 0=índice(rojo) 1=medio(azul) 2=anular(verde) 3=meñique(amarillo) 4=pulgar(naranja)
   */
  function detectarDedoColor(mano) {
    // Solo evaluar los 4 dedos principales (sin pulgar)
    const ext      = FINGER_TIPS.map((tip, i) => mano[tip].y < mano[FINGER_PIPS[i]].y - 0.03);
    const thumbUp  = mano[4].y < mano[2].y - 0.04;
    const extCount = ext.filter(Boolean).length;
    // Pulgar solo (los demás cerrados) → naranja
    if (thumbUp && extCount === 0) return 4;
    // Exactamente un dedo extendido (el pulgar puede estar libre, no importa)
    if (extCount === 1) return ext.indexOf(true);
    return null;
  }

  function aplicarTrazo(mano, gesture) {
    const bx = (1 - mano[8].x) * canvas.width;
    const by = mano[8].y * canvas.height;

    if (gesture !== ultimoGesture) { ultimoPtoBuf = null; ultimoGesture = gesture; }
    if (!ultimoPtoBuf) {
      guardarSnapshot(); // inicio de trazo → punto de restauración para deshacer
      ultimoPtoBuf = { x: bx, y: by };
      return;
    }
    trazarSegmento(ultimoPtoBuf, { x: bx, y: by }, gesture);
    ultimoPtoBuf = { x: bx, y: by };
  }

  function _rotar(p, cx, cy, ang) {
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const dx = p.x - cx, dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  }

  /** Replica el segmento según el modo espejo y lo dibuja con el estilo activo */
  function trazarSegmento(p1, p2, gesture) {
    const W = bufCanvas.width, H = bufCanvas.height;
    const variantes = [[p1, p2]];
    if (espejoModo === 1) {
      variantes.push([{ x: W - p1.x, y: p1.y }, { x: W - p2.x, y: p2.y }]);
    } else if (espejoModo === 2) {
      const cx = W / 2, cy = H / 2;
      for (let k = 1; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        variantes.push([_rotar(p1, cx, cy, a), _rotar(p2, cx, cy, a)]);
      }
    }
    for (const [a, b] of variantes) _segmentoBase(a, b, gesture);
  }

  function _linea(a, b) {
    bufCtx.beginPath();
    bufCtx.moveTo(a.x, a.y);
    bufCtx.lineTo(b.x, b.y);
    bufCtx.stroke();
  }

  function _segmentoBase(a, b, gesture) {
    bufCtx.save();
    bufCtx.lineCap  = 'round';
    bufCtx.lineJoin = 'round';
    const dist = Math.hypot(b.x - a.x, b.y - a.y);

    if (gesture === 'brocha') {
      bufCtx.strokeStyle = COLORES_BROCHA[colorIdx];
      bufCtx.lineWidth   = TAM_BROCHA[tamIdx];
      _linea(a, b);

    } else if (estiloActual === 'neon') {
      const c = COLORES_PINCEL[colorIdx];
      bufCtx.shadowColor = c;
      bufCtx.shadowBlur  = TAM_LINEA[tamIdx] * 3;
      bufCtx.strokeStyle = c;
      bufCtx.lineWidth   = TAM_LINEA[tamIdx];
      _linea(a, b);
      // núcleo blanco encima — efecto tubo de neón
      bufCtx.shadowBlur  = 0;
      bufCtx.strokeStyle = 'rgba(255,255,255,0.85)';
      bufCtx.lineWidth   = Math.max(1, TAM_LINEA[tamIdx] * 0.4);
      _linea(a, b);

    } else if (estiloActual === 'spray') {
      const r = RADIO_SPRAY[tamIdx];
      const n = Math.max(8, Math.round(dist * 1.6));
      bufCtx.fillStyle = COLORES_PINCEL[colorIdx];
      for (let i = 0; i < n; i++) {
        const t  = i / n;
        // Punto aleatorio en disco (sqrt para densidad uniforme)
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * r;
        const px = a.x + (b.x - a.x) * t + Math.cos(ang) * rad;
        const py = a.y + (b.y - a.y) * t + Math.sin(ang) * rad;
        bufCtx.globalAlpha = 0.2 + Math.random() * 0.3;
        bufCtx.fillRect(px, py, 1.7, 1.7);
      }

    } else if (estiloActual === 'arcoiris') {
      _hue = (_hue + dist * 0.45) % 360;
      bufCtx.strokeStyle = `hsl(${_hue}, 90%, 62%)`;
      bufCtx.lineWidth   = TAM_LINEA[tamIdx];
      _linea(a, b);

    } else { // linea
      bufCtx.strokeStyle = COLORES_PINCEL[colorIdx];
      bufCtx.lineWidth   = TAM_LINEA[tamIdx];
      _linea(a, b);
    }
    bufCtx.restore();
  }

  function aplicarBorrador(puños) {
    // Mano derecha = menor X en cámara (aparece a la derecha en pantalla espejada)
    const manoDer = puños.reduce((acc, m) => (m[9].x < acc[9].x ? m : acc));
    const mx = (1 - manoDer[9].x) * canvas.width;
    const my = manoDer[9].y * canvas.height;
    sincBuf();
    if (!_borrando) { guardarSnapshot(); _borrando = true; } // deshacer recupera lo borrado
    bufCtx.globalCompositeOperation = 'destination-out';
    bufCtx.beginPath();
    bufCtx.arc(mx, my, RADIOS_BORRA[tamIdx], 0, Math.PI * 2);
    bufCtx.fillStyle = 'rgba(0,0,0,1)';
    bufCtx.fill();
    bufCtx.globalCompositeOperation = 'source-over';
    return { mx, my };
  }

  // ── Pintura viva: el dibujo respira con el beat ─────────────────────────────
  function drawBufConPulso() {
    sincBuf();
    if (_pulse > 0.01) {
      const s = 1 + _pulse * 0.014;
      const W = canvasPaint.width;
      const H = canvasPaint.height;
      ctxPaint.save();
      ctxPaint.translate(W / 2, H / 2);
      ctxPaint.scale(s, s);
      ctxPaint.translate(-W / 2, -H / 2);
      ctxPaint.shadowColor = 'rgba(255,255,255,0.55)';
      ctxPaint.shadowBlur  = 16 * _pulse;
      ctxPaint.drawImage(bufCanvas, 0, 0);
      ctxPaint.restore();
    } else {
      ctxPaint.drawImage(bufCanvas, 0, 0);
    }
  }

  function renderPaintCanvas(manos, gestureMano, seleccionInfo, borrarInfo) {
    ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    drawBufConPulso();

    // ── Indicador de selección de color ──────────────────────────────────────
    if (seleccionInfo) {
      const { pal, inicio, sx, sy } = seleccionInfo;
      const progress = Math.min((Date.now() - inicio) / MS_SELECCION, 1);
      const color    = COLORES_PINCEL[pal];
      const R        = 26;

      // Aro de fondo
      ctxPaint.beginPath();
      ctxPaint.arc(sx, sy, R, 0, Math.PI * 2);
      ctxPaint.strokeStyle = 'rgba(255,255,255,0.15)';
      ctxPaint.lineWidth = 5;
      ctxPaint.stroke();

      // Aro de progreso
      ctxPaint.beginPath();
      ctxPaint.arc(sx, sy, R, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctxPaint.strokeStyle = color;
      ctxPaint.lineWidth = 5;
      ctxPaint.stroke();

      // Punto central del color
      ctxPaint.beginPath();
      ctxPaint.arc(sx, sy, 9, 0, Math.PI * 2);
      ctxPaint.fillStyle = color;
      ctxPaint.globalAlpha = 0.85;
      ctxPaint.fill();
      ctxPaint.globalAlpha = 1;

      return;
    }

    // ── Cursor borrador (dos puños) ───────────────────────────────────────────
    if (borrarInfo) {
      const { mx, my } = borrarInfo;
      ctxPaint.beginPath();
      ctxPaint.arc(mx, my, RADIOS_BORRA[tamIdx], 0, Math.PI * 2);
      ctxPaint.strokeStyle = 'rgba(255,255,255,0.6)';
      ctxPaint.lineWidth = 2;
      ctxPaint.stroke();
      ctxPaint.beginPath();
      ctxPaint.arc(mx, my, 2, 0, Math.PI * 2);
      ctxPaint.fillStyle = 'rgba(255,255,255,0.5)';
      ctxPaint.fill();
      return;
    }

    // ── Cursor según gesto activo ─────────────────────────────────────────────
    if (gestureMano) {
      const { mano, gesture } = gestureMano;
      const sx = (1 - mano[8].x) * canvas.width;
      const sy = mano[8].y * canvas.height;
      if (gesture === 'dibujar') {
        ctxPaint.beginPath();
        ctxPaint.arc(sx, sy, Math.max(3, TAM_LINEA[tamIdx] * 0.9), 0, Math.PI * 2);
        ctxPaint.fillStyle = estiloActual === 'arcoiris' ? `hsl(${_hue}, 90%, 62%)` : COLORES_PINCEL[colorIdx];
        ctxPaint.fill();
      } else if (gesture === 'brocha') {
        ctxPaint.beginPath();
        ctxPaint.arc(sx, sy, TAM_BROCHA[tamIdx] / 2, 0, Math.PI * 2);
        ctxPaint.fillStyle = COLORES_BROCHA[colorIdx];
        ctxPaint.fill();
        ctxPaint.strokeStyle = COLORES_PINCEL[colorIdx];
        ctxPaint.lineWidth = 1.5;
        ctxPaint.stroke();
      } else if (gesture === 'borrar') {
        ctxPaint.beginPath();
        ctxPaint.arc(sx, sy, 24, 0, Math.PI * 2);
        ctxPaint.strokeStyle = 'rgba(255,255,255,0.7)';
        ctxPaint.lineWidth = 2;
        ctxPaint.stroke();
      }
    }
  }

  // ═══ MODO BAILE — efectos reactivos al movimiento ═══════════════════════════

  /** Punto de emisión del superpoder: centro de la palma DESPLAZADO unos
   *  centímetros hacia adelante por la NORMAL 3D de la palma (producto cruz
   *  con la z de MediaPipe). Palma hacia arriba → el efecto flota encima;
   *  palma a la cámara → queda sobre el centro de la palma. */
  function trackBaileHands(manos, dt) {
    const next = [];
    const usadas = new Set();
    const OFF = 85; // ≈ 2 pulgadas en pantalla
    for (const m of manos) {
      const px = (m[0].x + m[5].x + m[9].x + m[13].x + m[17].x) / 5;
      const py = (m[0].y + m[5].y + m[9].y + m[13].y + m[17].y) / 5;
      // Normal de la palma: (5−0) × (17−0) en 3D
      const ax = m[5].x - m[0].x,  ay = m[5].y - m[0].y,  az = (m[5].z || 0) - (m[0].z || 0);
      const bx = m[17].x - m[0].x, by = m[17].y - m[0].y, bz = (m[17].z || 0) - (m[0].z || 0);
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      // Siempre hacia el lado visible de la mano (el que mira a la cámara)
      if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const n3 = Math.hypot(nx, ny, nz) || 1;
      const x = (1 - px) * canvas.width - (nx / n3) * OFF;
      const y = py * canvas.height + (ny / n3) * OFF;
      let prev = null, best = canvas.width * 0.25;
      for (const h of _baileHands) {
        if (usadas.has(h)) continue;
        const d = Math.hypot(x - h.x, y - h.y);
        if (d < best) { best = d; prev = h; }
      }
      if (prev) usadas.add(prev);
      const vx = prev && dt > 0 ? (x - prev.x) / dt : 0;
      const vy = prev && dt > 0 ? (y - prev.y) / dt : 0;
      const trail = prev ? prev.trail : [];
      trail.push({ x, y });
      if (trail.length > 42) trail.shift();
      next.push({ x, y, vx, vy, speed: Math.hypot(vx, vy), trail });
    }
    // Manos perdidas: la estela se consume sola en vez de cortarse de golpe
    for (const h of _baileHands) {
      if (!usadas.has(h) && h.trail.length > 3) {
        h.trail.splice(0, 3);
        h.speed = 0;
        next.push(h);
      }
    }
    _baileHands = next;
  }

  function _emitPart(x, y, vx, vy, hue, life, sz) {
    _parts.push({ x, y, vx, vy, age: 0, life, hue, sz });
    if (_parts.length > 520) _parts.shift();
  }

  /** Avanza y dibuja todas las partículas (modo aditivo) */
  function _stepParts(dt, gravedad) {
    ctxPaint.save();
    ctxPaint.globalCompositeOperation = 'lighter';
    _parts = _parts.filter(p => p.age < p.life);
    for (const p of _parts) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += gravedad * dt;
      const k = 1 - p.age / p.life;
      ctxPaint.fillStyle = `hsla(${p.hue},95%,60%,${(k * 0.85).toFixed(3)})`;
      ctxPaint.beginPath();
      ctxPaint.arc(p.x, p.y, Math.max(0.5, p.sz * k), 0, Math.PI * 2);
      ctxPaint.fill();
    }
    ctxPaint.restore();
  }

  /** Estela — COMETA: núcleo incandescente en la palma, cola que se enfría
   *  hacia el color y chispas que se desprenden. Bien distinto del quetzal. */
  function fxEstela(dt) {
    ctxPaint.save();
    ctxPaint.globalCompositeOperation = 'lighter';
    ctxPaint.lineCap = 'round';
    for (const h of _baileHands) {
      const n = h.trail.length;
      // Cola: color frío atrás → blanco caliente cerca del núcleo
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const a = h.trail[i - 1], b = h.trail[i];
        const luz = 50 + t * 45; // 50% → 95% de luminosidad
        ctxPaint.strokeStyle = `hsla(${_hueBaile}, 100%, ${luz.toFixed(0)}%, ${(t * 0.8).toFixed(3)})`;
        ctxPaint.lineWidth = 1 + t * (15 + _pulse * 13);
        ctxPaint.beginPath();
        ctxPaint.moveTo(a.x, a.y);
        ctxPaint.lineTo(b.x, b.y);
        ctxPaint.stroke();
      }
      // Núcleo incandescente en la palma
      const R = 22 + _pulse * 18;
      const g = ctxPaint.createRadialGradient(h.x, h.y, 0, h.x, h.y, R);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35, `hsla(${_hueBaile}, 95%, 65%, 0.75)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctxPaint.fillStyle = g;
      ctxPaint.beginPath();
      ctxPaint.arc(h.x, h.y, R, 0, Math.PI * 2);
      ctxPaint.fill();
      // Chispas que se desprenden de la cola
      if (h.speed > 130 && Math.random() < 0.65 && n > 4) {
        const tp = h.trail[Math.max(0, n - 1 - Math.floor(Math.random() * 9))];
        _emitPart(tp.x, tp.y,
          (Math.random() * 2 - 1) * 70 - h.vx * 0.1,
          (Math.random() * 2 - 1) * 70 - h.vy * 0.1,
          _hueBaile, 0.5 + Math.random() * 0.5, 3);
      }
    }
    ctxPaint.restore();
    _stepParts(dt, 70);
    _hueBaile = (_hueBaile + 1.0) % 360;
  }

  /** Quetzal — serpiente emplumada que SERPENTEA: el cuerpo ondula con una
   *  sinusoide viajera alrededor del camino de la mano, esmeralda→oro,
   *  con plumas laterales y cabeza brillante */
  function fxQuetzal() {
    const ahora = performance.now() / 1000;
    ctxPaint.save();
    ctxPaint.globalCompositeOperation = 'lighter';
    ctxPaint.lineCap = 'round';
    for (const h of _baileHands) {
      const n = h.trail.length;
      if (n < 3) continue;
      // Cuerpo serpenteado: offset senoidal perpendicular que viaja en el tiempo
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const p = h.trail[i];
        const q = h.trail[Math.min(i + 1, n - 1)];
        const dx = q.x - p.x, dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const off = Math.sin(i * 0.55 + ahora * 7) * 18 * t * (1 + _pulse * 0.4);
        pts.push({ x: p.x + (-dy / len) * off, y: p.y + (dx / len) * off, t });
      }
      for (let i = 1; i < pts.length; i++) {
        const { t } = pts[i];
        const a = pts[i - 1], b = pts[i];
        // Cola dorada (45) → cabeza esmeralda (160)
        const hue = 45 + t * 115;
        ctxPaint.strokeStyle = `hsla(${hue}, 90%, 55%, ${(t * 0.85).toFixed(3)})`;
        ctxPaint.lineWidth = (3 + 19 * t) * (1 + _pulse * 0.5);
        ctxPaint.beginPath();
        ctxPaint.moveTo(a.x, a.y);
        ctxPaint.lineTo(b.x, b.y);
        ctxPaint.stroke();
        // Plumas laterales cada 4 puntos
        if (i % 4 === 0) {
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len;
          const pluma = (12 + 30 * t) * (1 + 0.4 * Math.sin(i * 1.3));
          ctxPaint.strokeStyle = `hsla(${hue + 20}, 95%, 62%, ${(t * 0.5).toFixed(3)})`;
          ctxPaint.lineWidth = 2.4;
          ctxPaint.beginPath();
          ctxPaint.moveTo(b.x - nx * pluma, b.y - ny * pluma);
          ctxPaint.lineTo(b.x + nx * pluma, b.y + ny * pluma);
          ctxPaint.stroke();
        }
      }
      // Cabeza: esmeralda brillante con corona dorada
      const cab = pts[pts.length - 1];
      const gr = ctxPaint.createRadialGradient(cab.x, cab.y, 0, cab.x, cab.y, 18);
      gr.addColorStop(0, 'hsla(160, 95%, 80%, 0.95)');
      gr.addColorStop(0.5, 'hsla(160, 90%, 50%, 0.55)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctxPaint.fillStyle = gr;
      ctxPaint.beginPath();
      ctxPaint.arc(cab.x, cab.y, 18, 0, Math.PI * 2);
      ctxPaint.fill();
    }
    ctxPaint.restore();
  }

  /** Partículas — chispas que salen disparadas con el movimiento */
  function fxParticulas(dt) {
    for (const h of _baileHands) {
      const n = Math.min(10, Math.round(h.speed / 110));
      for (let i = 0; i < n; i++) {
        _emitPart(
          h.x, h.y,
          h.vx * 0.25 + (Math.random() * 2 - 1) * 120,
          h.vy * 0.25 + (Math.random() * 2 - 1) * 120,
          (_hueBaile + h.speed * 0.04 + Math.random() * 40) % 360,
          0.7 + Math.random() * 0.7,
          4 + Math.random() * 5.5
        );
      }
      if (_beatBaile) {
        // Explosión radial en cada beat
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2;
          _emitPart(h.x, h.y, Math.cos(a) * 330, Math.sin(a) * 330,
            (_hueBaile + i * 8) % 360, 0.8, 5.5);
        }
      }
    }
    _hueBaile = (_hueBaile + 0.8) % 360;
    _stepParts(dt, 240);
  }

  /** Fuego — llamas que suben desde las manos */
  function fxFuego(dt) {
    for (const h of _baileHands) {
      const n = 6 + Math.min(8, Math.round(h.speed / 170));
      for (let i = 0; i < n; i++) {
        _emitPart(
          h.x + (Math.random() * 2 - 1) * 44, h.y,
          h.vx * 0.15 + (Math.random() * 2 - 1) * 70,
          -(150 + Math.random() * 260),
          10 + Math.random() * 40,
          0.6 + Math.random() * 0.55,
          16 + Math.random() * 18
        );
      }
      if (_beatBaile) {
        for (let i = 0; i < 28; i++) {
          _emitPart(h.x + (Math.random() * 2 - 1) * 70, h.y,
            (Math.random() * 2 - 1) * 180, -(300 + Math.random() * 300),
            10 + Math.random() * 45, 1.0, 22);
        }
      }
    }
    _stepParts(dt, -130); // gravedad negativa: el fuego acelera hacia arriba
  }

  function _drawBolt(x1, y1, x2, y2, amp) {
    const SEG = 14;
    const pts = [{ x: x1, y: y1 }];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i < SEG; i++) {
      const t = i / SEG;
      const off = (Math.random() * 2 - 1) * amp * Math.sin(t * Math.PI);
      pts.push({ x: x1 + dx * t + nx * off, y: y1 + dy * t + ny * off });
    }
    pts.push({ x: x2, y: y2 });
    // Glow celeste + núcleo blanco
    for (const [w, estilo] of [[10, 'rgba(120,200,255,0.32)'], [2.6, 'rgba(255,255,255,0.92)']]) {
      ctxPaint.strokeStyle = estilo;
      ctxPaint.lineWidth = w;
      ctxPaint.beginPath();
      ctxPaint.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctxPaint.lineTo(p.x, p.y);
      ctxPaint.stroke();
    }
  }

  /** Rayo — electricidad entre las dos manos (o chispas radiales con una) */
  function fxRayo() {
    ctxPaint.save();
    ctxPaint.globalCompositeOperation = 'lighter';
    ctxPaint.lineCap = 'round';
    const boltN = _pulse > 0.5 ? 3 : 2;
    if (_baileHands.length >= 2) {
      const [a, b] = _baileHands;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const amp = (14 + dist * 0.1) * (1 + _pulse * 0.8);
      for (let i = 0; i < boltN; i++) _drawBolt(a.x, a.y, b.x, b.y, amp);
    } else if (_baileHands.length === 1) {
      const h = _baileHands[0];
      for (let i = 0; i < boltN + 1; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 120 + Math.random() * 180 * (1 + _pulse);
        _drawBolt(h.x, h.y, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, 22);
      }
    }
    ctxPaint.restore();
  }

  /** Ondas — círculos que nacen con cada beat y con movimientos rápidos */
  function fxOndas(dt) {
    if (_beatBaile) {
      for (const h of _baileHands) _ondas.push({ x: h.x, y: h.y, r: 16, v: 560, alpha: 0.9 });
    }
    for (const h of _baileHands) {
      if (h.speed > 850 && Math.random() < 0.35) {
        _ondas.push({ x: h.x, y: h.y, r: 8, v: 340, alpha: 0.6 });
      }
    }
    if (_ondas.length > 40) _ondas.splice(0, _ondas.length - 40);
    dibujarOndas(dt);
    _hueBaile = (_hueBaile + 0.6) % 360;
  }

  /** Dibuja y avanza las ondas vivas (también las del drop, en cualquier efecto) */
  function dibujarOndas(dt) {
    if (!_ondas.length) return;
    ctxPaint.save();
    ctxPaint.globalCompositeOperation = 'lighter';
    _ondas = _ondas.filter(o => o.alpha > 0.02);
    for (const o of _ondas) {
      o.r += o.v * dt;
      o.alpha -= dt * 0.45;
      ctxPaint.strokeStyle = `hsla(${(_hueBaile + o.r * 0.15) % 360}, 90%, 62%, ${Math.max(0, o.alpha).toFixed(3)})`;
      ctxPaint.lineWidth = 5;
      ctxPaint.beginPath();
      ctxPaint.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctxPaint.stroke();
    }
    ctxPaint.restore();
  }

  /** ¿La mano estuvo en una zona dada en los últimos ~0.55 s de estela? */
  function _estuvoEn(h, pred) {
    const t = h.trail;
    for (let i = Math.max(0, t.length - 34); i < t.length; i++) {
      if (pred(t[i])) return true;
    }
    return false;
  }

  // Feedback sutil y localizado: un anillo que se expande ~110px y se va
  function _gestoDisparado(tipo, color, pos) {
    _coolGesto[tipo] = performance.now();
    if (pos) _halos.push({ x: pos.x, y: pos.y, r: 16, rMax: 110, color, alpha: 1 });
  }

  function dibujarHalos(dt) {
    if (!_halos.length) return;
    ctxPaint.save();
    ctxPaint.globalCompositeOperation = 'lighter';
    _halos = _halos.filter(o => o.alpha > 0.03);
    for (const o of _halos) {
      o.r += (o.rMax - o.r) * Math.min(1, dt * 9); // expansión con freno
      o.alpha -= dt * 2.2;                          // se va en ~0.45 s
      ctxPaint.strokeStyle = `rgba(${o.color},${Math.max(0, o.alpha * 0.55).toFixed(3)})`;
      ctxPaint.lineWidth = 1.8;
      ctxPaint.beginPath();
      ctxPaint.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctxPaint.stroke();
    }
    ctxPaint.restore();
  }

  /**
   * Gestos-efecto del baile (estética The Blaze):
   *  · mano IZQ cae arriba→abajo rápido  → drop descendente (flash blanco)
   *  · mano DER sube abajo→arriba rápido → riser ascendente (flash celeste)
   *  · dos manos se SEPARAN de golpe     → stab de acorde (flash violeta)
   *  · dos manos se JUNTAN de golpe      → impacto sub (flash naranja)
   */
  function detectarGestosMusica(dt) {
    const H = canvas.height, W = canvas.width;
    const ahora = performance.now();
    const enCool = (tipo, ms = 900) => ahora - _coolGesto[tipo] < ms;

    // ── Escalerita: las DOS manos suben o bajan juntas. Tiene PRIORIDAD sobre los
    //    gestos de una sola mano (drop/riser/arp/láser) para que no se solapen ──
    let dobleVert = false;
    if (_baileHands.length >= 2) {
      const subenTodas = _baileHands.every(h => h.vy < -800);
      const bajanTodas = _baileHands.every(h => h.vy > 800);
      // Si las dos manos van juntas en vertical SUPRIME los efectos de una sola
      // mano (drop/riser/arp/láser) AUNQUE la escalera esté en cooldown: así al
      // subir o bajar ambas manos suena sólo la escalera, sin sonidos solapados.
      if (subenTodas || bajanTodas) {
        dobleVert = true;
        if (!enCool('escalera')) {
          if (subenTodas && _baileHands.every(h => _estuvoEn(h, p => p.y > H * 0.5))) {
            _coolGesto.escalera = ahora;
            for (const h of _baileHands) _halos.push({ x: h.x, y: h.y, r: 16, rMax: 110, color: '180,140,255', alpha: 1 });
            dispararGesto('ambasSuben');
          } else if (bajanTodas && _baileHands.every(h => _estuvoEn(h, p => p.y < H * 0.5))) {
            _coolGesto.escalera = ahora;
            for (const h of _baileHands) _halos.push({ x: h.x, y: h.y, r: 16, rMax: 110, color: '140,180,255', alpha: 1 });
            dispararGesto('ambasBajan');
          }
        }
      }
    }

    // Mano izquierda cae → drop
    if (!dobleVert && !enCool('drop')) {
      for (const h of _baileHands) {
        if (h.x > W / 2 || h.y < H * 0.6 || h.vy < 900) continue;
        if (!_estuvoEn(h, p => p.y < H * 0.36)) continue;
        _gestoDisparado('drop', '255,255,255', h);
        dispararGesto('izqCae');
        break;
      }
    }

    // Mano derecha sube → riser
    if (!dobleVert && !enCool('riser')) {
      for (const h of _baileHands) {
        if (h.x < W / 2 || h.y > H * 0.4 || h.vy > -900) continue;
        if (!_estuvoEn(h, p => p.y > H * 0.64)) continue;
        _gestoDisparado('riser', '120,210,255', h);
        dispararGesto('derSube');
        break;
      }
    }

    // Mano izquierda sube → arpegio pluck ascendente
    if (!dobleVert && !enCool('arp')) {
      for (const h of _baileHands) {
        if (h.x > W / 2 || h.y > H * 0.4 || h.vy > -900) continue;
        if (!_estuvoEn(h, p => p.y > H * 0.64)) continue;
        _gestoDisparado('arp', '170,255,120', h);
        dispararGesto('izqSube');
        break;
      }
    }

    // Mano derecha cae → láser en picada con eco
    if (!dobleVert && !enCool('laser')) {
      for (const h of _baileHands) {
        if (h.x < W / 2 || h.y < H * 0.6 || h.vy < 900) continue;
        if (!_estuvoEn(h, p => p.y < H * 0.36)) continue;
        _gestoDisparado('laser', '255,80,80', h);
        dispararGesto('derCae');
        break;
      }
    }

    // Si las DOS manos van en horizontal en sentidos opuestos están separándose
    // o juntándose (gesto de dos manos) → SUPRIME los swipes de una sola mano,
    // así separar/juntar suena sólo como stab/impacto, sin sonidos solapados.
    // (Un swipe de una mano, con la otra quieta, NO lo activa: sigue andando.)
    let dobleHoriz = false;
    if (_baileHands.length >= 2) {
      const [a, b] = _baileHands;
      if (Math.abs(a.vx) > 900 && Math.abs(b.vx) > 900 && a.vx * b.vx < 0) dobleHoriz = true;
    }

    // Swipe horizontal de la mano DERECHA → pluck melódico con delay
    if (!dobleHoriz && !enCool('pluck', 700)) {
      for (const h of _baileHands) {
        if (h.x < W / 2) continue;
        if (Math.abs(h.vx) < 1500 || Math.abs(h.vx) < Math.abs(h.vy) * 1.4) continue;
        _gestoDisparado('pluck', '120,255,200', h);
        dispararGesto('swipeDer');
        break;
      }
    }

    // Swipe horizontal de la mano IZQUIERDA → uplifter / sweep (whoosh EDM)
    if (!dobleHoriz && !enCool('sweep', 700)) {
      for (const h of _baileHands) {
        if (h.x > W / 2) continue;
        if (Math.abs(h.vx) < 1500 || Math.abs(h.vx) < Math.abs(h.vy) * 1.4) continue;
        _gestoDisparado('sweep', '255,200,120', h);
        dispararGesto('swipeIzq');
        break;
      }
    }

    // Las dos manos al cielo (sostenidas ~10 frames) → shimmer celestial
    if (_baileHands.length >= 2 && _baileHands.every(h => h.y < H * 0.24)) {
      _cieloFrames++;
      if (_cieloFrames >= 10 && !enCool('cielo', 2500)) {
        _coolGesto.cielo = ahora;
        for (const h of _baileHands) {
          _halos.push({ x: h.x, y: h.y, r: 16, rMax: 110, color: '255,215,120', alpha: 1 });
        }
        dispararGesto('cielo');
      }
    } else {
      _cieloFrames = 0;
    }


    // Dos manos: separarse de golpe → acorde · juntarse de golpe → impacto
    if (_baileHands.length >= 2) {
      const [a, b] = _baileHands;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (_distManosPrev !== null && dt > 0) {
        const vel = (dist - _distManosPrev) / dt; // px/s (+ separa, − junta)
        if (!enCool('stab') && vel > 1400 && dist > W * 0.4) {
          _gestoDisparado('stab', '190,130,255', a);
          _halos.push({ x: b.x, y: b.y, r: 16, rMax: 110, color: '190,130,255', alpha: 1 });
          dispararGesto('separar');
        } else if (!enCool('impact') && vel < -1400 && dist < W * 0.22) {
          _gestoDisparado('impact', '255,130,60', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          dispararGesto('juntar');
        }
      }
      _distManosPrev = dist;
    } else {
      _distManosPrev = null;
    }
  }

  /** Orbe — bola de energía pulsante con arcos orbitando, flotando ante la palma */
  function fxOrbe() {
    const ahora = performance.now() / 1000;
    ctxPaint.save();
    ctxPaint.globalCompositeOperation = 'lighter';
    ctxPaint.lineCap = 'round';
    for (const h of _baileHands) {
      const R = 30 + _pulse * 26 + Math.min(26, h.speed * 0.02);
      // Núcleo incandescente
      const g = ctxPaint.createRadialGradient(h.x, h.y, 0, h.x, h.y, R);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.4, `hsla(${_hueBaile}, 95%, 62%, 0.7)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctxPaint.fillStyle = g;
      ctxPaint.beginPath();
      ctxPaint.arc(h.x, h.y, R, 0, Math.PI * 2);
      ctxPaint.fill();
      // Tres arcos orbitando a distinta velocidad
      for (let k = 0; k < 3; k++) {
        const a0 = ahora * (2.2 + k * 1.1) + k * 2.1;
        ctxPaint.strokeStyle = `hsla(${(_hueBaile + k * 35) % 360}, 95%, 65%, 0.75)`;
        ctxPaint.lineWidth = 3;
        ctxPaint.beginPath();
        ctxPaint.arc(h.x, h.y, R + 10 + k * 11, a0, a0 + Math.PI * 1.25);
        ctxPaint.stroke();
      }
    }
    ctxPaint.restore();
    _hueBaile = (_hueBaile + 0.9) % 360;
  }

  /** Galaxia — estrellas que orbitan en espiral creciente desde las palmas */
  function fxGalaxia(dt) {
    for (const h of _baileHands) {
      if (Math.random() < 0.6) {
        _estrellas.push({
          cx: h.x, cy: h.y,
          ang: Math.random() * Math.PI * 2,
          rad: 12 + Math.random() * 18,
          vel: 1.6 + Math.random() * 2.6,
          hue: (_hueBaile + Math.random() * 70) % 360,
          age: 0, life: 1.7 + Math.random() * 0.8,
        });
      }
    }
    if (_estrellas.length > 240) _estrellas.splice(0, _estrellas.length - 240);
    ctxPaint.save();
    ctxPaint.globalCompositeOperation = 'lighter';
    _estrellas = _estrellas.filter(e => e.age < e.life);
    for (const e of _estrellas) {
      e.age += dt;
      e.ang += e.vel * dt;
      e.rad += 36 * dt; // espiral hacia afuera
      const k = 1 - e.age / e.life;
      const x = e.cx + Math.cos(e.ang) * e.rad;
      const y = e.cy + Math.sin(e.ang) * e.rad * 0.55; // órbita achatada, galáctica
      ctxPaint.fillStyle = `hsla(${e.hue}, 95%, 72%, ${(k * 0.9).toFixed(3)})`;
      ctxPaint.beginPath();
      ctxPaint.arc(x, y, 1.6 + k * 2.4, 0, Math.PI * 2);
      ctxPaint.fill();
    }
    ctxPaint.restore();
    _hueBaile = (_hueBaile + 0.5) % 360;
  }

  function renderBaile(dt) {
    ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    drawBufConPulso(); // si hay un dibujo pintado, queda de fondo latiendo
    switch (efectoActual) {
      case 'quetzal':    fxQuetzal();       break;
      case 'particulas': fxParticulas(dt);  break;
      case 'fuego':      fxFuego(dt);       break;
      case 'rayo':       fxRayo();          break;
      case 'ondas':      fxOndas(dt);       break;
      case 'orbe':       fxOrbe();          break;
      case 'galaxia':    fxGalaxia(dt);     break;
      default:           fxEstela(dt);
    }
    // Las ondas restantes (del efecto ondas) y los halos de gestos
    if (efectoActual !== 'ondas') dibujarOndas(dt);
    dibujarHalos(dt);
    _beatBaile = false; // flanco consumido
  }

  // Loop principal
  let _lastFrameTime = 0;
  let _vizStep = -1;
  function loop(timestamp) {
    const dt = _lastFrameTime ? Math.min((timestamp - _lastFrameTime) / 1000, 0.05) : 0.016;
    _lastFrameTime = timestamp;
    try {
    const manos = detectarManos(video);

    if (modoPintar) {
      // ── Modo pintar ────────────────────────────────────────────────────────
      const puños   = manos.filter(m => esPuno(m));
      const noPuños = manos.filter(m => !esPuno(m));

      if (puños.length >= 2) {
        // ── Dos puños → borrar ────────────────────────────────────────────
        colorSeleccion = null; ultimoPtoBuf = null; ultimoGesture = null;
        const borrarInfo = aplicarBorrador(puños);
        renderFrame(ctx, video, canvas, [], null, null);
        renderPaintCanvas(manos, null, null, borrarInfo);

      } else {
        _borrando = false; // fin de la sesión de borrado
        // ── Comprobar selección de color SÓLO si hay dedo claro ───────────
        // (un puño + EXACTAMENTE un dedo reconocido en la otra mano)
        let dedoIdxSel = null;
        let selectorMano = null;
        if (puños.length === 1 && noPuños.length >= 1) {
          const d = detectarDedoColor(noPuños[0]);
          if (d !== null) { dedoIdxSel = d; selectorMano = noPuños[0]; }
        }

        if (dedoIdxSel !== null) {
          // ── Selección de color ───────────────────────────────────────────
          ultimoPtoBuf = null; ultimoGesture = null;
          const tip = dedoIdxSel < 4 ? FINGER_TIPS[dedoIdxSel] : 4;
          const sx = (1 - selectorMano[tip].x) * canvas.width;
          const sy = selectorMano[tip].y * canvas.height;
          if (colorSeleccion && colorSeleccion.idx === dedoIdxSel) {
            const elapsed = Date.now() - colorSeleccion.inicio;
            if (elapsed >= MS_SELECCION) {
              colorIdx = colorSeleccion.pal;
              colorBtns.forEach((b, j) => b.classList.toggle('activo', j === colorIdx));
              colorSeleccion = null;
            } else {
              colorSeleccion.sx = sx; colorSeleccion.sy = sy;
            }
          } else {
            colorSeleccion = { idx: dedoIdxSel, pal: DEDO_A_COLOR[dedoIdxSel], inicio: Date.now(), sx, sy };
          }
          renderFrame(ctx, video, canvas, [], null, null);
          renderPaintCanvas(manos, null, colorSeleccion, null);

        } else {
          // ── Dibujo normal (aunque haya un puño, no interfiere) ───────────
          colorSeleccion = null;
          let gestureMano = null;
          for (const m of manos) {
            const g = detectarGesturePintura(m);
            if (g) { gestureMano = { mano: m, gesture: g }; break; }
          }
          if (gestureMano) {
            aplicarTrazo(gestureMano.mano, gestureMano.gesture);
          } else {
            ultimoPtoBuf = null; ultimoGesture = null;
          }
          renderFrame(ctx, video, canvas, [], null, null);
          renderPaintCanvas(manos, gestureMano, null, null);
        }
      }
    } else if (modoBaile) {
      // ── Modo baile: las manos generan efectos, no controlan la música ──────
      trackBaileHands(manos, dt);
      detectarGestosMusica(dt);
      renderFrame(ctx, video, canvas, [], null, null);
      renderBaile(dt);
    } else {
      // ── Modo normal ────────────────────────────────────────────────────────
      const { ancho, centroY, area, puntos, forma, dosPinzas, subtipoAcid } = calcularGestos(manos);

      // Dos pinzas → bloquea
      if (dosPinzas) {
        victoriaCount = 0; victoriaActivo = false;
        dosPinzasCount++;
        if (dosPinzasCount >= FRAMES_DOS_PINZAS && !dosPinzasActivo) {
          dosPinzasActivo = true;
          if (!locked) setLocked(true);
        }
      } else {
        dosPinzasCount = 0;
        dosPinzasActivo = false;
      }

      // Victoria → desbloquea
      if (!dosPinzas && detectarVictoria(manos)) {
        victoriaCount++;
        if (victoriaCount >= FRAMES_VICTORIA && !victoriaActivo) {
          victoriaActivo = true;
          if (locked) setLocked(false);
        }
      } else {
        victoriaCount = 0;
        victoriaActivo = false;
      }

      // Con lock global (dos pinzas) o ambos candados puestos, NADA de los
      // gestos puede alterar cómo suena el ritmo de fondo (filtro, wow, tecno)
      const bloqueoTotal = locked || (tempoLocked && filtroLocked);

      // Cuadrilátero → filtro (altura) / área / nota  [BPM solo por slider]
      if (ancho !== null) {
        if (formaConfirmada === 'dos_triangulos' && !bloqueoTotal) {
          actualizarWow(centroY, ancho, subtipoAcid);
        } else if (!filtroLocked && !locked) {
          // Manos arriba (centroY bajo) = agudos, manos abajo (centroY alto) = graves.
          // Con candado (manual o dos pinzas) el filtro queda congelado — se
          // pueden hacer notas sin mover los graves.
          const tFiltro = Math.max(0, Math.min(1, mapear(centroY, 0.75, 0.15, 0, 1)));
          actualizarFiltro(tFiltro);
          _filtroT = tFiltro;
          actualizarSliderFiltro(tFiltro);
        }

        if (state.audioIniciado) {
          areaHold = AREA_HOLD_MAX;
          actualizarArea(area);

          if (forma === formaCandidato) {
            framesCandidato++;
            if (framesCandidato >= FRAMES_FORMA && forma !== formaConfirmada) {
              formaConfirmada = forma;
              actualizarNota(forma);
            }
          } else {
            formaCandidato  = forma;
            framesCandidato = 1;
          }
        }
      } else if (state.audioIniciado) {
        if (areaHold > 0) { areaHold--; }
        else { actualizarArea(0); }
        formaCandidato  = null;
        framesCandidato = 0;
      }

      // Gesto dos dedos pegados → control relativo de tempo o filtro (según slider)
      if (!_mouseDrag && !_mouseDragFiltro) {
        const mano2 = manos.find(m => dosDeadosPegados(m));
        if (mano2) {
          const sy = ((mano2[8].y + mano2[12].y) / 2) * window.innerHeight;
          if (!_gestureDrag) {
            // Enganchar según sobre qué slider estén los dedos (si no hay candado)
            if (!locked && !tempoLocked && dedosSobreSlider(mano2, 'tempo-slider-wrap')) {
              _gestureDrag = { tipo: 'bpm', startY: sy, startVal: _bpmTarget };
            } else if (!locked && !filtroLocked && dedosSobreSlider(mano2, 'filtro-slider-wrap')) {
              _gestureDrag = { tipo: 'filtro', startY: sy, startVal: _filtroT };
            }
          }
          if (_gestureDrag) {
            // Tracking delta — funciona aunque los dedos se muevan fuera del área
            const delta = _gestureDrag.startY - sy; // arriba = positivo
            if (_gestureDrag.tipo === 'bpm') {
              const bpm = Math.max(80, Math.min(180, _gestureDrag.startVal + delta * 0.7));
              if (!locked && !tempoLocked) actualizarBPM(bpm);
              _bpmTarget = bpm;
              actualizarSlider(_bpmTarget);
            } else {
              _filtroT = Math.max(0, Math.min(1, _gestureDrag.startVal + delta / 150));
              actualizarFiltro(_filtroT);
              actualizarSliderFiltro(_filtroT);
            }
          }
        } else {
          _gestureDrag = null; // dedos sueltos → soltar el enganche
        }
        sliderThumb.style.background = (_gestureDrag && _gestureDrag.tipo === 'bpm')
          ? 'rgba(255,255,255,0.95)'
          : 'rgba(255,255,255,0.55)';
        filtroThumb.style.background = (_gestureDrag && _gestureDrag.tipo === 'filtro')
          ? 'rgba(255,255,255,0.95)'
          : 'rgba(255,255,255,0.55)';
      }

      // Cambio de modo normal ↔ techno/acid — bloqueado con candados puestos
      if (state.audioIniciado) {
        const tecno = formaConfirmada === 'dos_triangulos' && !bloqueoTotal;
        if (tecno !== enModoTecno) {
          setModoTecno(tecno);
          if (!tecno) resetNotaAcid();
          enModoTecno = tecno;
        }
      }

      // ── Shaka (ambas manos) → botón Vínculos ────────────────────────────
      if (manos.length >= 2 && manos.every(m => gestoSurfista(m))) {
        shakaCount++;
        if (shakaCount >= FRAMES_SHAKA && !shakaActivo) {
          shakaActivo = true;
          btnVinculos.classList.add('visible');
        }
      } else {
        shakaCount = 0;
        shakaActivo = false;
      }

      renderFrame(ctx, video, canvas, manos, puntos, formaConfirmada);
      // Limpiar paint canvas en modo normal
      ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    }

    // ── Satélites (activos cuando Vínculos está abierto) ──────────────────
    if (vinculosVisible) {
      const W      = vinculosCanvas.width  || window.innerWidth;
      const H      = vinculosCanvas.height || window.innerHeight;
      const nowMs  = performance.now();

      // Todas las manos con índice apuntando (solo índice extendido, sin restricción de otros dedos)
      const pointing = manos
        .filter(m => indiceApunta(m))
        .map(m => ({ nx: 1 - m[8].x, ny: m[8].y }));

      const newPointers = [];
      for (const p of pointing) {
        // Buscar coincidencia en el frame anterior (por proximidad espacial)
        let prev = null, bestD = 0.25;
        for (const pp of _prevPointers) {
          const d = Math.hypot(p.nx - pp.x, p.ny - pp.y);
          if (d < bestD) { bestD = d; prev = pp; }
        }

        // speeds empieza vacío (no [0]) — evita falso lanzamiento en el 2.º frame
        let speeds = prev ? [...prev.speeds] : [];
        if (prev && dt > 0.005) {
          const vxPx  = ((p.nx - prev.x) / dt) * W;
          const vyPx  = ((p.ny - prev.y) / dt) * H;
          const speed = Math.hypot(vxPx, vyPx);
          speeds = [...speeds, speed].slice(-5); // ventana de 5 frames (~83 ms a 60fps)

          // Lanzar cuando hay un flick claro: speed actual >> promedio de los frames anteriores
          // Necesita al menos 3 frames previos para tener un "estado base" fiable
          const prevSpeeds = speeds.slice(0, -1);
          if (prevSpeeds.length >= 3) {
            const avg = prevSpeeds.reduce((a, b) => a + b) / prevSpeeds.length;
            if (speed > avg * SAT_JERK_RATIO && speed > SAT_MIN_SPEED && nowMs - _lastSatTime > SAT_COOLDOWN) {
              // Lanzar en la dirección exacta del movimiento del dedo en este frame
              launchSatellite(p.nx, p.ny, vxPx, vyPx);
              _lastSatTime = nowMs;
              speeds = []; // reset — requiere acumular estado de nuevo antes del próximo tiro
            }
          }
        }
        newPointers.push({ x: p.nx, y: p.ny, speeds });
      }
      _prevPointers = newPointers;

      // updateSatellites limpia el canvas primero → las estrellas del dedo van DESPUÉS
      updateSatellites(dt);

      // Dibujar estrellas siguiendo cada índice (encima de todo lo demás)
      const tw = 0.80 + 0.20 * Math.sin(nowMs / 180);
      for (const fp of newPointers) {
        drawVStar(fp.x, fp.y, -1, [195, 220, 255], tw * 0.9);
      }
    }

    // ── Pulso del beat (pintura viva + baile) — dispara en cada negra ───────
    if (state.step !== _lastStepPulse) {
      _lastStepPulse = state.step;
      if (state.step >= 0 && state.step % 4 === 0) { _pulse = 1; _beatBaile = true; }
    }
    if (_pulse > 0) _pulse = Math.max(0, _pulse - dt * 4); // decae en ~0.25 s

    // ── Indicador de paso actual en el viz de ritmo ─────────────────────────
    if (ritmoViz.style.display === 'block' && _vizStep !== state.step) {
      _vizStep = state.step;
      ritmoViz.querySelectorAll('.viz-cell').forEach(c => {
        c.classList.toggle('now', +c.dataset.step === _vizStep);
      });
    }

    } catch (err) {
      // Un frame que falla (p. ej. colisión de timing en Tone.js) NO debe matar
      // el loop: se ignora ese frame y se sigue, así la app nunca se congela.
      console.error('[Repique Code] frame ignorado:', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ── Controles de audio ────────────────────────────────────────────────────────
  btnStart.addEventListener('click', async () => {
    resumeContextSync();
    btnStart.disabled = true;
    btnStart.textContent = 'Cargando…';
    status.textContent = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'Iniciando audio…' : 'Cargando samples…';
    try {
      await startAudio();
      status.textContent = '';
      btnStart.textContent = 'Sonando';
      btnStart.classList.add('activo');
      btnStop.disabled = false;
    } catch (err) {
      status.textContent = err.message || 'Error de audio';
      btnStart.textContent = 'Reintentar';
      btnStart.disabled = false;
      console.error('[Repique Code] Audio:', err);
    }
  });

  btnStop.addEventListener('click', () => {
    stopAudio();
    resetTracks();
    btnStop.disabled = true;
    btnStart.textContent = 'Arrancar';
    btnStart.classList.remove('activo');
    btnStart.disabled = false;
    // También apaga el modo pintar y el modo baile
    if (modoPintar) {
      modoPintar = false;
      btnPaint.classList.remove('activo');
      paleta.classList.remove('visible');
      ultimoPtoBuf  = null;
      ultimoGesture = null;
      colorSeleccion = null;
      ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    }
    if (modoBaile) {
      apagarBaile();
      ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    }
  });

  volInput.addEventListener('input', () => setVolumen(parseFloat(volInput.value)));

  // ── Controles de pintura ──────────────────────────────────────────────────────
  const btnBaile     = document.getElementById('btn-baile');
  const paletaBaile  = document.getElementById('paleta-baile');

  function apagarBaile() {
    modoBaile = false;
    btnBaile.classList.remove('activo');
    paletaBaile.classList.remove('visible');
    // Un loop ya sonando SIGUE aunque salgas del baile (a dibujar, etc.); solo
    // se corta con el botón verde. Si estaba armando/grabando, se cancela.
    if (getLooperEstado() !== 'loop') pararLooper();
    _baileHands = [];
    _parts      = [];
    _ondas      = [];
    _estrellas  = [];
    _halos      = [];
  }

  // Refleja el estado del looper en el botón (hoisteada: la usan varios handlers)
  function pintarLoop(e) {
    const b = document.getElementById('btn-loop');
    if (!b) return;
    b.classList.remove('armado', 'rec', 'loop');
    if (e === 'armado')   { b.classList.add('armado'); b.textContent = '● espera'; }
    else if (e === 'rec') { b.classList.add('rec');    b.textContent = '● rec'; }
    else if (e === 'loop'){ b.classList.add('loop');   b.textContent = '■ loop'; }
    else                  { b.textContent = '🔁 loop'; }
  }

  btnPaint.addEventListener('click', () => {
    modoPintar = !modoPintar;
    if (modoPintar && modoBaile) apagarBaile();
    btnPaint.classList.toggle('activo', modoPintar);
    paleta.classList.toggle('visible', modoPintar);
    if (!modoPintar) {
      ultimoPtoBuf = null;
      zoomActivo   = false;
      _borrando    = false;
      ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    }
  });

  // ── Modo baile ────────────────────────────────────────────────────────────────
  btnBaile.addEventListener('click', () => {
    if (modoBaile) {
      apagarBaile();
      ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
      return;
    }
    if (modoPintar) {
      modoPintar = false;
      btnPaint.classList.remove('activo');
      paleta.classList.remove('visible');
      ultimoPtoBuf = null; ultimoGesture = null; colorSeleccion = null; _borrando = false;
    }
    modoBaile = true;
    btnBaile.classList.add('activo');
    paletaBaile.classList.add('visible');
    pintarLoop(getLooperEstado()); // si un loop quedó sonando, el botón verde lo refleja
  });

  const efectoBtns = document.querySelectorAll('.efecto-btn');
  efectoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      efectoActual = btn.dataset.efecto;
      efectoBtns.forEach(b => b.classList.toggle('activo', b === btn));
      _parts = []; _ondas = []; _estrellas = []; // no mezclar partículas de efectos distintos
    });
  });

  // ── Looper de efectos: graba 2 compases de efectos y los deja en loop ─────────
  const btnLoop = document.getElementById('btn-loop');
  if (btnLoop) {
    btnLoop.addEventListener('click', () => {
      if (getLooperEstado() === 'idle') armarLooper();
      else pararLooper();
    });
    onLooperEstado(pintarLoop);
  }

  // ── Configurador: elegí qué sonido dispara cada gesto del baile ───────────────
  const LS_SONIDOS = 'repique_baile_sonidos';
  (function cargarAsignacionesGuardadas() {
    try {
      const raw = localStorage.getItem(LS_SONIDOS);
      if (!raw) return;
      const obj = JSON.parse(raw);
      Object.entries(obj).forEach(([slot, id]) => setAsignacion(slot, id));
    } catch (_) { /* sin persistencia, se usan los defaults */ }
  })();
  function guardarAsignaciones() {
    try { localStorage.setItem(LS_SONIDOS, JSON.stringify(getAsignaciones())); } catch (_) {}
  }
  // Familia de registro (normal / grave / aguda) — transpone todas las notas
  const LS_FAMILIA = 'repique_baile_familia';
  (function cargarFamilia() {
    try {
      const v = parseInt(localStorage.getItem(LS_FAMILIA) ?? '0', 10);
      if (!Number.isNaN(v)) setFamilia(v);
    } catch (_) {}
  })();
  function pintarFamilia() {
    const actual = getFamilia();
    document.querySelectorAll('.fam-btn').forEach(b => {
      b.classList.toggle('activo', parseInt(b.dataset.fam, 10) === actual);
    });
  }
  document.querySelectorAll('.fam-btn').forEach(b => {
    b.addEventListener('click', () => {
      const semis = parseInt(b.dataset.fam, 10) || 0;
      setFamilia(semis);
      try { localStorage.setItem(LS_FAMILIA, String(semis)); } catch (_) {}
      pintarFamilia();
      previewSonido('chord'); // escuchá el acorde en la familia elegida
    });
  });
  pintarFamilia();
  function construirConfigSonidos() {
    const cont = document.getElementById('config-sonidos-rows');
    if (!cont) return;
    const asig = getAsignaciones();
    cont.innerHTML = '';
    GESTOS_BAILE.forEach(g => {
      const row = document.createElement('div');
      row.className = 'cfg-row';
      const label = document.createElement('span');
      label.className = 'cfg-gesto';
      label.textContent = g.nombre;
      const sel = document.createElement('select');
      sel.className = 'cfg-select';
      BIBLIOTECA.forEach(s => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = `${s.emoji} ${s.nombre}`;
        if (s.id === asig[g.slot]) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => {
        setAsignacion(g.slot, sel.value);
        guardarAsignaciones();
        previewSonido(sel.value); // escuchá lo que acabás de elegir
      });
      const prev = document.createElement('button');
      prev.className = 'cfg-prev tool-btn';
      prev.textContent = '▶';
      prev.title = 'Escuchar';
      prev.addEventListener('click', () => previewSonido(sel.value));
      row.append(label, sel, prev);
      cont.appendChild(row);
    });
  }
  const btnSonidos   = document.getElementById('btn-sonidos');
  const panelSonidos = document.getElementById('config-sonidos');
  if (btnSonidos && panelSonidos) {
    btnSonidos.addEventListener('click', () => {
      const vis = panelSonidos.classList.toggle('visible');
      btnSonidos.classList.toggle('activo', vis);
      if (vis) construirConfigSonidos();
    });
    document.getElementById('config-sonidos-cerrar')?.addEventListener('click', () => {
      panelSonidos.classList.remove('visible');
      btnSonidos.classList.remove('activo');
    });
  }

  colorBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      colorIdx = i;
      colorBtns.forEach((b, j) => b.classList.toggle('activo', j === i));
    });
  });
  // Activar color rojo por defecto
  colorBtns[0]?.classList.add('activo');

  btnLimpiar.addEventListener('click', () => {
    guardarSnapshot(); // deshacer recupera el dibujo limpiado
    bufCtx.clearRect(0, 0, bufCanvas.width, bufCanvas.height);
    ultimoPtoBuf  = null;
    ultimoGesture = null;
    ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
  });

  // ── Herramientas de pintura: estilo, tamaño, espejo, deshacer ────────────────
  const estiloBtns  = document.querySelectorAll('.estilo-btn');
  const tamBtns     = document.querySelectorAll('.tam-btn');
  const btnEspejo   = document.getElementById('btn-espejo');
  const btnDeshacer = document.getElementById('btn-deshacer');

  estiloBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      estiloActual = btn.dataset.estilo;
      estiloBtns.forEach(b => b.classList.toggle('activo', b === btn));
    });
  });

  tamBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tamIdx = parseInt(btn.dataset.tam, 10);
      tamBtns.forEach(b => b.classList.toggle('activo', b === btn));
    });
  });

  const ESPEJO_LABELS = ['espejo: no', 'espejo ×2', 'mandala ×6'];
  btnEspejo.addEventListener('click', () => {
    espejoModo = (espejoModo + 1) % 3;
    btnEspejo.textContent = ESPEJO_LABELS[espejoModo];
    btnEspejo.classList.toggle('activo', espejoModo > 0);
  });

  btnDeshacer.addEventListener('click', () => {
    const prev = _snapshots.pop();
    if (!prev) return;
    bufCtx.clearRect(0, 0, bufCanvas.width, bufCanvas.height);
    bufCtx.drawImage(prev, 0, 0);
    ultimoPtoBuf  = null;
    ultimoGesture = null;
  });

  // ── Guardar el dibujo como PNG (fondo negro + trazos) ────────────────────────
  const btnGuardar = document.getElementById('btn-guardar');
  btnGuardar.addEventListener('click', () => {
    const W = canvas.width, H = canvas.height;
    const out  = document.createElement('canvas');
    out.width  = W;
    out.height = H;
    const octx = out.getContext('2d');
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, W, H);
    // Fondo: la escena de la cámara espejada en gris (como en pantalla, pero a
    // plena vista) para que la imagen quede completa, no solo los trazos
    try {
      octx.save();
      octx.scale(-1, 1);
      octx.translate(-W, 0);
      octx.filter = 'grayscale(1)';
      octx.drawImage(video, 0, 0, W, H);
      octx.restore();
      octx.filter = 'none';
    } catch (_) { /* sin cámara: queda el fondo negro */ }
    // El dibujo completo encima
    octx.drawImage(bufCanvas, 0, 0);
    const a = document.createElement('a');
    a.download = 'repique-code-pintura.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });

  // ── Slider lineal de tempo ────────────────────────────────────────────────────
  const sliderTrack = document.getElementById('tempo-slider-track');
  const sliderFill  = document.getElementById('tempo-slider-fill');
  const sliderThumb = document.getElementById('tempo-slider-thumb');
  const tempoBpmLabel = document.getElementById('tempo-bpm-label');
  const TRACK_H = 150; // px, debe coincidir con CSS

  function actualizarSlider(bpm) {
    const t = (bpm - 80) / 100;
    const fillH = t * TRACK_H;
    const thumbTop = (1 - t) * TRACK_H - 2; // centrar el thumb
    sliderFill.style.height = fillH + 'px';
    sliderThumb.style.top   = thumbTop + 'px';
    tempoBpmLabel.textContent = Math.round(bpm);
  }

  // ── Slider de filtro (graves/agudos) ─────────────────────────────────────────
  const filtroTrack = document.getElementById('filtro-slider-track');
  const filtroFill  = document.getElementById('filtro-slider-fill');
  const filtroThumb = document.getElementById('filtro-slider-thumb');
  const filtroLabel = document.getElementById('filtro-label');

  function actualizarSliderFiltro(t) {
    filtroFill.style.height = t * TRACK_H + 'px';
    filtroThumb.style.top   = (1 - t) * TRACK_H - 2 + 'px';
    filtroLabel.textContent = t > 0.66 ? 'agudos' : t > 0.33 ? 'medios' : 'graves';
  }

  // Mouse drag — el mouse siempre funciona, los candados solo bloquean gestos
  let _mouseDrag = null;
  let _mouseDragFiltro = null;
  sliderTrack.addEventListener('mousedown', (e) => {
    _mouseDrag = { startY: e.clientY, startBPM: _bpmTarget };
    e.preventDefault();
  });
  filtroTrack.addEventListener('mousedown', (e) => {
    _mouseDragFiltro = { startY: e.clientY, startT: _filtroT };
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (_mouseDrag) {
      const delta = _mouseDrag.startY - e.clientY;
      _bpmTarget = Math.max(80, Math.min(180, _mouseDrag.startBPM + delta * 0.8));
      actualizarBPM(_bpmTarget);
      actualizarSlider(_bpmTarget);
    }
    if (_mouseDragFiltro) {
      const delta = _mouseDragFiltro.startY - e.clientY;
      _filtroT = Math.max(0, Math.min(1, _mouseDragFiltro.startT + delta / TRACK_H));
      actualizarFiltro(_filtroT);
      actualizarSliderFiltro(_filtroT);
    }
  });
  document.addEventListener('mouseup', () => { _mouseDrag = null; _mouseDragFiltro = null; });

  // ── Candados de los sliders (bloquean los gestos, no el mouse) ───────────────
  const tempoLockBtn  = document.getElementById('tempo-lock');
  const filtroLockBtn = document.getElementById('filtro-lock');
  tempoLockBtn.addEventListener('click', () => {
    tempoLocked = !tempoLocked;
    tempoLockBtn.textContent = tempoLocked ? '🔒' : '🔓';
    tempoLockBtn.classList.toggle('locked', tempoLocked);
  });
  filtroLockBtn.addEventListener('click', () => {
    filtroLocked = !filtroLocked;
    filtroLockBtn.textContent = filtroLocked ? '🔒' : '🔓';
    filtroLockBtn.classList.toggle('locked', filtroLocked);
  });

  actualizarSlider(_bpmTarget);
  actualizarSliderFiltro(_filtroT);

  // ── Selector de ritmo ────────────────────────────────────────────────────────
  const ritmoViz      = document.getElementById('ritmo-viz');
  const vizTitulo     = document.getElementById('ritmo-viz-titulo');
  const ritmoNombreEl = document.getElementById('ritmo-nombre');
  let ritmoActivoIdx  = 5; // CANDOMByte por defecto

  const VIZ_TRACKS = [
    { key: 'chico',   label: '🪘 chico',   color: 'rgba(255,255,255,0.82)' },
    { key: 'repique', label: '🥁 repique', color: '#e63946' },
    { key: 'piano',   label: '🛢 piano',   color: '#e67e22' },
    { key: 'madera',  label: '🥢 madera',  color: '#1abc9c' },
    { key: 'bombo',   label: '💥 bombo',   color: '#4a90e2' },
  ];

  let _vizRect   = null;  // rect del botón que abrió el viz (para re-render)
  let _vizIdx    = null;  // qué ritmo muestra el viz
  let _vizOpener = null;  // quién abrió el viz: índice de ritmo o 'rit' (♩)

  function ocultarViz() {
    ritmoViz.style.display = '';
    _vizOpener = null;
  }

  // Aplica una edición de patrón en tiempo real: re-arma las secuencias
  // (Tone.Sequence NO relee el array mutado) y activa ese ritmo para escucharlo
  function aplicarEdicion(idx) {
    cambiarRitmo(idx);
    ritmoActivoIdx = idx;
    ritmoNombreEl.textContent = ritmoBtns[idx].textContent;
    ritmoBtns.forEach((b, j) => b.classList.toggle('activo', j === idx));
    mostrarViz(idx, _vizRect);
  }

  function mostrarViz(idx, btnRect) {
    const patron   = BANCO_PATRONES[idx];
    const editable = idx !== CANDOMBE_REAL_IDX; // el loop grabado no se edita
    _vizIdx  = idx;
    _vizRect = btnRect;
    vizTitulo.textContent = ritmoBtns[idx].textContent;
    while (ritmoViz.children.length > 1) ritmoViz.removeChild(ritmoViz.lastChild);
    ritmoViz.classList.toggle('editable', editable);

    VIZ_TRACKS.forEach(track => {
      const fila = document.createElement('div');
      fila.className = 'viz-track';

      const label = document.createElement('span');
      label.className = 'viz-label';
      label.textContent = track.label;
      fila.appendChild(label);

      const celdas = document.createElement('div');
      celdas.className = 'viz-cells';

      patron[track.key].forEach((hit, paso) => {
        if (paso > 0 && paso % 4 === 0) {
          const gap = document.createElement('div');
          gap.className = 'viz-gap';
          celdas.appendChild(gap);
        }
        const celda = document.createElement('div');
        celda.className = 'viz-cell' + (hit ? ' hit' : '');
        celda.dataset.step = paso;
        if (hit) celda.style.background = track.color;

        if (editable) {
          celda.addEventListener('click', (e) => {
            e.stopPropagation();
            BANCO_PATRONES[idx][track.key][paso] = hit ? null : 1;
            // En tiempo real: re-arma las secuencias y suena en la próxima pasada
            aplicarEdicion(idx);
          });
        }

        celdas.appendChild(celda);
      });

      fila.appendChild(celdas);
      ritmoViz.appendChild(fila);
    });

    if (editable) {
      const footer = document.createElement('div');
      footer.id = 'viz-footer';

      const hint = document.createElement('span');
      hint.id = 'viz-edit-hint';
      hint.textContent = 'clic para editar · en tiempo real';

      const btns = document.createElement('div');
      btns.id = 'viz-footer-btns';

      const btnReset = document.createElement('button');
      btnReset.id = 'viz-reset-btn';
      btnReset.textContent = '↺ limpiar';
      btnReset.addEventListener('click', (e) => {
        e.stopPropagation();
        ['piano', 'repique', 'chico', 'madera', 'bombo'].forEach(key => {
          BANCO_PATRONES[idx][key].fill(null);
        });
        aplicarEdicion(idx);
      });

      btns.appendChild(btnReset);
      footer.appendChild(hint);
      footer.appendChild(btns);
      ritmoViz.appendChild(footer);
    }

    // Posición inteligente: derecha del botón, ajustada para no salirse de pantalla
    ritmoViz.style.visibility = 'hidden';
    ritmoViz.style.display = 'block';
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const vw2 = ritmoViz.offsetWidth;
    const vh2 = ritmoViz.offsetHeight;
    const left = (btnRect.right + 10 + vw2 < vw) ? btnRect.right + 10 : btnRect.left - vw2 - 10;
    const top  = Math.min(Math.max(8, btnRect.top - 4), vh - vh2 - 8);
    ritmoViz.style.left       = left + 'px';
    ritmoViz.style.top        = top + 'px';
    ritmoViz.style.bottom     = 'auto';
    ritmoViz.style.visibility = '';
  }

  // El viz NUNCA se cierra solo (ni mouseleave ni clic afuera) — solo lo cierra
  // un nuevo clic en el mismo botón que lo abrió, o el ♩.

  // ♩ hover → abre viz del ritmo activo (solo si no hay otro viz abierto)
  btnRitmo.addEventListener('mouseenter', () => {
    if (ritmoViz.style.display === 'block') return;
    mostrarViz(ritmoActivoIdx, btnRitmo.getBoundingClientRect());
    _vizOpener = 'rit';
  });

  // ♩ click → si el viz está abierto: lo cierra; si está cerrado: abre el menú de ritmos
  btnRitmo.addEventListener('click', (e) => {
    e.stopPropagation();
    if (ritmoViz.style.display === 'block') {
      ocultarViz();
      menuRitmo.classList.remove('visible');
    } else {
      menuRitmo.classList.toggle('visible');
    }
  });

  ritmoBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      cambiarRitmo(i);
      ritmoActivoIdx = i;
      ritmoNombreEl.textContent = btn.textContent;
      ritmoBtns.forEach((b, j) => b.classList.toggle('activo', j === i));
      // Toggle: el mismo botón que abrió el viz lo cierra; otro botón lo muestra.
      // El menú queda abierto para poder re-clickear el mismo botón.
      if (ritmoViz.style.display === 'block' && _vizOpener === i) {
        ocultarViz();
      } else {
        mostrarViz(i, btn.getBoundingClientRect());
        _vizOpener = i;
      }
    });
    btn.addEventListener('mouseenter', () => {
      // Hover solo abre si no hay un viz ya abierto — no pisa al editor
      if (ritmoViz.style.display === 'block') return;
      mostrarViz(i, btn.getBoundingClientRect());
      _vizOpener = i;
    });
  });

  // ── Guía desplegable ──────────────────────────────────────────────────────────
  const btnGuia       = document.getElementById('btn-guia');
  const guia          = document.getElementById('guia');
  const guiaDetalle   = document.getElementById('guia-detalle');
  const btnGuiaDetalle   = document.getElementById('btn-guia-detalle');
  const btnCerrarDetalle = document.getElementById('btn-cerrar-detalle');

  btnGuia.addEventListener('click', () => guia.classList.toggle('visible'));

  btnGuiaDetalle.addEventListener('click', (e) => {
    e.stopPropagation();
    guia.classList.remove('visible');
    guiaDetalle.classList.add('visible');
  });
  btnCerrarDetalle.addEventListener('click', () => guiaDetalle.classList.remove('visible'));
  guiaDetalle.addEventListener('click', (e) => {
    if (e.target === guiaDetalle) guiaDetalle.classList.remove('visible');
  });

  document.addEventListener('click', (e) => {
    if (!guia.contains(e.target) && e.target !== btnGuia) guia.classList.remove('visible');
    // El clic afuera cierra solo el menú — el viz queda hasta que lo cierre su botón
    if (!menuRitmo.contains(e.target) && e.target !== btnRitmo && !ritmoViz.contains(e.target)) {
      menuRitmo.classList.remove('visible');
    }
  });

  // ── Vínculos ──────────────────────────────────────────────────────────────
  const btnVinculos       = document.getElementById('btn-vinculos');
  const vinculosOverlay   = document.getElementById('vinculos-overlay');
  const vinculosIframe    = document.getElementById('vinculos-iframe');
  const btnCerrarVinculos = document.getElementById('btn-cerrar-vinculos');

  btnVinculos.addEventListener('click', () => {
    vinculosIframe.src = '/vinculos/';
    vinculosOverlay.classList.add('visible');
    vinculosVisible = true;
    btnVinculos.classList.remove('visible');
    shakaCount  = 0;
    shakaActivo = false;
  });

  btnCerrarVinculos.addEventListener('click', () => {
    vinculosOverlay.classList.remove('visible');
    vinculosVisible    = false;
    vinculosIframe.src = '';
    _satellites   = [];
    _prevPointers = [];
    vinculosCtx.clearRect(0, 0, vinculosCanvas.width, vinculosCanvas.height);
  });
}

function mapear(valor, inMin, inMax, outMin, outMax) {
  return outMin + ((valor - inMin) / (inMax - inMin)) * (outMax - outMin);
}

init();
