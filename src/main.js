/**
 * main.js — Bootstrap de Repique Code
 */

import { initHands, detectarManos, calcularGestos, detectarVictoria } from './hands.js';
import { renderFrame } from './render.js';
import { startAudio, stopAudio, setVolumen, actualizarBPM, actualizarFiltro, actualizarArea, actualizarNota, resetTracks, setModoTecno, actualizarWow, resetNotaAcid, resumeContextSync, cambiarRitmo, BANCO_PATRONES } from './audio.js';
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

  // ── Slider de tempo ──────────────────────────────────────────────────────────
  let _bpmTarget   = 120;
  let _gestureDrag = null; // { startY, startBPM } — enganche por gesto dos dedos

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
  const COLORES_PINCEL = ['#e63946','#4a90e2','#27ae60','#f4d03f','#ff6b35','#a855f7'];
  const COLORES_BROCHA = [
    'rgba(230,57,70,0.22)',
    'rgba(74,144,226,0.22)',
    'rgba(39,174,96,0.22)',
    'rgba(244,208,63,0.22)',
    'rgba(255,107,53,0.22)',
    'rgba(168,85,247,0.22)',
  ];
  // Índices landmark de las puntas y articulaciones PIP de los 4 dedos
  const FINGER_TIPS = [8, 12, 16, 20]; // índice, medio, anular, meñique
  const FINGER_PIPS = [6, 10, 14, 18];
  let modoPintar     = false;
  let colorIdx       = 0;
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

  /** Verifica que los dedos proyectados estén encima del área del slider en pantalla */
  function dedosSobreSlider(mano) {
    const rect = document.getElementById('tempo-slider-wrap').getBoundingClientRect();
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
    if (!ultimoPtoBuf) { ultimoPtoBuf = { x: bx, y: by }; return; }

    bufCtx.beginPath();
    bufCtx.lineCap  = 'round';
    bufCtx.lineJoin = 'round';
    if (gesture === 'dibujar') {
      bufCtx.strokeStyle = COLORES_PINCEL[colorIdx];
      bufCtx.lineWidth   = 4;
    } else {
      bufCtx.strokeStyle = COLORES_BROCHA[colorIdx];
      bufCtx.lineWidth   = 32;
    }
    bufCtx.moveTo(ultimoPtoBuf.x, ultimoPtoBuf.y);
    bufCtx.lineTo(bx, by);
    bufCtx.stroke();
    ultimoPtoBuf = { x: bx, y: by };
  }

  const RADIO_BORRADOR = 28;

  function aplicarBorrador(puños) {
    // Mano derecha = menor X en cámara (aparece a la derecha en pantalla espejada)
    const manoDer = puños.reduce((acc, m) => (m[9].x < acc[9].x ? m : acc));
    const mx = (1 - manoDer[9].x) * canvas.width;
    const my = manoDer[9].y * canvas.height;
    sincBuf();
    bufCtx.globalCompositeOperation = 'destination-out';
    bufCtx.beginPath();
    bufCtx.arc(mx, my, RADIO_BORRADOR, 0, Math.PI * 2);
    bufCtx.fillStyle = 'rgba(0,0,0,1)';
    bufCtx.fill();
    bufCtx.globalCompositeOperation = 'source-over';
    return { mx, my };
  }

  function renderPaintCanvas(manos, gestureMano, seleccionInfo, borrarInfo) {
    sincBuf();
    ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    ctxPaint.drawImage(bufCanvas, 0, 0);

    // ── Indicador de selección de color ──────────────────────────────────────
    if (seleccionInfo) {
      const { idx, inicio, sx, sy } = seleccionInfo;
      const progress = Math.min((Date.now() - inicio) / MS_SELECCION, 1);
      const color    = COLORES_PINCEL[idx];
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
      ctxPaint.arc(mx, my, RADIO_BORRADOR, 0, Math.PI * 2);
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
        ctxPaint.arc(sx, sy, 5, 0, Math.PI * 2);
        ctxPaint.fillStyle = COLORES_PINCEL[colorIdx];
        ctxPaint.fill();
      } else if (gesture === 'brocha') {
        ctxPaint.beginPath();
        ctxPaint.arc(sx, sy, 18, 0, Math.PI * 2);
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

  // Loop principal
  let _lastFrameTime = 0;
  let _vizStep = -1;
  function loop(timestamp) {
    const dt = _lastFrameTime ? Math.min((timestamp - _lastFrameTime) / 1000, 0.05) : 0.016;
    _lastFrameTime = timestamp;
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
              colorIdx = dedoIdxSel;
              colorBtns.forEach((b, j) => b.classList.toggle('activo', j === dedoIdxSel));
              colorSeleccion = null;
            } else {
              colorSeleccion.sx = sx; colorSeleccion.sy = sy;
            }
          } else {
            colorSeleccion = { idx: dedoIdxSel, inicio: Date.now(), sx, sy };
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

      // Cuadrilátero → filtro (altura) / área / nota  [BPM solo por slider]
      if (ancho !== null) {
        if (formaConfirmada === 'dos_triangulos') {
          actualizarWow(centroY, ancho, subtipoAcid);
        } else {
          // Manos arriba (centroY bajo) = agudos, manos abajo (centroY alto) = graves
          const tFiltro = mapear(centroY, 0.75, 0.15, 0, 1);
          actualizarFiltro(tFiltro);
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

      // Gesto dos dedos pegados → control relativo del tempo
      if (!_mouseDrag) {
        const mano2 = manos.find(m => dosDeadosPegados(m));
        if (mano2) {
          const sy = ((mano2[8].y + mano2[12].y) / 2) * window.innerHeight;
          if (!_gestureDrag) {
            // Solo enganchar si los dedos están sobre el slider
            if (dedosSobreSlider(mano2)) {
              _gestureDrag = { startY: sy, startBPM: _bpmTarget };
            }
          }
          if (_gestureDrag) {
            // Tracking delta — funciona aunque los dedos se muevan fuera del área
            const delta = _gestureDrag.startY - sy; // arriba = positivo = más BPM
            const bpm = Math.max(80, Math.min(180, _gestureDrag.startBPM + delta * 0.7));
            if (!locked) actualizarBPM(bpm);
            _bpmTarget = bpm;
            actualizarSlider(_bpmTarget);
          }
        } else {
          _gestureDrag = null; // dedos sueltos → soltar el enganche
        }
        sliderThumb.style.background = _gestureDrag
          ? 'rgba(255,255,255,0.95)'
          : 'rgba(255,255,255,0.55)';
      }

      // Cambio de modo house ↔ techno
      if (state.audioIniciado) {
        const tecno = formaConfirmada === 'dos_triangulos';
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

    // ── Indicador de paso actual en el viz de ritmo ─────────────────────────
    if (ritmoViz.style.display === 'block' && _vizStep !== state.step) {
      _vizStep = state.step;
      ritmoViz.querySelectorAll('.viz-cell').forEach(c => {
        c.classList.toggle('now', +c.dataset.step === _vizStep);
      });
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
    // También apaga el modo pintar
    if (modoPintar) {
      modoPintar = false;
      btnPaint.classList.remove('activo');
      paleta.classList.remove('visible');
      ultimoPtoBuf  = null;
      ultimoGesture = null;
      colorSeleccion = null;
      ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    }
  });

  volInput.addEventListener('input', () => setVolumen(parseFloat(volInput.value)));

  // ── Controles de pintura ──────────────────────────────────────────────────────
  btnPaint.addEventListener('click', () => {
    modoPintar = !modoPintar;
    btnPaint.classList.toggle('activo', modoPintar);
    paleta.classList.toggle('visible', modoPintar);
    if (!modoPintar) {
      ultimoPtoBuf = null;
      zoomActivo   = false;
      ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
    }
  });

  colorBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      colorIdx = i;
      colorBtns.forEach((b, j) => b.classList.toggle('activo', j === i));
    });
  });
  // Activar color rojo por defecto
  colorBtns[0]?.classList.add('activo');

  btnLimpiar.addEventListener('click', () => {
    bufCtx.clearRect(0, 0, bufCanvas.width, bufCanvas.height);
    ultimoPtoBuf  = null;
    ultimoGesture = null;
    ctxPaint.clearRect(0, 0, canvasPaint.width, canvasPaint.height);
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

  // Mouse drag
  let _mouseDrag = null;
  sliderTrack.addEventListener('mousedown', (e) => {
    _mouseDrag = { startY: e.clientY, startBPM: _bpmTarget };
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!_mouseDrag) return;
    const delta = _mouseDrag.startY - e.clientY;
    _bpmTarget = Math.max(80, Math.min(180, _mouseDrag.startBPM + delta * 0.8));
    actualizarBPM(_bpmTarget);
    actualizarSlider(_bpmTarget);
  });
  document.addEventListener('mouseup', () => { _mouseDrag = null; });

  actualizarSlider(_bpmTarget);

  // ── Selector de ritmo ────────────────────────────────────────────────────────
  const ritmoViz      = document.getElementById('ritmo-viz');
  const vizTitulo     = document.getElementById('ritmo-viz-titulo');
  const ritmoNombreEl = document.getElementById('ritmo-nombre');
  let ritmoActivoIdx  = 6;

  const VIZ_TRACKS = [
    { key: 'chico',   label: '🔔', color: 'rgba(255,255,255,0.82)' },
    { key: 'repique', label: '🥁', color: '#e63946' },
    { key: 'piano',   label: '🔴', color: '#e67e22' },
    { key: 'madera',  label: '👏', color: '#1abc9c' },
    { key: 'bombo',   label: '💥', color: '#4a90e2' },
  ];

  const LIBRE_IDX = 6;
  let _libreRect = null;  // posición del botón Libre, para re-renderizar desde la grilla
  let _vizOpener = null;  // quién abrió el viz: índice de ritmo o 'rit' (♩)

  function ocultarViz() {
    ritmoViz.style.display = '';
    _vizOpener = null;
  }

  // Aplica una edición del patrón Libre en tiempo real: re-arma las secuencias
  // (Tone.Sequence NO relee el array mutado) y activa Libre si hacía falta
  function aplicarEdicionLibre() {
    const libreBtn = ritmoBtns[LIBRE_IDX];
    cambiarRitmo(LIBRE_IDX);
    ritmoActivoIdx = LIBRE_IDX;
    ritmoNombreEl.textContent = libreBtn.textContent;
    ritmoBtns.forEach((b, j) => b.classList.toggle('activo', j === LIBRE_IDX));
    mostrarViz(BANCO_PATRONES[LIBRE_IDX], 'Libre ✎', _libreRect, true);
  }

  function mostrarViz(patron, nombre, btnRect, editable) {
    vizTitulo.textContent = nombre;
    while (ritmoViz.children.length > 1) ritmoViz.removeChild(ritmoViz.lastChild);
    ritmoViz.classList.toggle('editable', !!editable);

    VIZ_TRACKS.forEach(track => {
      const fila = document.createElement('div');
      fila.className = 'viz-track';

      const label = document.createElement('span');
      label.className = 'viz-label';
      label.textContent = track.label;
      fila.appendChild(label);

      const celdas = document.createElement('div');
      celdas.className = 'viz-cells';

      patron[track.key].forEach((hit, idx) => {
        if (idx > 0 && idx % 4 === 0) {
          const gap = document.createElement('div');
          gap.className = 'viz-gap';
          celdas.appendChild(gap);
        }
        const celda = document.createElement('div');
        celda.className = 'viz-cell' + (hit ? ' hit' : '');
        celda.dataset.step = idx;
        if (hit) celda.style.background = track.color;

        if (editable) {
          celda.addEventListener('click', (e) => {
            e.stopPropagation();
            BANCO_PATRONES[LIBRE_IDX][track.key][idx] = hit ? null : 1;
            // En tiempo real: re-arma las secuencias y suena en la próxima pasada
            aplicarEdicionLibre();
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
          BANCO_PATRONES[LIBRE_IDX][key].fill(null);
        });
        aplicarEdicionLibre();
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
    const esLibre = ritmoActivoIdx === LIBRE_IDX;
    const rect = btnRitmo.getBoundingClientRect();
    if (esLibre) _libreRect = rect;
    mostrarViz(BANCO_PATRONES[ritmoActivoIdx], ritmoBtns[ritmoActivoIdx].textContent, rect, esLibre);
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
        const esLibre = i === LIBRE_IDX;
        if (esLibre) _libreRect = btn.getBoundingClientRect();
        mostrarViz(BANCO_PATRONES[i], btn.textContent, btn.getBoundingClientRect(), esLibre);
        _vizOpener = i;
      }
    });
    btn.addEventListener('mouseenter', () => {
      // Hover solo abre si no hay un viz ya abierto — no pisa al editor
      if (ritmoViz.style.display === 'block') return;
      const esLibre = i === LIBRE_IDX;
      if (esLibre) _libreRect = btn.getBoundingClientRect();
      mostrarViz(BANCO_PATRONES[i], btn.textContent, btn.getBoundingClientRect(), esLibre);
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
