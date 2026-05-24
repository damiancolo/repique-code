/**
 * audio.js — Motor de audio (Fase 4)
 *
 * Usa samples reales de Freesound cuando están disponibles (credits.json).
 * Cae a síntesis (MembraneSynth / MetalSynth) por categoría si no hay samples.
 * Velocity aleatoria 0.7–1.0 por golpe para humanizar.
 */

import * as Tone from 'tone';
import { state } from './state.js';

// ─── Patrones de 16 pasos ────────────────────────────────────────────────────
const PATRONES = {
  piano:   [1,null,null,null,  1,null,null,1,    null,null,1,null,  null,1,null,null],
  repique: [1,null,1,null,     null,1,null,null,  1,1,null,null,     1,null,1,null],
  chico:   [1,null,1,null,     1,null,1,null,     1,null,1,null,     1,null,1,null],
  madera:  [1,null,null,1,     null,null,1,null,  null,1,null,null,  1,null,null,null],
};

// ─── Synths de fallback ───────────────────────────────────────────────────────
const synthPiano = new Tone.MembraneSynth({
  pitchDecay: 0.1, octaves: 8,
  envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.2 },
});
const synthRepique = new Tone.MembraneSynth({
  pitchDecay: 0.05, octaves: 5,
  envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
});
const synthChico = new Tone.MembraneSynth({
  pitchDecay: 0.02, octaves: 4,
  envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
});
const synthMadera = new Tone.MetalSynth({
  frequency: 440,
  envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
  harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
});

// ─── Drone ────────────────────────────────────────────────────────────────────
const droneGain = new Tone.Gain(0);
const drone = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.4, decay: 0, sustain: 1, release: 1.2 },
  volume: 6,
});
const NOTA_POR_FORMA = {
  rectangulo:    'C3',   // Do
  trapecio_piso: 'D3',   // Re
  trapecio_techo:'E3',   // Mi
  trapecio_izq:  'F3',   // Fa
  trapecio_der:  'G3',   // Sol
  la:            'A3',   // La — mano derecha girada
  si:            'B3',   // Si — mano izquierda girada
};

// ─── Filtro lowpass global ────────────────────────────────────────────────────
const filtro = new Tone.Filter({ type: 'lowpass', frequency: 4000, rolloff: -12 });

// ─── Estado interno ───────────────────────────────────────────────────────────
let masterGain       = null;
let players          = null;           // Tone.Players con los samples reales
let samplesDisp      = {};             // { categoria: ['cat_0', 'cat_1', ...] }
let seqPiano, seqRepique, seqChico, seqMadera;
let droneFormaActual = null;
let bpmInterno       = 100;
// [madera, chico, repique, piano] — independientes
let tracksActivos    = [false, false, false, false];

// ─── Carga de samples ─────────────────────────────────────────────────────────

async function cargarSamples(destino) {
  try {
    const res = await fetch('samples/credits.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const porCategoria = {};
    for (const s of data.samples) {
      if (!porCategoria[s.category]) porCategoria[s.category] = [];
      porCategoria[s.category].push(s.file); // ej: "madera/1.mp3"
    }

    const playerMap = {};
    for (const [cat, files] of Object.entries(porCategoria)) {
      samplesDisp[cat] = [];
      files.forEach((file, i) => {
        const key = `${cat}_${i}`;
        playerMap[key] = `samples/${file}`;
        samplesDisp[cat].push(key);
      });
    }

    if (Object.keys(playerMap).length > 0) {
      players = new Tone.Players(playerMap).connect(destino);
      console.log('[Repique Code] Samples cargados:', Object.keys(playerMap));
    }
  } catch (err) {
    console.warn('[Repique Code] Sin samples, usando síntesis:', err.message);
  }
}

// ─── Disparo de samples con velocity ─────────────────────────────────────────

function dispararSample(cat, time) {
  const keys = samplesDisp[cat];
  if (!players || !keys?.length) return false;

  try {
    const key    = keys[Math.floor(Math.random() * keys.length)];
    const vel    = 0.7 + Math.random() * 0.3;
    const player = players.player(key);
    player.volume.setValueAtTime(Tone.gainToDb(vel), time);
    player.start(time);
    return true;
  } catch (err) {
    console.warn('[Repique Code] Error disparando sample:', err.message);
    return false;
  }
}

// ─── Secuenciador ─────────────────────────────────────────────────────────────

function crearSecuencias() {
  seqMadera = new Tone.Sequence((time) => {
    if (!tracksActivos[0]) return;
    if (!dispararSample('madera', time))
      synthMadera.triggerAttackRelease('16n', time);
  }, PATRONES.madera, '16n');

  seqChico = new Tone.Sequence((time) => {
    if (!tracksActivos[1]) return;
    if (!dispararSample('chico', time))
      synthChico.triggerAttackRelease('C4', '16n', time);
  }, PATRONES.chico, '16n');

  seqRepique = new Tone.Sequence((time) => {
    if (!tracksActivos[2]) return;
    if (!dispararSample('repique', time))
      synthRepique.triggerAttackRelease('G2', '16n', time);
  }, PATRONES.repique, '16n');

  seqPiano = new Tone.Sequence((time) => {
    if (!tracksActivos[3]) return;
    if (!dispararSample('piano', time))
      synthPiano.triggerAttackRelease('C1', '16n', time);
  }, PATRONES.piano, '16n');
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function startAudio() {
  await Tone.start(); // requiere gesto del usuario

  if (!masterGain) {
    masterGain = new Tone.Gain(state.volumen);
    // Synths → filtro → ganancia → salida
    [synthPiano, synthRepique, synthChico, synthMadera].forEach(s => s.connect(filtro));
    filtro.connect(masterGain);
    masterGain.toDestination();
    // Drone → droneGain → salida (bypasea el filtro de percusión)
    drone.connect(droneGain);
    droneGain.toDestination();
  }

  // Cargar samples (players también conectan al filtro)
  await cargarSamples(filtro);

  // Esperar a que Tone.js descargue todos los buffers
  await Tone.loaded();

  // Arrancar ritmo y drone
  crearSecuencias();
  drone.triggerAttack('D3');
  droneFormaActual = 'rectangulo';

  Tone.getTransport().bpm.value = bpmInterno;
  [seqPiano, seqRepique, seqChico, seqMadera].forEach(s => s.start(0));
  Tone.getTransport().start();

  state.audioIniciado = true;
}

export function stopAudio() {
  drone.triggerRelease();
  droneGain.gain.rampTo(0, 0.3);
  Tone.getTransport().stop();
  [seqPiano, seqRepique, seqChico, seqMadera].forEach(s => s?.dispose());
  state.audioIniciado = false;
}

export function actualizarBPM(bpmObjetivo) {
  bpmInterno += (bpmObjetivo - bpmInterno) * 0.04;
  state.bpm = Math.round(bpmInterno);
  if (state.audioIniciado) Tone.getTransport().bpm.value = bpmInterno;
}

// ancho 0→estrecho=grave, 0.65+→ancho=agudo  (min 1200 Hz para no silenciar)
export function actualizarFiltro(ancho) {
  const t    = Math.min(ancho / 0.65, 1);
  const freq = 1200 * Math.pow(8000 / 1200, t);
  filtro.frequency.rampTo(freq, 0.08);
}

export function actualizarArea(area) {
  const ganancia = Math.min(area / 0.06, 1);
  droneGain.gain.rampTo(ganancia, 0.08);
}

export function actualizarNota(forma) {
  if (!forma || forma === droneFormaActual) return;
  droneFormaActual = forma;
  const nota = NOTA_POR_FORMA[forma];
  if (nota) drone.frequency.rampTo(Tone.Frequency(nota).toFrequency(), 0.08);
}

export function setVolumen(v) {
  state.volumen = v;
  if (masterGain) masterGain.gain.rampTo(v, 0.05);
}

export function setTrack(idx, activo) {
  tracksActivos[idx] = activo;
}

export function resetTracks() {
  tracksActivos = [false, false, false, false];
}
