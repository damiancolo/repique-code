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
  // 7 · Candombe — clave 3+3+4+2+4 (5 golpes, Jure & Rocamora), chico real
  // (silencio en 1.ª semicorchea, mano acentuada + dos palos suaves),
  // repique conversando, piano de base. Sin bombo: el trío es chico/repique/piano.
  // Valores ≠ 1 son velocity (acentos).
  {
    piano:   [1,null,null,null, null,null,null,0.7, 1,null,null,0.7, null,null,null,null],
    repique: [null,null,0.8,null, null,0.8,null,null, null,0.8,null,null, null,null,0.8,null],
    chico:   [null,1,0.55,0.55, null,1,0.55,0.55, null,1,0.55,0.55, null,1,0.55,0.55],
    madera:  [1,null,null,1, null,null,1,null, null,null,1,null, 1,null,null,null],
    bombo:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
  },
  // 8 · Candombe real — loop grabado (dataset Jure & Rocamora, CC-BY 4.0).
  // Patrón vacío: suena el Tone.Player con la grabación, no el secuenciador.
  {
    piano:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    repique: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    chico:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    madera:  [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    bombo:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
  },
];

const CANDOMBE_IDX      = 7;
const CANDOMBE_REAL_IDX = 8;

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

// ─── Clave de madera (candombe) — woodblock sintetizado, fallback de mobile ──
// Barrido de pitch corto y agudo → "tock" seco de palo sobre madera
const synthClave = new Tone.MembraneSynth({
  pitchDecay: 0.008,
  octaves: 1.5,
  envelope: { attack: 0.0005, decay: 0.08, sustain: 0, release: 0.03 },
  volume: 6,
});

// ─── Voces de candombe (síntesis dedicada) ───────────────────────────────────
// No hay samples de chico — siempre fue síntesis genérica. Para candombe:
// chico de dos tonos (mano redonda y acentuada / palo seco y agudo),
// repique y piano como fallback de mobile con carácter de tambor de lonja.
const synthChicoMano = new Tone.MembraneSynth({
  pitchDecay: 0.02, octaves: 2,
  envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.05 },
  volume: 2,
});
const synthChicoPalo = new Tone.MembraneSynth({
  pitchDecay: 0.01, octaves: 1.5,
  envelope: { attack: 0.0005, decay: 0.07, sustain: 0, release: 0.03 },
});
const synthRepiqueCand = new Tone.MembraneSynth({
  pitchDecay: 0.03, octaves: 2.5,
  envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 },
  volume: 1,
});
const synthPianoCand = new Tone.MembraneSynth({
  pitchDecay: 0.05, octaves: 3,
  envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.15 },
  volume: 4,
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
let seqPiano, seqRepique, seqChico, seqMadera, seqBombo, seqStep;
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
      // El loop de candombe se carga aparte (asegurarLoop), no en Players
      if (s.category === 'candombe') continue;
      if (!porCategoria[s.category]) porCategoria[s.category] = [];
      porCategoria[s.category].push(s.file); // ej: "madera/1.mp3"
      // Categoría virtual 'clave': solo las maderas que son clave de verdad
      // (madera/1 es un clap y madera/4 un cowbell — no sirven para candombe)
      if (s.category === 'madera' && /clave/i.test(s.name || '')) {
        if (!porCategoria.clave) porCategoria.clave = [];
        porCategoria.clave.push(s.file);
      }
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

function dispararSample(cat, time, vFactor = 1) {
  const keys = samplesDisp[cat];
  if (!players || !keys?.length) return false;

  try {
    // Sample fijo por categoría — sin round-robin: en el editor cada paso
    // tiene que sonar siempre igual para poder editar con criterio
    const player = players.player(keys[0]);
    player.volume.setValueAtTime(Tone.gainToDb((0.85 + Math.random() * 0.15) * vFactor), time);
    player.start(time);
    return true;
  } catch (err) {
    console.warn('[Repique Code] Error disparando sample:', err.message);
    return false;
  }
}

// Velocity con variación leve — humaniza sin volverse impredecible
function _vel() {
  return 0.85 + Math.random() * 0.15;
}

// ─── Secuenciador ─────────────────────────────────────────────────────────────

let _chicoIdx = 0; // posición dentro del grupo mano-palo-palo del chico (candombe)

function crearSecuencias() {
  const P = BANCO_PATRONES[ritmoActual];
  const esCandombe = ritmoActual === CANDOMBE_IDX;
  _chicoIdx = 0;
  // El valor del patrón puede ser velocity (0-1); 1 o truthy genérico = golpe pleno
  const vf = (v) => (typeof v === 'number' ? v : 1);

  seqMadera = new Tone.Sequence((time, v) => {
    if (!tracksActivos[0]) return;
    if (esCandombe) {
      // Clave de verdad: samples de clave (categoría virtual) o woodblock sintetizado.
      // Nunca el clap/cowbell, y bypasea el filtro — la clave siempre corta.
      if (!dispararSample('clave', time, vf(v)))
        synthClave.triggerAttackRelease('G5', '16n', time, 0.9 + Math.random() * 0.1);
      return;
    }
    if (!dispararSample('madera', time, vf(v)))
      synthMadera.triggerAttackRelease('16n', time, _vel() * vf(v));
  }, P.madera, '16n');

  seqChico = new Tone.Sequence((time, v) => {
    if (!tracksActivos[1]) return;
    if (esCandombe) {
      // Microtiming (Jure & Rocamora): la mano cae en el pulso, los dos palos
      // se adelantan levemente — la "contracción" característica del chico
      const pos = _chicoIdx++ % 3;
      if (pos === 0) {
        synthChicoMano.triggerAttackRelease('G3', '16n', time, _vel());
      } else {
        const t = time - (pos === 1 ? 0.008 : 0.012);
        synthChicoPalo.triggerAttackRelease('C4', '16n', t, _vel() * vf(v));
      }
      return;
    }
    if (!dispararSample('chico', time, vf(v)))
      synthChico.triggerAttackRelease('C4', '16n', time, _vel() * vf(v));
  }, P.chico, '16n');

  seqRepique = new Tone.Sequence((time, v) => {
    if (!tracksActivos[2]) return;
    if (!dispararSample('repique', time, vf(v))) {
      const s = esCandombe ? synthRepiqueCand : synthRepique;
      s.triggerAttackRelease(esCandombe ? 'B2' : 'G2', '16n', time, _vel() * vf(v));
    }
  }, P.repique, '16n');

  seqPiano = new Tone.Sequence((time, v) => {
    if (!tracksActivos[3]) return;
    if (!dispararSample('piano', time, vf(v))) {
      const s = esCandombe ? synthPianoCand : synthPiano;
      s.triggerAttackRelease(esCandombe ? 'G1' : 'C1', '16n', time, _vel() * vf(v));
    }
  }, P.piano, '16n');

  seqBombo = new Tone.Sequence((time) => {
    synthBombo.triggerAttackRelease('C1', '8n', time, _vel());
  }, P.bombo, '16n');

  // Track del paso actual → state.step (para el indicador del viz)
  seqStep = new Tone.Sequence((time, idx) => {
    Tone.getDraw().schedule(() => { state.step = idx; }, time);
  }, [...Array(16).keys()], '16n');
}

// ─── Loop de candombe real (Jure & Rocamora, CC-BY 4.0) ──────────────────────
const LOOP_BPM_NATIVO = 131.08; // 8 compases (20.1→28.1) de zavala.muniz.2014_46
let loopPlayer   = null;
let loopCargando = false;

async function asegurarLoop() {
  if (loopPlayer || loopCargando) return;
  loopCargando = true;
  try {
    const p = new Tone.Player({ url: 'samples/candombe/loop1.m4a', loop: true });
    await Tone.loaded();
    p.connect(filtro); // los gestos siguen filtrando la grabación
    loopPlayer = p;
    sincronizarLoop();
  } catch (err) {
    console.warn('[Repique Code] No se pudo cargar el loop de candombe:', err.message);
  }
  loopCargando = false;
}

function sincronizarLoop() {
  if (!loopPlayer) return;
  loopPlayer.playbackRate = bpmInterno / LOOP_BPM_NATIVO;
  const debeSonar = state.audioIniciado && ritmoActual === CANDOMBE_REAL_IDX;
  if (debeSonar && loopPlayer.state !== 'started') loopPlayer.start();
  if (!debeSonar && loopPlayer.state === 'started') loopPlayer.stop();
}

// Swing leve para los ritmos electrónicos; en candombe el feel lo pone el
// microtiming propio del chico — el swing global correría la clave
function _aplicarSwing() {
  Tone.getTransport().swing = (ritmoActual === CANDOMBE_IDX || ritmoActual === CANDOMBE_REAL_IDX) ? 0 : 0.08;
}

export function cambiarRitmo(idx) {
  ritmoActual = idx;
  if (!state.audioIniciado) return;
  _aplicarSwing();
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo, seqStep].forEach(s => { s?.stop(); s?.dispose(); });
  crearSecuencias();
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo, seqStep].forEach(s => s.start(0));
  if (idx === CANDOMBE_REAL_IDX) asegurarLoop();
  sincronizarLoop();
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
    [synthPiano, synthRepique, synthChico, synthMadera,
     synthChicoMano, synthChicoPalo, synthRepiqueCand, synthPianoCand].forEach(s => s.connect(filtro));
    filtro.connect(distorsion);
    distorsion.connect(chebyshev);
    chebyshev.connect(masterGain);
    masterGain.toDestination();
    synthBombo.connect(masterGain); // bypass filtro — siempre profundo
    synthClave.connect(masterGain); // bypass filtro — la clave siempre corta
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

  // Arrancar ritmo y drone — C3 coincide con droneFormaActual ('rectangulo')
  crearSecuencias();
  drone.triggerAttack('C3');
  droneFormaActual = 'rectangulo';

  Tone.getTransport().bpm.value = bpmInterno;
  Tone.getTransport().swingSubdivision = '16n';
  _aplicarSwing();
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo, seqStep].forEach(s => s.start(0));
  Tone.getTransport().start();

  state.audioIniciado = true;
  if (ritmoActual === CANDOMBE_REAL_IDX) asegurarLoop();
}

export function stopAudio() {
  drone.triggerRelease();
  droneGain.gain.rampTo(0, 0.3);
  Tone.getTransport().stop();
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo, seqStep].forEach(s => s?.dispose());
  loopPlayer?.stop();
  state.step = -1;
  state.audioIniciado = false;
}

export function actualizarBPM(bpmObjetivo) {
  bpmInterno += (bpmObjetivo - bpmInterno) * 0.04;
  state.bpm = Math.round(bpmInterno);
  if (state.audioIniciado) Tone.getTransport().bpm.value = bpmInterno;
  if (loopPlayer) loopPlayer.playbackRate = bpmInterno / LOOP_BPM_NATIVO;
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
