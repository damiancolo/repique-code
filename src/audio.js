/**
 * audio.js — Motor de audio (Fase 4)
 *
 * Usa samples reales de Freesound cuando están disponibles (credits.json).
 * Cae a síntesis (MembraneSynth / MetalSynth) por categoría si no hay samples.
 * Velocity aleatoria 0.7–1.0 por golpe para humanizar.
 */

import * as Tone from 'tone';
import { state } from './state.js';

// ─── Bancos de patrones ──────────────────────────────────────────────────────
const BANCO_PATRONES = [
  // 0 · House — kick 4/4, snare 2+4, hihat corcheas, perc offbeat
  {
    piano:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
    repique: [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    chico:   [1,null,1,null,   1,null,1,null,   1,null,1,null,   1,null,1,null],
    madera:  [null,null,1,null, null,null,1,null, null,null,1,null, null,null,1,null],
    bombo:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
  },
  // 1 · Dos pulsos — T1=T3 (kick+sub), T2=T4 (snare), hihat constante
  {
    piano:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
    repique: [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    chico:   [1,null,1,null,   1,null,1,null,   1,null,1,null,   1,null,1,null],
    madera:  [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    bombo:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
  },
  // 2 · Escalera — piano:1, repique:2, chico:3, madera:4 por cada tiempo
  {
    piano:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
    repique: [null,1,null,null, null,1,null,null, null,1,null,null, null,1,null,null],
    chico:   [null,null,1,null, null,null,1,null, null,null,1,null, null,null,1,null],
    madera:  [null,null,null,1, null,null,null,1, null,null,null,1, null,null,null,1],
    bombo:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
  },
  // 3 · Tresillo — división 3-3-2, groove afrolatino sincopado
  {
    piano:   [1,null,null,1, null,null,1,null, null,null,null,1, null,null,1,null],
    repique: [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    chico:   [1,null,1,null, 1,null,1,null, 1,null,1,null, 1,null,1,null],
    madera:  [null,1,null,null, null,null,null,1, null,null,null,null, null,null,null,null],
    bombo:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
  },
  // 4 · Medianoche — medio tiempo, muy abierto, golpes mínimos
  {
    piano:   [1,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    repique: [null,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
    chico:   [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    madera:  [null,1,null,null, null,1,null,null, null,1,null,null, null,1,null,null],
    bombo:   [1,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
  },
  // 5 · Llamada — chico constante, repique con llamada, bombo en tiempos
  {
    piano:   [1,null,null,null, null,null,1,null, null,null,null,null, null,1,null,null],
    repique: [1,null,1,null, null,1,null,null, 1,null,null,1, null,null,null,null],
    chico:   [1,null,1,null, 1,null,1,null, 1,null,1,null, 1,null,1,null],
    madera:  [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    bombo:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
  },
  // 6 · Libre — patrón editable por el usuario (empieza con kick+snare simple)
  {
    piano:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
    repique: [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    chico:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    madera:  [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    bombo:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
  },
];

let ritmoActual = 6;

// Alias para compatibilidad interna
const PATRONES = BANCO_PATRONES[0]; // solo usado en la inicialización

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
  frequency: 220,
  envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
  harmonicity: 3.1, modulationIndex: 8, resonance: 5000, octaves: 0.5,
  volume: 2,
});

// ─── Bombo sub-grave (bypasea filtro, siempre profundo) ────────────────────
const synthBombo = new Tone.MembraneSynth({
  pitchDecay: 0.07,   // caída rápida → golpe seco, sin piuuu
  octaves: 2,          // barrido pequeño → más thud que sweep
  envelope: { attack: 0.001, decay: 1.0, sustain: 0, release: 0.3 },
  volume: 9,
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
  la:            'A3',   // La — pinza derecha
  si:            'B3',   // Si — pinza izquierda
  do_alto:       'C4',   // Do₂ — pulgares arriba
};

// ─── Filtro lowpass global ────────────────────────────────────────────────────
const filtro = new Tone.Filter({ type: 'lowpass', frequency: 4000, rolloff: -12 });

// ─── Efectos acid (activos solo en modo dos triángulos) ──────────────────────
const distorsion = new Tone.Distortion({ distortion: 0.5, wet: 0 });
// Chebyshev: distorsión armónica cálida — modo split (pedalera)
const chebyshev  = new Tone.Chebyshev({ order: 50, wet: 0 });

// ─── Estado interno ───────────────────────────────────────────────────────────
let masterGain       = null;
let players          = null;           // Tone.Players con los samples reales
let samplesDisp      = {};             // { categoria: ['cat_0', 'cat_1', ...] }
let seqPiano, seqRepique, seqChico, seqMadera, seqBombo;
let droneFormaActual = null;
let bpmInterno       = 100;
// [madera, chico, repique, piano] — siempre activos
let tracksActivos    = [true, true, true, true];

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
    const key    = keys[0]; // siempre el mismo sample por categoría
    const player = players.player(key);
    player.start(time);
    return true;
  } catch (err) {
    console.warn('[Repique Code] Error disparando sample:', err.message);
    return false;
  }
}

// ─── Secuenciador ─────────────────────────────────────────────────────────────

function crearSecuencias() {
  const P = BANCO_PATRONES[ritmoActual];

  seqMadera = new Tone.Sequence((time) => {
    if (!tracksActivos[0]) return;
    if (!dispararSample('madera', time))
      synthMadera.triggerAttackRelease('16n', time);
  }, P.madera, '16n');

  seqChico = new Tone.Sequence((time) => {
    if (!tracksActivos[1]) return;
    if (!dispararSample('chico', time))
      synthChico.triggerAttackRelease('C4', '16n', time);
  }, P.chico, '16n');

  seqRepique = new Tone.Sequence((time) => {
    if (!tracksActivos[2]) return;
    if (!dispararSample('repique', time))
      synthRepique.triggerAttackRelease('G2', '16n', time);
  }, P.repique, '16n');

  seqPiano = new Tone.Sequence((time) => {
    if (!tracksActivos[3]) return;
    if (!dispararSample('piano', time))
      synthPiano.triggerAttackRelease('C1', '16n', time);
  }, P.piano, '16n');

  seqBombo = new Tone.Sequence((time) => {
    synthBombo.triggerAttackRelease('C1', '8n', time);
  }, P.bombo, '16n');
}

export function cambiarRitmo(idx) {
  ritmoActual = idx;
  if (!state.audioIniciado) return;
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo].forEach(s => { s?.stop(); s?.dispose(); });
  crearSecuencias();
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo].forEach(s => s.start(0));
}

// ─── API pública ──────────────────────────────────────────────────────────────

// Llamar sincrónicamente desde el handler de clic, antes de cualquier await
export function resumeContextSync() {
  try {
    const raw = Tone.context.rawContext;
    if (raw && raw.state !== 'running') raw.resume();
  } catch (_) {}
}

export async function startAudio() {
  await Tone.start();

  // Retry de resume con backoff — iOS a veces necesita varios intentos
  for (let i = 0; i < 5; i++) {
    if (Tone.context.state === 'running') break;
    await Tone.context.resume();
    await new Promise(r => setTimeout(r, 150));
  }
  if (Tone.context.state !== 'running') {
    throw new Error('AudioContext bloqueado. Intentá subir el volumen del dispositivo y volver a pulsar Arrancar.');
  }

  if (!masterGain) {
    masterGain = new Tone.Gain(state.volumen);
    // Synths → filtro → distorsion → chebyshev → ganancia → salida
    [synthPiano, synthRepique, synthChico, synthMadera].forEach(s => s.connect(filtro));
    filtro.connect(distorsion);
    distorsion.connect(chebyshev);
    chebyshev.connect(masterGain);
    masterGain.toDestination();
    synthBombo.connect(masterGain); // bypass filtro — siempre profundo
    // Drone → droneGain → salida (bypasea el filtro de percusión)
    drone.connect(droneGain);
    droneGain.toDestination();
  }

  // En móvil se saltea la carga de samples — síntesis directa, sin riesgo de cuelgue
  const esMobil = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!esMobil) {
    await cargarSamples(filtro);
    await Promise.race([Tone.loaded(), new Promise(r => setTimeout(r, 4000))]);
  }

  // Arrancar ritmo y drone
  crearSecuencias();
  drone.triggerAttack('D3');
  droneFormaActual = 'rectangulo';

  Tone.getTransport().bpm.value = bpmInterno;
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo].forEach(s => s.start(0));
  Tone.getTransport().start();

  state.audioIniciado = true;
}

export function stopAudio() {
  drone.triggerRelease();
  droneGain.gain.rampTo(0, 0.3);
  Tone.getTransport().stop();
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo].forEach(s => s?.dispose());
  state.audioIniciado = false;
}

export function actualizarBPM(bpmObjetivo) {
  bpmInterno += (bpmObjetivo - bpmInterno) * 0.04;
  state.bpm = Math.round(bpmInterno);
  if (state.audioIniciado) Tone.getTransport().bpm.value = bpmInterno;
}

// ancho 0→estrecho, 0.65+→ancho — mínimo 3500 Hz para no silenciar la percusión
export function actualizarFiltro(t) {
  // t: 0 = graves (200 Hz), 1 = agudos (12000 Hz)
  const freq = 200 * Math.pow(12000 / 200, Math.max(0, Math.min(1, t)));
  filtro.frequency.rampTo(freq, 0.18);
}

export function actualizarArea(area) {
  const ganancia = Math.min(area / 0.06, 1);
  droneGain.gain.rampTo(ganancia, 0.18);
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

export function resetTracks() {
  tracksActivos = [true, true, true, true];
}

// Dos triángulos: cambia el filtro a bandpass + habilita distorsión
export function setModoTecno(activo) {
  if (activo) {
    filtro.type = 'bandpass';
    filtro.frequency.rampTo(1200, 0.3);
    filtro.Q.rampTo(8, 0.3);
  } else {
    filtro.type = 'lowpass';
    filtro.frequency.rampTo(4000, 0.4);
    filtro.Q.rampTo(0.5, 0.4);
    distorsion.wet.rampTo(0, 0.4);
    chebyshev.wet.rampTo(0, 0.4);
  }
}

// Escalas para los dos subtipos — carácter muy diferente entre sí
// izq_abajo: pentatónica menor de A (oscura, blues, grounded)
const ESCALA_IZQ = ['D4','C4','A3','G3','E3','D3','C3','A2'];
// der_abajo: pentatónica mayor de Eb (brillante, tonal center muy diferente)
const ESCALA_DER = ['Bb3','Ab3','G3','Eb3','C3','Bb2','Ab2','G2'];

let _notaAcidIdx  = -1;
let _subtipoActual = null;

// Wow: tres modos según subtipo
//  izq_abajo / der_abajo → wah + escala propia
//  split → fuzz de pedalera eléctrica (Chebyshev + distorsión máxima)
export function actualizarWow(centroY, ancho, subtipoAcid) {
  // ── Transición entre subtipos ────────────────────────────────────────────────
  if (subtipoAcid !== _subtipoActual) {
    _subtipoActual = subtipoAcid;
    _notaAcidIdx = -1;
    if (subtipoAcid === 'split') {
      distorsion.distortion = 0.92;
      filtro.Q.rampTo(28, 0.15);
      chebyshev.wet.rampTo(1, 0.15);
    } else {
      distorsion.distortion = 0.5;
      chebyshev.wet.rampTo(0, 0.25);
    }
  }

  if (subtipoAcid === 'split') {
    // ── Pedalera: wah agresivo + fuzz ─────────────────────────────────────────
    const freq = _map(centroY, 0.08, 0.92, 4500, 250);
    filtro.frequency.rampTo(Math.max(250, Math.min(4500, freq)), 0.04);
    const t = Math.min(ancho / 0.55, 1);
    filtro.Q.rampTo(18 + t * 16, 0.04);    // Q 18 → 34
    distorsion.wet.rampTo(0.7 + t * 0.3, 0.04); // wet 0.7 → 1.0
  } else {
    // ── Wah expresivo + escala ────────────────────────────────────────────────
    const escala = subtipoAcid === 'izq_abajo' ? ESCALA_IZQ : ESCALA_DER;
    filtro.type = 'bandpass';
    const freq = _map(centroY, 0.10, 0.85, 5500, 180);
    filtro.frequency.rampTo(Math.max(180, Math.min(5500, freq)), 0.06);
    const t = Math.min(ancho / 0.60, 1);
    filtro.Q.rampTo(4 + t * 18, 0.06);
    distorsion.wet.rampTo(t * 0.55, 0.06);

    // Nota por altura — sin debounce, muy responsivo
    const idx = Math.min(
      Math.max(0, Math.floor(_map(centroY, 0.08, 0.88, 0, escala.length))),
      escala.length - 1
    );
    if (idx !== _notaAcidIdx) {
      _notaAcidIdx = idx;
      drone.frequency.rampTo(Tone.Frequency(escala[idx]).toFrequency(), 0.05);
    }
  }
}

export function resetNotaAcid() {
  _notaAcidIdx = -1;
  _subtipoActual = null;
}

function _map(v, inMin, inMax, outMin, outMax) {
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
}

export { BANCO_PATRONES };
