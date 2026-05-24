/**
 * main.js — Bootstrap de Repique Code
 */

import { initHands, detectarManos, calcularGestos, detectarDedos, detectarDedosJuntos } from './hands.js';
import { renderFrame } from './render.js';
import { startAudio, stopAudio, setVolumen, actualizarBPM, actualizarFiltro, actualizarArea, actualizarNota, setTrack, resetTracks } from './audio.js';
import { state } from './state.js';

const video    = document.getElementById('video');
const canvas   = document.getElementById('canvas');
const ctx      = canvas.getContext('2d');
const btnStart = document.getElementById('btn-start');
const btnStop  = document.getElementById('btn-stop');
const volInput = document.getElementById('volume');
const status   = document.getElementById('status');

async function init() {
  function redimensionar() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
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

  // ── Control de tracks por dedo (solo con UNA mano) ──────────────────────────
  const FRAMES_ACTIVAR = 90;
  const FRAMES_CIERRE  = 30;

  let framesPorDedo = [0, 0, 0, 0];
  let trackStates   = [false, false, false, false];
  let framesCierre  = 0;

  // Loop principal
  function loop() {
    const manos = detectarManos(video);
    const { ancho, centroY, area, puntos, forma } = calcularGestos(manos);

    // ── Gestos de dedo / cierre (solo con 1 mano) ────────────────────────────
    if (state.audioIniciado && manos.length === 1) {
      if (detectarDedosJuntos(manos)) {
        framesPorDedo.fill(0);
        if (++framesCierre >= FRAMES_CIERRE && trackStates.some(Boolean)) {
          framesCierre = 0;
          trackStates.fill(false);
          resetTracks();
        }
      } else {
        framesCierre = 0;
        const dedos = detectarDedos(manos);
        if (dedos !== null) {
          for (let i = 0; i < 4; i++) {
            if (dedos[i] && !trackStates[i]) {
              if (++framesPorDedo[i] >= FRAMES_ACTIVAR) {
                trackStates[i]   = true;
                setTrack(i, true);
                framesPorDedo[i] = 0;
              }
            } else if (!dedos[i]) {
              framesPorDedo[i] = 0;
            }
          }
        }
      }
    } else if (!state.audioIniciado || manos.length !== 1) {
      framesCierre = 0;
    }

    // ── Cuadrilátero → BPM / filtro / área / nota ─────────────────────────────
    if (ancho !== null) {
      const bpmObjetivo = mapear(centroY, 0.15, 0.75, 160, 60);
      actualizarBPM(Math.max(60, Math.min(160, bpmObjetivo)));
      actualizarFiltro(ancho);

      if (state.audioIniciado) {
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
      actualizarArea(0);
      formaCandidato  = null;
      framesCandidato = 0;
    }

    renderFrame(ctx, video, canvas, manos, puntos, formaConfirmada,
                trackStates, framesPorDedo, FRAMES_ACTIVAR, framesCierre, FRAMES_CIERRE);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Controles
  btnStart.addEventListener('click', async () => {
    btnStart.disabled = true;
    btnStart.textContent = 'Cargando…';
    status.textContent = 'Cargando samples…';
    try {
      await startAudio();
      status.textContent = '';
      btnStart.textContent = 'Sonando';
      btnStart.classList.add('activo');
      btnStop.disabled = false;
    } catch (err) {
      status.textContent = '';
      btnStart.textContent = 'Error de audio';
      btnStart.disabled = false;
      console.error('[Repique Code] Audio:', err);
    }
  });

  btnStop.addEventListener('click', () => {
    stopAudio();
    trackStates.fill(false);
    framesPorDedo.fill(0);
    resetTracks();
    btnStop.disabled = true;
    btnStart.textContent = 'Arranca';
    btnStart.classList.remove('activo');
    btnStart.disabled = false;
  });

  volInput.addEventListener('input', () => setVolumen(parseFloat(volInput.value)));
}

function mapear(valor, inMin, inMax, outMin, outMax) {
  return outMin + ((valor - inMin) / (inMax - inMin)) * (outMax - outMin);
}

init();
