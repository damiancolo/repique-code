/**
 * audio.js — Motor de audio (Fase 4)
 *
 * Usa samples reales de Freesound cuando están disponibles (credits.json).
 * Cae a síntesis (MembraneSynth / MetalSynth) por categoría si no hay samples.
 * Velocity aleatoria 0.7–1.0 por golpe para humanizar.
 */

import * as Tone from 'tone';
import { state } from './state.js';

// ─── Perfil de altavoz chico (móvil) ─────────────────────────────────────────
//
// El altavoz de un teléfono prácticamente no da nada por debajo de 500 Hz. Las
// fundamentales de los acordes viven entre 130 y 260 Hz, así que en el móvil se
// oía la mitad de arriba del acorde y nada del cuerpo: fino y nasal. Con
// auriculares sonaba bien — verificado por el owner, y eso descartó la CPU.
//
// El arreglo NO cambia ninguna nota. Cambia el timbre para que la altura
// sobreviva al altavoz, aprovechando que el oído reconstruye la fundamental a
// partir de sus armónicos (la «fundamental ausente»):
//
//   1. Oscilador con más armónicos. Un triángulo los tiene muy débiles (caen
//      como 1/n²); un diente de sierra los tiene fuertes (1/n). Esos armónicos
//      caen donde el altavoz SÍ llega, y el oído deduce la nota de abajo.
//   2. Filtro más abierto, para que esos armónicos pasen en vez de cortarse.
//   3. Paso-alto: lo que el altavoz no puede reproducir no se calla solo, lo
//      hace distorsionar y ensucia todo lo demás. Mejor quitarlo antes.
export const ES_MOVIL = /Mobi|Android|iPhone|iPad|iPod/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
);

// ⚠️ El diente de sierra que había aquí se midió en dB, o sea en CUÁNTO se oye,
// y por eso funcionaba y sonaba mal a la vez: metía el triple de energía en la
// banda de 500 Hz a 2 kHz, que es justo donde el altavoz de un teléfono es más
// eficiente y más chillón. Audible, sí; áspero, también.
//
// La segunda versión puso una octava en seno encima del acorde grave. Se oía,
// pero seguía siendo estridente, y medirlo explicó por qué: en un altavoz de
// teléfono ESAS OCTAVAS ERAN LO ÚNICO AUDIBLE. Quitándolas, lo que pasa de los
// 500 Hz caía de 103 a 14. O sea que el teléfono no reproducía un acorde con
// brillo: reproducía cuatro senos pelados, sin nada de cuerpo debajo. Eso es un
// órgano electrónico barato, y de ahí lo estridente.
//
// El problema de fondo nunca fue el timbre, fue el REGISTRO. Un triángulo tiene
// armónicos que caen como 1/n², así que un acorde entre 130 y 330 Hz no aporta
// casi nada por encima de 500 y no hay timbre que lo salve.
//
// Así que se invierten las capas. En el altavoz ya se oía la octava de arriba:
// ahora esa octava ES el acorde —triángulo, con sus armónicos naturales— y el
// registro grave de siempre queda DEBAJO como apoyo, que es lo que devuelve el
// peso con auriculares. Mismo acorde, mismas notas; cambia cuál de las dos
// octavas lleva la voz cantante.
const OSC_ACORDE_MOVIL    = { type: 'triangle' };
const FILTRO_ACORDE_MOVIL = 2800;
const VOL_ACORDE_MOVIL    = -12; // la octava de arriba: la que se oye en el altavoz
const VOL_APOYO_MOVIL     = -18; // el registro de siempre, debajo: peso para auriculares
// ⚠️ La subida NO es incondicional. El tercio agudo ya viene multiplicado por 2
// desde acordes.js, y subirlo otra vez dejaba la voz de arriba en 1318 Hz: 20%
// de la energía por encima de 1 kHz, contra el 1% del mismo acorde en
// escritorio. Eso era el chillido, y no hay filtro que lo arregle — a esa altura
// no son armónicos recortables, son las notas del acorde.
// Por encima de este tope el acorde ya cae donde el altavoz llega y se deja en paz.
const TOPE_SUBIR_MOVIL = 500; // Hz, medido sobre la voz más aguda
const FILTRO_NOTA_FACTOR  = 1.6;
const PASO_ALTO_MOVIL     = 120;


// ─── Bancos de patrones (todos editables en tiempo real desde el viz) ────────
const BANCO_PATRONES = [
  // 0 · El cualca — kick 4/4, snare 2+4, hihat corcheas, perc offbeat
  {
    piano:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
    repique: [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    chico:   [1,null,1,null,   1,null,1,null,   1,null,1,null,   1,null,1,null],
    madera:  [null,null,1,null, null,null,1,null, null,null,1,null, null,null,1,null],
    bombo:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
  },
  // 1 · House — kick 4/4, hihat con bombeo (suave al tiempo, ACENTO abierto en
  // el contratiempo: el "ts" clásico), snare + clap apilados en 2 y 4
  {
    piano:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
    repique: [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    chico:   [0.45,null,1,null, 0.45,null,1,null, 0.45,null,1,null, 0.45,null,1,null],
    madera:  [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    bombo:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
  },
  // 2 · Dos pulsos — T1=T3 (kick+sub), T2=T4 (snare), hihat constante
  {
    piano:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
    repique: [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    chico:   [1,null,1,null,   1,null,1,null,   1,null,1,null,   1,null,1,null],
    madera:  [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    bombo:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
  },
  // 3 · Escalera — piano:1, repique:2, chico:3, madera:4 por cada tiempo
  {
    piano:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
    repique: [null,1,null,null, null,1,null,null, null,1,null,null, null,1,null,null],
    chico:   [null,null,1,null, null,null,1,null, null,null,1,null, null,null,1,null],
    madera:  [null,null,null,1, null,null,null,1, null,null,null,1, null,null,null,1],
    bombo:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
  },
  // 4 · Libre — patrón editable que arranca casi vacío (default al cargar)
  {
    piano:   [1,null,null,null, null,null,null,null, 1,null,null,null, null,null,null,null],
    repique: [null,null,null,null, 1,null,null,null, null,null,null,null, 1,null,null,null],
    chico:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    madera:  [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    bombo:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
  },
  // 5 · Candombe — clave 3+3+4+2+4 (5 golpes, Jure & Rocamora), chico real
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
  // 6 · Candombe real — loop grabado (dataset Jure & Rocamora, CC-BY 4.0).
  // Patrón vacío: suena el Tone.Player con la grabación, no el secuenciador.
  {
    piano:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    repique: [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    chico:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    madera:  [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
    bombo:   [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null],
  },
  // 7 · Techno — kick+bombo pesados en los 4 tiempos, hihat en contratiempo,
  // ticks suaves de semicorchea, clap escaso al final de la frase
  {
    piano:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
    repique: [null,null,null,null, null,null,null,null, null,null,null,null, 1,null,null,0.6],
    chico:   [null,null,1,null, null,null,1,null, null,null,1,null, null,null,1,null],
    madera:  [null,0.4,null,0.4, null,0.4,null,0.4, null,0.4,null,0.4, null,0.4,null,0.4],
    bombo:   [1,null,null,null, 1,null,null,null, 1,null,null,null, 1,null,null,null],
  },
];

const CANDOMBE_IDX      = 5;
export const CANDOMBE_REAL_IDX = 6;

let ritmoActual = 5; // arranca en CANDOMByte

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

// ─── Clave de madera (candombe) — woodblock sintetizado ─────────────────────
// Los samples de Freesound no convencieron (clap, claves genéricas) — síntesis
// controlada: "toc" muy corto, seco y agudo, de palo sobre el casco del tambor
const synthClave = new Tone.MembraneSynth({
  pitchDecay: 0.004,
  octaves: 1.2,
  envelope: { attack: 0.0005, decay: 0.05, sustain: 0, release: 0.02 },
  volume: 5,
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

// ─── Sonidos de gestos de baile (estética The Blaze: aire, espacio, sub) ─────
// Bus compartido: delay con feedback → reverb grande → master
const fxDelay = new Tone.FeedbackDelay('8n.', 0.3);
fxDelay.wet.value = 0.24;
const fxVerb = new Tone.Freeverb({ roomSize: 0.88, dampening: 1900 });
fxVerb.wet.value = 0.42;
fxDelay.connect(fxVerb);

// 1 · Drop descendente (mano izquierda cae): ruido + filtro cayendo + zap
const dropFilter = new Tone.Filter({ type: 'lowpass', frequency: 8000, Q: 10 });
const dropNoise = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.005, decay: 0.55, sustain: 0, release: 0.1 },
  volume: -12,
});
const dropZap = new Tone.Synth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.1 },
  volume: -13,
});
dropNoise.connect(dropFilter);
dropZap.connect(dropFilter);
dropFilter.connect(fxDelay);

export function efectoTechnoDrop(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('drop');
  const now = time ?? Tone.now();
  // Whoosh descendente de ruido (la tensión antes del impacto)
  dropFilter.frequency.cancelScheduledValues(now);
  dropFilter.frequency.setValueAtTime(9000, now);
  dropFilter.frequency.exponentialRampToValueAtTime(180, now + 0.5);
  dropNoise.triggerAttackRelease(0.45, now);
  // El drop ATERRIZA en la raíz del acorde: sierra que cae hasta la nota + sub
  const rootHz = Tone.Frequency(_acordeRoot()).transpose(-12).toFrequency();
  dropZap.triggerAttackRelease(rootHz * 4, 0.5, now);
  dropZap.frequency.exponentialRampToValueAtTime(rootHz, now + 0.42);
  impactSub.triggerAttackRelease(
    Tone.Frequency(_acordeRoot()).transpose(-24).toNote(), '4n', now + 0.3, 0.45);
}

// 2 · Riser (mano derecha sube): ruido + bandpass subiendo + tono ascendente
const riserFilter = new Tone.Filter({ type: 'bandpass', frequency: 300, Q: 3 });
const riserNoise = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.25, decay: 0.55, sustain: 0, release: 0.2 },
  volume: -9,
});
const riserTone = new Tone.Synth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.05, decay: 0.7, sustain: 0, release: 0.15 },
  volume: -13,
});
riserNoise.connect(riserFilter);
riserTone.connect(riserFilter);
riserFilter.connect(fxDelay);

export function efectoRiser(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('riser');
  const now = time ?? Tone.now();
  riserFilter.frequency.cancelScheduledValues(now);
  riserFilter.frequency.setValueAtTime(250, now);
  riserFilter.frequency.exponentialRampToValueAtTime(7500, now + 0.8);
  riserNoise.triggerAttackRelease(0.8, now);
  riserTone.triggerAttackRelease(140, 0.8, now);
  riserTone.frequency.exponentialRampToValueAtTime(880, now + 0.75);
}

// 3 · Stab de acorde (manos se separan): fatsaw cálido, menor con novena,
// rotando por una progresión emotiva — el sello The Blaze
const stabSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
  envelope: { attack: 0.012, decay: 0.42, sustain: 0.12, release: 0.9 },
  volume: -10,
});
const stabFilter = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 1 });
stabSynth.connect(stabFilter);
stabFilter.connect(fxDelay);
const STAB_CHORDS = [
  ['A3', 'C4', 'E4', 'B4'],   // Am add9
  ['F3', 'A3', 'C4', 'G4'],   // F add9
  ['C4', 'Eb4', 'G4', 'D5'],  // Cm add9
  ['G3', 'Bb3', 'D4', 'A4'],  // Gm add9
];
let _stabIdx = 0;
// Familia de registro: transpone TODAS las notas de los gestos a otra octava.
// 0 = normal · -12 = grave (una octava abajo) · +12 = aguda (una octava arriba).
// Son las MISMAS notas en otro registro, conmutables con un botón del panel.
const _familiaSemis = 0; // las familias ya no transponen: cada una trae sus timbres
function _fam(nota) { return _familiaSemis ? Tone.Frequency(nota).transpose(_familiaSemis).toNote() : nota; }
// Acorde actual de la progresión, ya con la familia aplicada
function _acordeNotas() { return STAB_CHORDS[_stabIdx].map(_fam); }
// Raíz del acorde actual (con familia) — afina los efectos tonales al groove
function _acordeRoot() { return _fam(STAB_CHORDS[_stabIdx][0]); }

export function efectoStab(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('stab');
  stabSynth.triggerAttackRelease(_acordeNotas(), '8n', time);
  _stabIdx = (_stabIdx + 1) % STAB_CHORDS.length;
}

// 5 · Arpegio pluck ascendente (mano izquierda sube) — usa el acorde actual
// de la progresión, una octava arriba: siempre suena afinado con los stabs
const arpSynth = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.12 },
  volume: -12,
});
arpSynth.connect(fxDelay);

export function efectoArpegio(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('arp');
  const now = time ?? Tone.now();
  const notas = _acordeNotas().map(n => Tone.Frequency(n).transpose(12).toNote());
  notas.forEach((nota, i) => arpSynth.triggerAttackRelease(nota, '16n', now + i * 0.07));
}

// 6 · Acid blip (mano derecha cae): squelch tipo TB-303 — sierra resonante con
// envolvente de filtro rápida, afinado a la raíz del acorde actual, con eco
const acidSynth = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  filter: { type: 'lowpass', rolloff: -24, Q: 7 },
  envelope: { attack: 0.005, decay: 0.22, sustain: 0, release: 0.12 },
  filterEnvelope: {
    attack: 0.005, decay: 0.2, sustain: 0.05, release: 0.12,
    baseFrequency: 220, octaves: 4.5, exponent: 2,
  },
  volume: -7,
});
acidSynth.connect(fxDelay);

export function efectoLaser(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('laser');
  const nota = Tone.Frequency(_acordeRoot()).transpose(12).toNote(); // raíz +1 octava
  acidSynth.triggerAttackRelease(nota, '8n', time);
}

// 7 · Shimmer celestial (las dos manos al cielo): pad brillante de ataque
// lento en registro alto, el acorde actual flotando en la reverb
const shimmer = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsine', count: 3, spread: 18 },
  envelope: { attack: 0.5, decay: 1.4, sustain: 0.18, release: 2.4 },
  volume: -12,
});
shimmer.connect(fxDelay);

export function efectoShimmer(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('shimmer');
  const notas = _acordeNotas().map(n => Tone.Frequency(n).transpose(24).toNote());
  shimmer.triggerAttackRelease(notas, '2n', time);
}

// 4 · Reese sub (manos se juntan): bajo electrónico sostenido y detunado a la
// raíz del acorde + sub sinusoidal de refuerzo + soplo de aire en la reverb.
// Antes era un boom 808 seco (golpe); ahora es un bajo de música electrónica.
const reeseBass = new Tone.MonoSynth({
  oscillator: { type: 'fatsawtooth', count: 2, spread: 32 },
  filter: { type: 'lowpass', rolloff: -24, Q: 2 },
  envelope: { attack: 0.012, decay: 0.5, sustain: 0.35, release: 0.6 },
  filterEnvelope: {
    attack: 0.02, decay: 0.5, sustain: 0.25, release: 0.5,
    baseFrequency: 90, octaves: 3.2, exponent: 2,
  },
  volume: -9,
});
reeseBass.connect(fxDelay);
const impactSub = new Tone.MembraneSynth({
  pitchDecay: 0.12, octaves: 4,
  envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.4 },
  volume: 3,
});
const impactAir = new Tone.NoiseSynth({
  noise: { type: 'pink' },
  envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
  volume: -12,
});
impactAir.connect(fxDelay);

export function efectoImpacto(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('impacto');
  const sub  = Tone.Frequency(_acordeRoot()).transpose(-24).toNote(); // raíz −2 oct
  const bajo = Tone.Frequency(_acordeRoot()).transpose(-12).toNote(); // raíz −1 oct
  reeseBass.triggerAttackRelease(bajo, '4n', time);
  impactSub.triggerAttackRelease(sub, '2n', time);
  impactAir.triggerAttackRelease(0.3, time);
}

// 8 · Pluck melódico con delay (swipe horizontal de la mano derecha): nota
// brillante de la 3.ª del acorde, una octava arriba, rebotando en el delay
// punteado del bus — el "topline" de festival
const pluckSynth = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.25 },
  volume: -6,
});
const pluckShaper = new Tone.Filter({ type: 'highpass', frequency: 300 });
pluckSynth.connect(pluckShaper);
pluckShaper.connect(fxDelay);

export function efectoPluck(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('pluck');
  const nota = Tone.Frequency(_acordeNotas()[1]).transpose(12).toNote();
  pluckSynth.triggerAttackRelease(nota, '16n', time);
}

// 9 · Uplifter / sweep (swipe horizontal de la mano izquierda): barrido de ruido
// con bandpass subiendo — la transición "whoosh" clásica del EDM
const sweepNoise = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.18, decay: 0.32, sustain: 0, release: 0.12 },
  volume: -15,
});
const sweepFilter = new Tone.Filter({ type: 'bandpass', frequency: 400, Q: 2 });
sweepNoise.connect(sweepFilter);
sweepFilter.connect(fxDelay);

export function efectoSweep(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('sweep');
  const now = time ?? Tone.now();
  sweepFilter.frequency.cancelScheduledValues(now);
  sweepFilter.frequency.setValueAtTime(350, now);
  sweepFilter.frequency.exponentialRampToValueAtTime(8500, now + 0.45);
  sweepNoise.triggerAttackRelease(0.45, now);
}

// 10 · Escalerita (las dos manos suben o bajan juntas): corrida veloz de notas
// en La menor pentatónica (pega con toda la progresión). Dos manos hacia ARRIBA
// = ascendente; hacia ABAJO = descendente. Sierra con eco, tipo riff de synth.
const ESCALERA_NOTAS = ['A2','C3','D3','E3','G3','A3','C4','D4','E4','G4','A4','C5'];
const escaleraSynth = new Tone.Synth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.1 },
  volume: -9,
});
const escaleraFiltro = new Tone.Filter({ type: 'lowpass', frequency: 3200, Q: 1 });
escaleraSynth.connect(escaleraFiltro);
escaleraFiltro.connect(fxDelay);

function _runEscalera(sube, time) {
  const now = time ?? Tone.now();
  const N = 8;
  for (let i = 0; i < N; i++) {
    const idx = sube ? i : (N - 1 - i);
    escaleraSynth.triggerAttackRelease(_fam(ESCALERA_NOTAS[idx]), '16n', now + i * 0.055);
  }
}

export function efectoEscaleraSube(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('escaleraSube');
  _runEscalera(true, time);
}

export function efectoEscaleraBaja(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('escaleraBaja');
  _runEscalera(false, time);
}

// ─── Biblioteca extra de one-shots (sintetizados, para asignar a gestos) ─────
// Bus "seco" para la percusión: va al master sin la reverb grande del bus de gestos
const sfxDry = new Tone.Gain(0.9);

const sfxKickSynth = new Tone.MembraneSynth({
  pitchDecay: 0.05, octaves: 6,
  envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.2 },
  volume: 4,
});
sfxKickSynth.connect(sfxDry);
export function sfxKick(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('kick');
  sfxKickSynth.triggerAttackRelease(_fam('C1'), '8n', time);
}

const sfxClapNoise = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.04 },
  volume: -6,
});
const sfxClapFilter = new Tone.Filter({ type: 'bandpass', frequency: 1400, Q: 1.2 });
sfxClapNoise.connect(sfxClapFilter);
sfxClapFilter.connect(sfxDry);
export function sfxClap(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('clap');
  sfxClapNoise.triggerAttackRelease(0.16, time);
}

const sfxHatSynth = new Tone.MetalSynth({
  frequency: 320,
  envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
  harmonicity: 5.1, modulationIndex: 32, resonance: 7000, octaves: 1.2,
  volume: -14,
});
const sfxHatFilter = new Tone.Filter({ type: 'highpass', frequency: 7000 });
sfxHatSynth.connect(sfxHatFilter);
sfxHatFilter.connect(sfxDry);
export function sfxHat(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('hat');
  sfxHatSynth.triggerAttackRelease('16n', time);
}

const sfxSnareNoise = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
  volume: -8,
});
const sfxSnareFilter = new Tone.Filter({ type: 'highpass', frequency: 1200 });
sfxSnareNoise.connect(sfxSnareFilter);
sfxSnareFilter.connect(sfxDry);
const sfxSnareBody = new Tone.MembraneSynth({
  pitchDecay: 0.03, octaves: 3,
  envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
  volume: -4,
});
sfxSnareBody.connect(sfxDry);
export function sfxSnare(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('snare');
  sfxSnareBody.triggerAttackRelease(_fam('G2'), '16n', time);
  sfxSnareNoise.triggerAttackRelease(0.2, time);
}

const sfxCowbellSynth = new Tone.MetalSynth({
  frequency: 560,
  envelope: { attack: 0.001, decay: 0.18, release: 0.05 },
  harmonicity: 3.4, modulationIndex: 20, resonance: 3500, octaves: 0.8,
  volume: -12,
});
sfxCowbellSynth.connect(sfxDry);
export function sfxCowbell(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('cowbell');
  sfxCowbellSynth.triggerAttackRelease('8n', time);
}

const sfxTomSynth = new Tone.MembraneSynth({
  pitchDecay: 0.06, octaves: 4,
  envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
  volume: 2,
});
sfxTomSynth.connect(sfxDry);
export function sfxTom(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('tom');
  sfxTomSynth.triggerAttackRelease(_fam('A2'), '8n', time);
}

const sfxRimSynth = new Tone.MembraneSynth({
  pitchDecay: 0.008, octaves: 1,
  envelope: { attack: 0.0005, decay: 0.04, sustain: 0, release: 0.02 },
  volume: 0,
});
sfxRimSynth.connect(sfxDry);
export function sfxRim(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('rim');
  sfxRimSynth.triggerAttackRelease(_fam('E4'), '32n', time);
}

const sfxSubSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.4 },
  volume: 0,
});
sfxSubSynth.connect(sfxDry);
export function sfxSub(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('sub');
  const nota = Tone.Frequency(_acordeRoot()).transpose(-12).toNote();
  sfxSubSynth.triggerAttackRelease(nota, '8n', time);
}

const sfxBellSynth = new Tone.FMSynth({
  harmonicity: 3.01, modulationIndex: 14,
  oscillator: { type: 'sine' }, modulation: { type: 'sine' },
  envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.4 },
  modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
  volume: -10,
});
sfxBellSynth.connect(fxDelay);
export function sfxBell(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('bell');
  const nota = Tone.Frequency(_acordeRoot()).transpose(12).toNote();
  sfxBellSynth.triggerAttackRelease(nota, '4n', time);
}

const sfxZapSynth = new Tone.Synth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.06 },
  volume: -10,
});
sfxZapSynth.connect(fxDelay);
export function sfxZap(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('zap');
  const now = time ?? Tone.now();
  const root = Tone.Frequency(_acordeRoot()).toFrequency();
  sfxZapSynth.triggerAttackRelease(root * 4, 0.18, now);
  sfxZapSynth.frequency.exponentialRampToValueAtTime(root, now + 0.16);
}

const sfxChordSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.02, decay: 0.4, sustain: 0.25, release: 0.8 },
  volume: -14,
});
sfxChordSynth.connect(fxDelay);
export function sfxChord(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('chord');
  sfxChordSynth.triggerAttackRelease(_acordeNotas(), '4n', time);
}

// ═══ Familia GRAVE = "Mate" — ÓRGANO DE IGLESIA ELECTRÓNICO / ESPACIAL ═══════
// Cada gesto dispara una NOTA FIJA de la escala (Do Re Mi Fa Sol La Si Do), para
// que sea identificable y se pueda "tocar" una melodía. Timbre: fatsine cálido
// (órgano) + una capa de octava suave (brillo electrónico), con la reverb/delay
// grande del bus = sensación espacial.
const organSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsine', count: 2, spread: 9 }, // menos batido = timbre más limpio
  envelope: { attack: 0.03, decay: 0.22, sustain: 0.55, release: 0.7 }, // menos sustain = los acordes no se apilan
  volume: -7, // nivel sano: la dinámica del master da presencia sin saturar
});
const organHi = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsine', count: 1, spread: 0 }, // octava de brillo, sine puro y limpio
  envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
  volume: -16,
});
const organFilter = new Tone.Filter({ type: 'lowpass', frequency: 3000 });
organSynth.connect(organFilter);
organHi.connect(organFilter);
// Va por DOS vías con niveles controlados: seca (presencia) + un send BAJO de reverb
// para el aire espacial sin que la cola se acumule en un "wash" saturado.
const organDry  = new Tone.Gain(0.7);
const organVerb = new Tone.Gain(0.22);
organFilter.connect(organDry);  organDry.connect(sfxDry);
organFilter.connect(organVerb); organVerb.connect(fxDelay);

// Toca la nota en el órgano + su octava suave (brillo). nota = ej. 'C3'
function _organNota(nota, time) {
  const now = time ?? Tone.now();
  organSynth.triggerAttackRelease(nota, '4n', now);
  organHi.triggerAttackRelease(Tone.Frequency(nota).transpose(12).toNote(), '4n', now);
}

export function gDo(time)  { if (!state.audioIniciado) return; if (time === undefined) _registrarFx('gDo');  _organNota('C3', time); }
export function gRe(time)  { if (!state.audioIniciado) return; if (time === undefined) _registrarFx('gRe');  _organNota('D3', time); }
export function gMi(time)  { if (!state.audioIniciado) return; if (time === undefined) _registrarFx('gMi');  _organNota('E3', time); }
export function gFa(time)  { if (!state.audioIniciado) return; if (time === undefined) _registrarFx('gFa');  _organNota('F3', time); }
export function gSol(time) { if (!state.audioIniciado) return; if (time === undefined) _registrarFx('gSol'); _organNota('G3', time); }
export function gLa(time)  { if (!state.audioIniciado) return; if (time === undefined) _registrarFx('gLa');  _organNota('A3', time); }
export function gSi(time)  { if (!state.audioIniciado) return; if (time === undefined) _registrarFx('gSi');  _organNota('B3', time); }
export function gDo2(time) { if (!state.audioIniciado) return; if (time === undefined) _registrarFx('gDo2'); _organNota('C4', time); }

// Efectos de Mate (mismo órgano espacial): acordes y corridas de la escala
function _organAcorde(notas, dur, time) {
  const now = time ?? Tone.now();
  organSynth.triggerAttackRelease(notas, dur, now);
  organHi.triggerAttackRelease(notas.map(n => Tone.Frequency(n).transpose(12).toNote()), dur, now);
}
const ESCALA_ORGANO = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'];
function _organRun(sube, time) {
  const now = time ?? Tone.now();
  for (let i = 0; i < ESCALA_ORGANO.length; i++) {
    const nota = sube ? ESCALA_ORGANO[i] : ESCALA_ORGANO[ESCALA_ORGANO.length - 1 - i];
    organSynth.triggerAttackRelease(nota, '16n', now + i * 0.06);
  }
}
export function gAcordeDo(time) { // acorde de Do mayor (C-E-G)
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('gAcordeDo');
  _organAcorde(['C3', 'E3', 'G3'], '2n', time);
}
export function gPadOrgano(time) { // pad sostenido (para "al cielo")
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('gPadOrgano');
  _organAcorde(['C3', 'G3', 'C4', 'E4'], '1n', time);
}
export function gOrganoSube(time) { // corrida ascendente de la escala
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('gOrganoSube');
  _organRun(true, time);
}
export function gOrganoBaja(time) { // corrida descendente
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('gOrganoBaja');
  _organRun(false, time);
}
export function gOrganoHit(time) { // ARMONÍA: acorde de Do mayor amplio y sostenido
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('gOrganoHit');
  _organAcorde(['C3', 'E3', 'G3', 'C4', 'E4'], '2n', time);
}

// ═══ Familia AGUDA — timbres brillantes, cristalinos, altos ══════════════════
const aBellSynth = new Tone.FMSynth({
  harmonicity: 3.5, modulationIndex: 12,
  oscillator: { type: 'sine' }, modulation: { type: 'sine' },
  envelope: { attack: 0.001, decay: 1, sustain: 0, release: 1.2 },
  modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 }, volume: -9,
});
aBellSynth.connect(fxDelay);
export function aBell(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('aBell');
  aBellSynth.triggerAttackRelease(Tone.Frequency(_acordeRoot()).transpose(24).toNote(), '4n', time);
}

const aGlassSynth = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 }, volume: -7,
});
const aGlassHP = new Tone.Filter({ type: 'highpass', frequency: 600 });
aGlassSynth.connect(aGlassHP);
aGlassHP.connect(fxDelay);
export function aGlass(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('aGlass');
  aGlassSynth.triggerAttackRelease(Tone.Frequency(_acordeNotas()[1]).transpose(24).toNote(), '16n', time);
}

const aChimeSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.2 }, volume: -9,
});
aChimeSynth.connect(fxDelay);
export function aChime(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('aChime');
  const now = time ?? Tone.now();
  const notas = _acordeNotas().map(n => Tone.Frequency(n).transpose(24).toNote());
  notas.forEach((n, i) => aChimeSynth.triggerAttackRelease(n, '32n', now + i * 0.05));
}

const aSparkSynth = new Tone.MetalSynth({
  frequency: 800,
  envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
  harmonicity: 8, modulationIndex: 40, resonance: 9000, octaves: 1.5, volume: -16,
});
aSparkSynth.connect(fxDelay);
export function aSpark(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('aSpark');
  aSparkSynth.triggerAttackRelease('16n', time);
}

const aBlipSynth = new Tone.MonoSynth({
  oscillator: { type: 'square' },
  filter: { type: 'lowpass', Q: 6 },
  envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.08 },
  filterEnvelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.08, baseFrequency: 800, octaves: 3 },
  volume: -10,
});
aBlipSynth.connect(fxDelay);
export function aBlip(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('aBlip');
  aBlipSynth.triggerAttackRelease(Tone.Frequency(_acordeRoot()).transpose(24).toNote(), '16n', time);
}

const aCrystalSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsine', count: 2, spread: 12 },
  envelope: { attack: 0.005, decay: 0.6, sustain: 0.1, release: 0.8 }, volume: -14,
});
aCrystalSynth.connect(fxDelay);
export function aCrystal(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('aCrystal');
  const notas = _acordeNotas().map(n => Tone.Frequency(n).transpose(24).toNote());
  aCrystalSynth.triggerAttackRelease(notas, '2n', time);
}

const aZapHiSynth = new Tone.Synth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }, volume: -12,
});
aZapHiSynth.connect(fxDelay);
export function aZapHi(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('aZapHi');
  const now = time ?? Tone.now();
  const root = Tone.Frequency(_acordeRoot()).transpose(24).toFrequency();
  aZapHiSynth.triggerAttackRelease(root, 0.12, now);
  aZapHiSynth.frequency.exponentialRampToValueAtTime(root * 3, now + 0.1);
}

// ═══ Familia VÍNCULOS — las voces de sinte de la obra Vínculos ═══════════════
// Seis timbres etéreos/espaciales (igual idea que estudioprompt.com/vinculos):
// cristal, gota, hálito, pulso, sónar, vidrio. Tonales al acorde del groove y con
// mucha reverb (fxDelay → fxVerb) para el aire cósmico.

// Cristal — campana FM cristalina, larga y luminosa
const vCristalSynth = new Tone.FMSynth({
  harmonicity: 2, modulationIndex: 14,
  oscillator: { type: 'sine' }, modulation: { type: 'sine' },
  envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.4 },
  modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.4 }, volume: -8,
});
vCristalSynth.connect(fxDelay);
export function vCristal(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('vCristal');
  vCristalSynth.triggerAttackRelease(Tone.Frequency(_acordeRoot()).transpose(24).toNote(), '2n', time);
}

// Gota — pulsación de triángulo que cae de tono, tipo kalimba
const vGotaSynth = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.3 }, volume: -7,
});
vGotaSynth.connect(fxDelay);
export function vGota(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('vGota');
  const now = time ?? Tone.now();
  const f = Tone.Frequency(_acordeNotas()[1]).transpose(12).toFrequency();
  vGotaSynth.triggerAttackRelease(f * 1.5, '8n', now);
  vGotaSynth.frequency.exponentialRampToValueAtTime(f, now + 0.08);
}

// Hálito — pad aireado de sierras filtradas que crece y se disuelve
const vHalitoSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
  envelope: { attack: 0.6, decay: 0.3, sustain: 0.5, release: 1.8 }, volume: -18,
});
const vHalitoLP = new Tone.Filter({ type: 'lowpass', frequency: 1400, Q: 2 });
vHalitoSynth.connect(vHalitoLP);
vHalitoLP.connect(fxDelay);
export function vHalito(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('vHalito');
  const notas = _acordeNotas().map(n => Tone.Frequency(n).transpose(12).toNote());
  vHalitoSynth.triggerAttackRelease(notas, '1n', time);
}

// Pulso — blip cuadrado retro con eco de octava
const vPulsoSynth = new Tone.Synth({
  oscillator: { type: 'square' },
  envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.1 }, volume: -14,
});
const vPulsoLP = new Tone.Filter({ type: 'lowpass', frequency: 2400 });
vPulsoSynth.connect(vPulsoLP);
vPulsoLP.connect(fxDelay);
export function vPulso(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('vPulso');
  const now = time ?? Tone.now();
  const f = Tone.Frequency(_acordeRoot()).transpose(24).toFrequency();
  vPulsoSynth.triggerAttackRelease(f, '16n', now);
  vPulsoSynth.triggerAttackRelease(f * 2, '32n', now + 0.11);
}

// Sónar — sine que cae de tono con cola larga, profundidad de sonda
const vSonarSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 2.4 }, volume: -7,
});
vSonarSynth.connect(fxDelay);
export function vSonar(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('vSonar');
  const now = time ?? Tone.now();
  const f = Tone.Frequency(_acordeRoot()).transpose(12).toFrequency();
  vSonarSynth.triggerAttackRelease(f, '2n', now);
  vSonarSynth.frequency.exponentialRampToValueAtTime(f * 0.5, now + 1.6);
}

// Vidrio — dos sines con leve vibrato, sostenido y vítreo
const vVidrioSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsine', count: 2, spread: 8 },
  envelope: { attack: 0.04, decay: 0.4, sustain: 0.3, release: 1.6 }, volume: -12,
});
const vVidrioVib = new Tone.Vibrato({ frequency: 5.5, depth: 0.12 });
vVidrioSynth.connect(vVidrioVib);
vVidrioVib.connect(fxDelay);
export function vVidrio(time) {
  if (!state.audioIniciado) return;
  if (time === undefined) _registrarFx('vVidrio');
  const notas = [_acordeNotas()[0], _acordeNotas()[2]].map(n => Tone.Frequency(n).transpose(24).toNote());
  vVidrioSynth.triggerAttackRelease(notas, '2n', time);
}

// ─── Looper de efectos de baile ──────────────────────────────────────────────
// Graba CUÁNDO se disparó cada efecto durante un compás (no el audio) y lo
// reprograma en un Tone.Part que loopea cada compás, cuantizado a la grilla de
// 16n del secuenciador → los efectos quedan sonando "en clave" con el ritmo.
//
// Estados: idle → armado (espera el próximo downbeat) → rec (graba 1 compás)
//          → loop (reproduce). Volver a tocar el botón en cualquier estado = idle.
//
// El registro solo ocurre en disparos EN VIVO (time === undefined): el replay
// pasa un `time` agendado, así nunca se auto-graba (no hay bucle infinito).

const FX_FUNCS = {
  drop:    efectoTechnoDrop,
  riser:   efectoRiser,
  stab:    efectoStab,
  arp:     efectoArpegio,
  laser:   efectoLaser,
  shimmer: efectoShimmer,
  impacto: efectoImpacto,
  pluck:   efectoPluck,
  sweep:   efectoSweep,
  escaleraSube: efectoEscaleraSube,
  escaleraBaja: efectoEscaleraBaja,
  kick: sfxKick, clap: sfxClap, hat: sfxHat, snare: sfxSnare,
  cowbell: sfxCowbell, tom: sfxTom, rim: sfxRim, sub: sfxSub,
  bell: sfxBell, zap: sfxZap, chord: sfxChord,
  gDo: gDo, gRe: gRe, gMi: gMi, gFa: gFa, gSol: gSol, gLa: gLa, gSi: gSi, gDo2: gDo2,
  gAcordeDo: gAcordeDo, gPadOrgano: gPadOrgano, gOrganoSube: gOrganoSube,
  gOrganoBaja: gOrganoBaja, gOrganoHit: gOrganoHit,
  aBell: aBell, aGlass: aGlass, aChime: aChime, aSpark: aSpark,
  aBlip: aBlip, aCrystal: aCrystal, aZapHi: aZapHi,
  vCristal: vCristal, vGota: vGota, vHalito: vHalito,
  vPulso: vPulso, vSonar: vSonar, vVidrio: vVidrio,
};

const COMPASES_LOOP = 2;        // graba 2 compases enteros

let _looperEstado   = 'idle';   // 'idle' | 'armado' | 'rec' | 'loop'
let _grabados       = [];       // [{ nombre, tick }] relativos a _recInicioTick
let _recInicioTick  = 0;
let _looperPart     = null;
let _looperGen      = 0;        // invalida callbacks pendientes al parar/re-armar
let _onLooperEstado = null;     // callback para la UI

function _setEstado(e) {
  _looperEstado = e;
  _onLooperEstado?.(e);
}

// El PRIMER efecto define el arranque: la grabación empieza en el downbeat del
// compás donde cae ese primer efecto y dura COMPASES_LOOP compases enteros.
// En estado 'armado' esperamos sin límite hasta ese primer efecto.
function _registrarFx(nombre) {
  const T = Tone.getTransport();
  if (_looperEstado === 'armado') {
    const ticksCompas = T.PPQ * 4;
    _recInicioTick = Math.floor(T.ticks / ticksCompas) * ticksCompas;
    const gen = _looperGen;
    _setEstado('rec');
    T.scheduleOnce(() => _cerrarGrabacion(gen),
                   (_recInicioTick + ticksCompas * COMPASES_LOOP) + 'i');
  }
  if (_looperEstado !== 'rec') return;
  _grabados.push({ nombre, tick: T.ticks - _recInicioTick });
}

function _cerrarGrabacion(gen) {
  if (gen !== _looperGen || _looperEstado !== 'rec') return;
  if (_grabados.length === 0) { _setEstado('idle'); return; }
  const T = Tone.getTransport();
  const ticksLoop = T.PPQ * 4 * COMPASES_LOOP;
  const ticks16n  = (T.PPQ * 4) / 16;
  const eventos = _grabados.map(g => {
    const q = Math.round(g.tick / ticks16n) * ticks16n;       // cuantiza a 16n
    const enLoop = ((q % ticksLoop) + ticksLoop) % ticksLoop;
    return { time: enLoop + 'i', nombre: g.nombre };
  });
  const part = new Tone.Part((time, ev) => {
    FX_FUNCS[ev.nombre]?.(time);          // pasa time → agenda en grilla, no re-graba
  }, eventos);
  part.loop    = true;
  part.loopEnd = COMPASES_LOOP + 'm';
  // arranca justo donde terminó la grabación → loop sin silencio intermedio
  part.start((_recInicioTick + ticksLoop) + 'i');
  _looperPart = part;
  _setEstado('loop');
}

export function armarLooper() {
  if (!state.audioIniciado || _looperEstado !== 'idle') return;
  _looperGen++;
  _grabados = [];
  _recInicioTick = 0;
  _setEstado('armado');                   // espera (sin límite) al primer efecto
}

export function pararLooper() {
  _looperGen++;                           // cancela callbacks armado/rec pendientes
  if (_looperPart) { _looperPart.stop(); _looperPart.dispose(); _looperPart = null; }
  _grabados = [];
  if (_looperEstado !== 'idle') _setEstado('idle');
}

export function onLooperEstado(cb) { _onLooperEstado = cb; }
export function getLooperEstado()  { return _looperEstado; }

// ─── Familias de sonidos + mapeo de gestos del baile ─────────────────────────
// Tres familias, cada una con su PROPIA paleta de timbres y su mapeo por gesto:
//   · crazy  → los efectos electrónicos originales
//   · grave  → timbres oscuros, sub-graves
//   · aguda  → timbres brillantes, cristalinos
// El usuario elige familia con un botón y, dentro de cada una, qué sonido dispara
// cada gesto. Los gestos llaman dispararGesto(slot) → resuelve vía FX_FUNCS, así
// el looper sigue grabando/replayando por id de sonido sin cambios.
export const FAMILIAS = [
  { id: 'crazy', nombre: 'Crazy' },
  { id: 'grave', nombre: 'Mate' },
  { id: 'aguda', nombre: 'Butiá' },
  { id: 'vinculos', nombre: 'Vínculos' },
];

export const BIBLIOTECAS = {
  crazy: [
    { id: 'drop',         nombre: 'Drop',        emoji: '🌊' },
    { id: 'riser',        nombre: 'Riser',       emoji: '🚀' },
    { id: 'arp',          nombre: 'Arpegio',     emoji: '🎶' },
    { id: 'laser',        nombre: 'Láser acid',  emoji: '⚡' },
    { id: 'stab',         nombre: 'Stab acorde', emoji: '🎹' },
    { id: 'impacto',      nombre: 'Reese sub',   emoji: '💥' },
    { id: 'shimmer',      nombre: 'Shimmer',     emoji: '✨' },
    { id: 'pluck',        nombre: 'Pluck',       emoji: '🪕' },
    { id: 'sweep',        nombre: 'Sweep',       emoji: '🌬' },
    { id: 'escaleraSube', nombre: 'Escalera ↑',  emoji: '🪜' },
    { id: 'escaleraBaja', nombre: 'Escalera ↓',  emoji: '🪜' },
    { id: 'kick',         nombre: 'Kick 808',    emoji: '🥁' },
    { id: 'clap',         nombre: 'Clap',        emoji: '👏' },
    { id: 'hat',          nombre: 'Hi-hat',      emoji: '🎩' },
    { id: 'snare',        nombre: 'Snare',       emoji: '🪘' },
    { id: 'cowbell',      nombre: 'Cowbell',     emoji: '🔔' },
    { id: 'tom',          nombre: 'Tom',         emoji: '🛢' },
    { id: 'rim',          nombre: 'Rimshot',     emoji: '🥢' },
    { id: 'sub',          nombre: 'Sub bass',    emoji: '🔉' },
    { id: 'bell',         nombre: 'Campana',     emoji: '🛎' },
    { id: 'zap',          nombre: 'Zap',         emoji: '🔫' },
    { id: 'chord',        nombre: 'Pad acorde',  emoji: '🌈' },
  ],
  grave: [
    { id: 'gDo',  nombre: 'Do',  emoji: '🎹' },
    { id: 'gRe',  nombre: 'Re',  emoji: '🎹' },
    { id: 'gMi',  nombre: 'Mi',  emoji: '🎹' },
    { id: 'gFa',  nombre: 'Fa',  emoji: '🎹' },
    { id: 'gSol', nombre: 'Sol', emoji: '🎹' },
    { id: 'gLa',  nombre: 'La',  emoji: '🎹' },
    { id: 'gSi',  nombre: 'Si',  emoji: '🎹' },
    { id: 'gDo2', nombre: 'Do↑', emoji: '🎹' },
    { id: 'gAcordeDo',  nombre: 'Do mayor',  emoji: '🎶' },
    { id: 'gOrganoSube', nombre: 'Órgano ↑', emoji: '⬆️' },
    { id: 'gOrganoBaja', nombre: 'Órgano ↓', emoji: '⬇️' },
    { id: 'gOrganoHit',  nombre: 'Armonía',  emoji: '👏' },
    { id: 'gPadOrgano',  nombre: 'Pad',      emoji: '🌫' },
  ],
  aguda: [
    { id: 'aBell',    nombre: 'Campana',    emoji: '🛎' },
    { id: 'aGlass',   nombre: 'Vidrio',     emoji: '🔷' },
    { id: 'aChime',   nombre: 'Carillón',   emoji: '🎐' },
    { id: 'aSpark',   nombre: 'Chispa',     emoji: '✨' },
    { id: 'aBlip',    nombre: 'Blip',       emoji: '💠' },
    { id: 'aCrystal', nombre: 'Cristal',    emoji: '❄️' },
    { id: 'aZapHi',   nombre: 'Zap agudo',  emoji: '⚡' },
  ],
  vinculos: [
    { id: 'vCristal', nombre: 'Cristal', emoji: '🔆' },
    { id: 'vGota',    nombre: 'Gota',    emoji: '💧' },
    { id: 'vHalito',  nombre: 'Hálito',  emoji: '🌌' },
    { id: 'vPulso',   nombre: 'Pulso',   emoji: '🛰' },
    { id: 'vSonar',   nombre: 'Sónar',   emoji: '🔊' },
    { id: 'vVidrio',  nombre: 'Vidrio',  emoji: '🪟' },
  ],
};

// Las "ranuras": cada gesto del baile
export const GESTOS_BAILE = [
  { slot: 'derSube',    nombre: 'Der. sube ↑' },
  { slot: 'derCae',     nombre: 'Der. cae ↓' },
  { slot: 'derDer',     nombre: 'Der. → a la derecha' },
  { slot: 'derIzq',     nombre: 'Der. → a la izquierda' },
  { slot: 'izqSube',    nombre: 'Izq. sube ↑' },
  { slot: 'izqCae',     nombre: 'Izq. cae ↓' },
  { slot: 'izqDer',     nombre: 'Izq. → a la derecha' },
  { slot: 'izqIzq',     nombre: 'Izq. → a la izquierda' },
  { slot: 'separar',    nombre: 'Separar ↔' },
  { slot: 'juntar',     nombre: 'Juntar / aplaudir' },
  { slot: 'cielo',      nombre: 'Al cielo ☁' },
  { slot: 'ambasSuben', nombre: 'Ambas suben ↑↑' },
  { slot: 'ambasBajan', nombre: 'Ambas bajan ↓↓' },
];

// Mapeo por defecto de cada familia: gesto → sonido (de esa familia)
const _defaults = {
  crazy: {
    izqCae: 'drop', derSube: 'riser', izqSube: 'arp', derCae: 'laser',
    derDer: 'pluck', derIzq: 'pluck', izqDer: 'sweep', izqIzq: 'sweep',
    separar: 'stab', juntar: 'impacto', cielo: 'shimmer',
    ambasSuben: 'escaleraSube', ambasBajan: 'escaleraBaja',
  },
  // Mate: notas Do-Re-Mi-Fa-Sol-La-Si-Do↑ en los 8 gestos de una mano (pedido del
  // owner) + acorde de Do mayor al subir ambas, y efectos de órgano en el resto
  grave: {
    derSube: 'gDo', derIzq: 'gRe', derDer: 'gMi', derCae: 'gFa',
    izqSube: 'gSol', izqDer: 'gLa', izqIzq: 'gSi', izqCae: 'gDo2',
    ambasSuben: 'gAcordeDo', ambasBajan: 'gOrganoBaja',
    separar: 'gOrganoSube', juntar: 'gOrganoHit', cielo: 'gPadOrgano',
  },
  aguda: {
    izqCae: 'aBlip', derSube: 'aSpark', izqSube: 'aChime', derCae: 'aZapHi',
    derDer: 'aGlass', derIzq: 'aGlass', izqDer: 'aSpark', izqIzq: 'aSpark',
    separar: 'aCrystal', juntar: 'aGlass', cielo: 'aBell',
    ambasSuben: 'aChime', ambasBajan: 'aBell',
  },
  // Vínculos: las 6 voces de sinte de la obra repartidas en los gestos
  vinculos: {
    derSube: 'vCristal', derCae: 'vGota', derDer: 'vVidrio', derIzq: 'vVidrio',
    izqSube: 'vHalito', izqCae: 'vSonar', izqDer: 'vPulso', izqIzq: 'vPulso',
    separar: 'vHalito', juntar: 'vCristal', cielo: 'vHalito',
    ambasSuben: 'vCristal', ambasBajan: 'vSonar',
  },
};

// Mapa activo por familia (copia de los defaults; el usuario lo edita)
const _asign = { crazy: {}, grave: {}, aguda: {}, vinculos: {} };
FAMILIAS.forEach(f => Object.assign(_asign[f.id], _defaults[f.id]));

let _familia = 'vinculos'; // arranca en "Vínculos" (las voces de sinte de la obra) por pedido del owner
export function setFamilia(fam) { if (_asign[fam]) _familia = fam; }
export function getFamilia()    { return _familia; }
export function getBiblioteca() { return BIBLIOTECAS[_familia]; }
export function getAsignaciones() { return { ..._asign[_familia] }; }
export function setAsignacion(slot, id) {
  if (_asign[_familia][slot] !== undefined && FX_FUNCS[id]) _asign[_familia][slot] = id;
}
// Disparo de gesto: resuelve el sonido de la familia activa. time = replay del looper.
export function dispararGesto(slot, time) {
  const fn = FX_FUNCS[_asign[_familia][slot]];
  if (fn) fn(time);
}
// Escuchar un sonido suelto desde el configurador (en vivo, sin agendar)
export function previewSonido(id) {
  const fn = FX_FUNCS[id];
  if (fn) fn();
}
// Persistencia: exporta/importa toda la config (familia + los 3 mapeos)
export function exportarConfig() { return { familia: _familia, asign: _asign }; }
export function importarConfig(cfg) {
  if (!cfg) return;
  if (cfg.asign) {
    for (const f in _asign) {
      const m = cfg.asign[f];
      if (!m) continue;
      for (const slot in _asign[f]) {
        if (m[slot] && FX_FUNCS[m[slot]]) _asign[f][slot] = m[slot];
      }
    }
  }
  // NO restauramos cfg.familia a propósito: el baile SIEMPRE arranca en la familia
  // por defecto (Vínculos), no en la última usada. Los mapeos por gesto sí se recuerdan.
}

// ─── Bombo sub-grave (bypasea filtro, siempre profundo) ────────────────────
const synthBombo = new Tone.MembraneSynth({
  pitchDecay: 0.07,   // caída rápida → golpe seco, sin piuuu
  octaves: 2,          // barrido pequeño → más thud que sweep
  envelope: { attack: 0.001, decay: 1.0, sustain: 0, release: 0.3 },
  volume: 9,
});

// ─── Voz de notas (el «drone» de las formas) ─────────────────────────────────
// Antes era un triángulo pelado a volumen +6: sonaba a sirena y se ponía por
// delante de todo. Ahora son dos capas afinadas a la misma nota, tibias y
// bajas, pensadas para ACOMPAÑAR una canción, no para taparla:
//
//   drone     · fundamental en `fattriangle` — tres osciladores apenas
//               desafinados entre sí. Ese batido lento es lo que la vuelve
//               amable; un triángulo solo suena a test de audio.
//   droneAire · la misma nota una octava arriba, senoidal y muy por debajo:
//               le pone brillo sin agregar aspereza.
//
// Las dos pasan por un lowpass tibio (se come el filo de los armónicos) y de
// ahí salen por dos vías, seca y con reverb, para que la nota tenga aire.
// El vibrato es mínimo a propósito: da vida, y pasado de rosa marea.
const droneGain = new Tone.Gain(0);
const drone = new Tone.Synth({
  oscillator: { type: 'fattriangle', count: 3, spread: 14 },
  envelope: { attack: 0.35, decay: 0.7, sustain: 0.75, release: 1.6 },
  portamento: 0.04, // un hilo de glissando entre notas, no un barrido
  volume: -1,
});
const droneAire = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.6, decay: 0, sustain: 1, release: 2.2 },
  portamento: 0.04,
  volume: -18,
});
// Tercera capa, apagada por defecto: la QUINTA. Es el complemento de la nota
// suelta — sube un mayor y la nota se abre en hueco (fundamental · quinta ·
// octava). No puede desafinar nunca, porque no agrega ninguna nota nueva:
// agrega las dos que ya viven dentro de la que estás tocando.
const droneQuinta = new Tone.Synth({
  oscillator: { type: 'fattriangle', count: 2, spread: 10 },
  envelope: { attack: 0.4, decay: 0, sustain: 1, release: 1.6 },
  portamento: 0.04,
  volume: -8,
});
const droneQuintaGain = new Tone.Gain(0);
// Cuarta capa: LA TERCERA, con los dos mayores arriba. La nota pasa de línea
// sola → quinta hueca → acorde entero. La tercera es la DIATÓNICA de cada nota
// (mayor sobre do, menor sobre re…), que es lo que mantiene todo en tono.
const droneTercera = new Tone.Synth({
  oscillator: { type: 'fattriangle', count: 2, spread: 10 },
  envelope: { attack: 0.4, decay: 0, sustain: 1, release: 1.6 },
  portamento: 0.04,
  volume: -10,
});
const droneTerceraGain = new Tone.Gain(0);

// Semitonos de la tercera diatónica de cada forma dentro de la escala mayor
const TERCERA_POR_FORMA = {
  rectangulo: 4, trapecio_piso: 3, trapecio_techo: 3, trapecio_izq: 4,
  trapecio_der: 4, la: 3, si: 3, do_alto: 4,
};
let _terceraSemis = 4;
const droneFiltro  = new Tone.Filter({
  type: 'lowpass',
  frequency: 2400 * (ES_MOVIL ? FILTRO_NOTA_FACTOR : 1),
  rolloff: -12, Q: 0.4,
});
const droneVibrato = new Tone.Vibrato({ frequency: 4.2, depth: 0.045, wet: 1 });
const droneVerb    = new Tone.Freeverb({ roomSize: 0.8, dampening: 2500, wet: 1 });
const droneVerbEnv = new Tone.Gain(0.32); // cuánta reverb; el resto va seco

// ─── Instrumentos de la voz de notas ─────────────────────────────────────────
// Todos comparten la misma arquitectura de dos capas (fundamental + octava), así
// que cambiar de instrumento es sólo reconfigurar los dos sintes y su cadena.
// Lo que los diferencia de verdad es la ENVOLVENTE: los de sustain alto se
// sostienen mientras haya manos, los de sustain bajo suenan y se apagan solos,
// que es lo que hace que una cuerda pulsada se sienta pulsada.
export const INSTRUMENTOS = [
  {
    id: 'aire', nombre: 'Aire',
    osc:  { type: 'fattriangle', count: 3, spread: 14 },
    env:  { attack: 0.35, decay: 0.7, sustain: 0.75, release: 1.6 },
    vol:  -1,
    oscAire: { type: 'sine' },
    envAire: { attack: 0.6, decay: 0, sustain: 1, release: 2.2 },
    volAire: -18,
    filtro: 2400, vibrato: { frequency: 4.2, depth: 0.045 }, reverb: 0.32,
  },
  {
    id: 'cuerda', nombre: 'Cuerda',
    // Pulsada: ataque instantáneo y caída larga hasta casi nada. Cada forma
    // nueva vuelve a pulsarla.
    osc:  { type: 'fatsawtooth', count: 2, spread: 16 },
    env:  { attack: 0.006, decay: 1.6, sustain: 0.12, release: 1.2 },
    vol:  -2,
    oscAire: { type: 'triangle' },
    envAire: { attack: 0.004, decay: 0.9, sustain: 0.05, release: 0.9 },
    volAire: -10,
    filtro: 3200, vibrato: { frequency: 3.5, depth: 0.012 }, reverb: 0.22,
  },
  {
    id: 'cana', nombre: 'Caña',
    // Soplada: entra despacio y respira. El vibrato es el más hondo de todos.
    osc:  { type: 'sine' },
    env:  { attack: 0.22, decay: 0, sustain: 1, release: 0.9 },
    vol:  -3,
    oscAire: { type: 'triangle' },
    envAire: { attack: 0.5, decay: 0, sustain: 1, release: 1.1 },
    volAire: -22,
    filtro: 3000, vibrato: { frequency: 5.4, depth: 0.11 }, reverb: 0.42,
  },
  {
    id: 'organo', nombre: 'Órgano',
    // Dos senoidales a la octava es literalmente un registro de órgano. Entra y
    // sale rápido, como una tecla.
    osc:  { type: 'sine' },
    env:  { attack: 0.02, decay: 0, sustain: 1, release: 0.25 },
    vol:  -2,
    oscAire: { type: 'sine' },
    envAire: { attack: 0.02, decay: 0, sustain: 1, release: 0.25 },
    volAire: -8,
    filtro: 3500, vibrato: { frequency: 6, depth: 0.006 }, reverb: 0.26,
  },
  {
    id: 'campana', nombre: 'Campana',
    // FM con armonicidad no entera: así suenan los metales, con parciales que
    // no encajan en la serie armónica.
    osc:  { type: 'fmsine', harmonicity: 3.01, modulationIndex: 9 },
    env:  { attack: 0.004, decay: 2.6, sustain: 0.06, release: 2.4 },
    vol:  -3,
    oscAire: { type: 'sine' },
    envAire: { attack: 0.004, decay: 1.4, sustain: 0.03, release: 1.8 },
    volAire: -12,
    filtro: 4500, vibrato: { frequency: 3, depth: 0.004 }, reverb: 0.5,
  },
];

let _instrumento = 'aire';

export function getInstrumento() { return _instrumento; }

export function setInstrumento(id) {
  const p = INSTRUMENTOS.find(i => i.id === id);
  if (!p) return;
  _instrumento = id;
  // `set` es la vía idiomática de Tone: el OmniOscillator resuelve solo el tipo
  // y sus parámetros extra (count/spread de los «fat», harmonicity de los «fm»).
  try {
    drone.set({ oscillator: p.osc, envelope: p.env, volume: p.vol });
    // En móvil la capa de octava sube: es la que el altavoz chico SÍ reproduce,
    // así que es la que sostiene la nota cuando la fundamental no llega.
    droneAire.set({
      oscillator: p.oscAire, envelope: p.envAire,
      volume: p.volAire + (ES_MOVIL ? 6 : 0),
    });
    // La quinta usa el timbre de la fundamental para que la nota abierta suene
    // al mismo instrumento, sólo más discreta
    droneQuinta.set({ oscillator: p.osc, envelope: p.env, volume: p.vol - 6 });
    droneTercera.set({ oscillator: p.osc, envelope: p.env, volume: p.vol - 8 });
    droneFiltro.frequency.rampTo(p.filtro * (ES_MOVIL ? FILTRO_NOTA_FACTOR : 1), 0.2);
    droneVibrato.frequency.value = p.vibrato.frequency;
    droneVibrato.depth.rampTo(p.vibrato.depth, 0.2);
    droneVerbEnv.gain.rampTo(p.reverb, 0.2);
  } catch (err) {
    console.error('[Repique Code] instrumento:', err);
  }
  // Si la voz estaba sonando, se vuelve a pulsar para oír el timbre nuevo ya
  // — sobre todo en los de caída, donde si no habría que esperar a la próxima forma.
  if (state.notasIniciadas && !_modoAcordes) _droneRepulsar();
}

// Las tres notas de la voz se mueven juntas: la fundamental y su octava.
// `actualizarWow` (modo acid) también entra por acá, si no el aire se quedaría
// clavado en la nota anterior.
const QUINTA = Math.pow(2, 7 / 12);
const _terceraHz = hz => hz * Math.pow(2, _terceraSemis / 12);

function _droneFrecuencia(hz, tiempo = 0.08) {
  drone.frequency.rampTo(hz, tiempo);
  droneAire.frequency.rampTo(hz * 2, tiempo);
  droneQuinta.frequency.rampTo(hz * QUINTA, tiempo);
  droneTercera.frequency.rampTo(_terceraHz(hz), tiempo);
}

// Tone exige que cada ataque de un oscilador caiga ESTRICTAMENTE después del
// anterior. Dos ataques en el mismo cuadro comparten el instante del reloj y
// lanzan «Start time must be strictly greater than previous start time» — pasa
// al salir de acordes a notas con una figura ya en pantalla: setModoAcordes
// ataca y actualizarNota vuelve a atacar sin que el reloj haya avanzado.
let _ultimoAtaqueDrone = -1;

function _atacarVocesNota(hz) {
  let t = Tone.now();
  if (t <= _ultimoAtaqueDrone) t = _ultimoAtaqueDrone + 0.002;
  _ultimoAtaqueDrone = t;
  try {
    drone.triggerAttack(hz, t);
    droneAire.triggerAttack(hz * 2, t);
    droneQuinta.triggerAttack(hz * QUINTA, t);
    droneTercera.triggerAttack(_terceraHz(hz), t);
  } catch (err) {
    console.error('[Repique Code] ataque de nota:', err);
  }
}

function _droneAtaque(nota) {
  _atacarVocesNota(Tone.Frequency(nota).toFrequency());
}

function _droneSuelta() {
  drone.triggerRelease();
  droneAire.triggerRelease();
  droneQuinta.triggerRelease();
  droneTercera.triggerRelease();
}

/** Volver a pulsar la nota que ya está sonando, sin cambiarla */
function _droneRepulsar() {
  _atacarVocesNota(drone.frequency.value);
}

/**
 * El complemento de la nota suelta, según cuántos mayores estén arriba:
 *   0 → la nota sola
 *   1 → se abre: entra la quinta (hueco)
 *   2 → se llena: entra también la tercera diatónica (el acorde entero)
 */
export function setComplementoNota(nivel) {
  droneQuintaGain.gain.rampTo(nivel >= 1 ? 1 : 0, 0.18);
  droneTerceraGain.gain.rampTo(nivel >= 2 ? 1 : 0, 0.18);
}

// ─── Voz de acordes (modo acordes) ───────────────────────────────────────────
// Cuatro voces que se atacan UNA VEZ y ya no se sueltan: cambiar de acorde es
// deslizar sus frecuencias a las del acorde nuevo. Por eso los cambios se
// funden en vez de golpear — y un golpe en cada cambio le marcaría el tiempo a
// quien canta, justo lo que no queremos.
//
// El filtro está cerrado en 1500 Hz a propósito. La voz humana vive entre los
// 300 Hz y los 3 kHz: todo lo que ponga energía ahí compite con ella, se la oye
// apagada y termina empujando para hacerse lugar. Un acompañamiento tiene que
// dejarle ese aire libre.
const VOCES_ACORDE   = 4;
const acordeGain     = new Tone.Gain(0);
const acordeFiltro   = new Tone.Filter({
  type: 'lowpass',
  frequency: ES_MOVIL ? FILTRO_ACORDE_MOVIL : 1500,
  rolloff: -12, Q: 0.5,
});
const acordeVerb     = new Tone.Freeverb({ roomSize: 0.82, dampening: 2200, wet: 1 });
const acordeVerbEnv  = new Tone.Gain(0.3);

const ENV_ACORDE = { attack: 0.5, decay: 0, sustain: 1, release: 1.4 };

const vocesAcorde = Array.from({ length: VOCES_ACORDE }, (_, i) => {
  const gain  = new Tone.Gain(0);
  const synth = new Tone.Synth({
    oscillator: ES_MOVIL
      ? OSC_ACORDE_MOVIL   // triángulo simple: sin count/spread, un oscilador
      : { type: 'fattriangle', count: 2, spread: 8 + i * 4 },
    envelope: ENV_ACORDE,
    portamento: 0.09,   // el deslizamiento entre acordes
    volume: (ES_MOVIL ? VOL_ACORDE_MOVIL : -7) - i * 2, // las de arriba, más suaves
  });
  synth.connect(gain);

  // Sólo en móvil: el apoyo grave, una octava POR DEBAJO de la voz principal —
  // o sea el registro que suena en escritorio. En el altavoz del teléfono no se
  // oye y no molesta; con auriculares devuelve el peso. Va por el MISMO gain,
  // así el acorde entra, se desliza y sale de una pieza.
  let apoyo = null;
  if (ES_MOVIL) {
    apoyo = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: ENV_ACORDE,
      portamento: 0.09,
      volume: VOL_APOYO_MOVIL - i * 2,
    });
    apoyo.connect(gain);
  }
  return { synth, apoyo, gain };
});

let _modoAcordes    = false;
let _acordeAtacado  = false;

function _acordeAtaque() {
  if (_acordeAtacado) return;
  vocesAcorde.forEach(v => {
    const f = v.synth.frequency.value || 220;
    v.synth.triggerAttack(f);
    v.apoyo?.triggerAttack(f / 2);   // el apoyo va SIEMPRE una octava debajo
  });
  _acordeAtacado = true;
}

function _acordeSuelta() {
  if (!_acordeAtacado) return;
  vocesAcorde.forEach(v => { v.synth.triggerRelease(); v.apoyo?.triggerRelease(); });
  _acordeAtacado = false;
}

/** Entrar o salir del modo acordes. La voz de nota suelta y la de acordes son
 *  excluyentes: la que no manda se va a cero. */
export function setModoAcordes(activo) {
  _modoAcordes = activo;
  if (!state.notasIniciadas) return;
  if (activo) {
    droneGain.gain.rampTo(0, 0.25);
    _droneSuelta();
    _acordeAtaque();
  } else {
    acordeGain.gain.rampTo(0, 0.25);
    _acordeSuelta();
    _droneAtaque('C3');
    droneFormaActual = null;
  }
}

export function estaEnModoAcordes() { return _modoAcordes; }

/** Deslizar las voces al acorde nuevo. Las voces que sobran (el tercio grave
 *  usa tres) se apagan en vez de doblar una nota. */
export function sonarAcorde(frecuencias) {
  if (!frecuencias || !state.notasIniciadas) return;
  _acordeAtaque();

  // Se decide UNA vez por acorde, no por voz: subir unas voces sí y otras no
  // rompería el voicing y podría cruzar dos voces en la misma nota.
  const tope = Math.max(...frecuencias.filter(f => f !== undefined));
  const mult = (ES_MOVIL && tope < TOPE_SUBIR_MOVIL) ? 2 : 1;

  vocesAcorde.forEach((v, i) => {
    const f = frecuencias[i];
    if (f === undefined) { v.gain.gain.rampTo(0, 0.25); return; }
    // El apoyo va siempre una octava por debajo de la voz principal.
    v.synth.frequency.rampTo(f * mult, 0.09);
    v.apoyo?.frequency.rampTo(f * mult / 2, 0.09);
    // Sin la subida —o sea en el tercio agudo— el acorde suena a la misma
    // altura que el del tercio medio, y levantar las manos no se notaría. Se
    // le quita el apoyo: mismas notas, sin peso debajo, más fino y presente.
    // La diferencia de registro pasa a ser de CARÁCTER en vez de altura, que
    // es lo único que cabe en un altavoz de teléfono sin ponerse a chillar.
    v.apoyo?.volume.rampTo(mult === 2 ? VOL_APOYO_MOVIL - i * 2 : -60, 0.25);
    v.gain.gain.rampTo(1, 0.22);
  });
}

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

// Dinámica de salida en DOS etapas para sonar fuerte SIN saturar ni distorsionar:
//  1) Compresor de bus suave (release lento) = "pega" las sumas sin distorsionar
//     los graves (un limiter rápido solo sí distorsiona notas bajas como el órgano).
//  2) Limiter como techo final de seguridad, casi no actúa gracias al headroom.
const masterComp = new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.012, release: 0.22, knee: 8 });
const masterLimiter = new Tone.Limiter(-1.5);
// Sólo en móvil, y entre el compresor y el limitador: le quita al altavoz lo
// que no puede reproducir. Esos graves no se callan solos — lo hacen distorsionar.
const masterPasoAlto = ES_MOVIL
  ? new Tone.Filter({ type: 'highpass', frequency: PASO_ALTO_MOVIL, rolloff: -12 })
  : null;

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
      // Woodblock sintetizado siempre — bypasea el filtro, la clave corta
      synthClave.triggerAttackRelease('A5', '16n', time, 0.9 + Math.random() * 0.1);
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

// La cadena se arma una sola vez y la comparten la voz de notas y el ritmo
function asegurarCadena() {
  if (masterGain) return;
  masterGain = new Tone.Gain(state.volumen);
  // Synths → filtro → distorsion → chebyshev → ganancia → salida
  [synthPiano, synthRepique, synthChico, synthMadera,
   synthChicoMano, synthChicoPalo, synthRepiqueCand, synthPianoCand].forEach(s => s.connect(filtro));
  filtro.connect(distorsion);
  distorsion.connect(chebyshev);
  chebyshev.connect(masterGain);
  masterGain.connect(masterComp);
  if (masterPasoAlto) {
    masterComp.connect(masterPasoAlto);
    masterPasoAlto.connect(masterLimiter);
  } else {
    masterComp.connect(masterLimiter);
  }
  masterLimiter.toDestination();
  synthBombo.connect(masterGain); // bypass filtro — siempre profundo
  synthClave.connect(masterGain); // bypass filtro — la clave siempre corta
  fxVerb.connect(masterGain);     // bus de efectos de gestos (delay → reverb)
  impactSub.connect(masterGain);  // el sub del impacto va limpio, sin reverb
  sfxDry.connect(masterGain);     // bus seco de la biblioteca (percusión, sub)
  // Voz de notas → vibrato → lowpass tibio → droneGain (el volumen que manda
  // el área de las manos) → dos vías: seca y con reverb. Bypasea el filtro de
  // percusión, pero pasa por la dinámica de salida como todo lo demás.
  drone.connect(droneVibrato);
  droneAire.connect(droneVibrato);
  droneQuinta.connect(droneQuintaGain);
  droneQuintaGain.connect(droneVibrato);
  droneTercera.connect(droneTerceraGain);
  droneTerceraGain.connect(droneVibrato);
  droneVibrato.connect(droneFiltro);
  droneFiltro.connect(droneGain);
  droneGain.connect(masterComp);
  droneGain.connect(droneVerbEnv);
  droneVerbEnv.connect(droneVerb);
  droneVerb.connect(masterComp);

  // Voz de acordes — cadena propia, con su filtro cerrado y su reverb
  vocesAcorde.forEach(v => v.gain.connect(acordeFiltro));
  acordeFiltro.connect(acordeGain);
  acordeGain.connect(masterComp);
  // En móvil la reverb del acorde NO se conecta. Es el nodo más caro de esta
  // cadena (Freeverb son ocho peines y cuatro pasa-todo) y encima su cola vive
  // en los graves-medios, justo lo que un altavoz de teléfono no reproduce: lo
  // que llega no es espacio, es barro encima de la nota. Se va el coste y se
  // gana claridad. La voz de NOTAS conserva la suya.
  if (!ES_MOVIL) {
    acordeGain.connect(acordeVerbEnv);
    acordeVerbEnv.connect(acordeVerb);
    acordeVerb.connect(masterComp);
  }
}

let _notasArrancando = false;

/**
 * Enciende SOLO la voz de notas: el drone del cuadrilátero, sin ritmo ni
 * transporte. Sirve para que la forma que hacen las manos suene en cuanto
 * aparece en pantalla, sin haber pulsado "Arrancar".
 *
 * No lanza excepción: si el navegador todavía tiene el audio cerrado (hace
 * falta un clic del usuario) devuelve `false` y se puede reintentar. El
 * `Promise.race` es porque en Chrome `resume()` sobre un contexto bloqueado
 * por la política de autoplay queda pendiente hasta que el usuario toque algo
 * — sin el timeout esta función nunca volvería.
 */
export async function startNotas() {
  if (state.notasIniciadas) return true;
  if (_notasArrancando) return false;
  _notasArrancando = true;
  try {
    resumeContextSync();
    await Promise.race([
      Tone.start().catch(() => {}),
      new Promise(r => setTimeout(r, 400)),
    ]);
    if (Tone.context.state !== 'running') return false;

    asegurarCadena();
    droneGain.gain.value  = 0; // el área de las manos los levanta
    acordeGain.gain.value = 0;
    if (_modoAcordes) _acordeAtaque();
    else              _droneAtaque('C3');
    droneFormaActual = 'rectangulo';
    state.notasIniciadas = true;
    return true;
  } finally {
    _notasArrancando = false;
  }
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

  asegurarCadena();

  // En móvil se saltea la carga de samples — síntesis directa, sin riesgo de cuelgue
  const esMobil = ES_MOVIL;
  if (!esMobil) {
    await cargarSamples(filtro);
    await Promise.race([Tone.loaded(), new Promise(r => setTimeout(r, 4000))]);
  }

  // Arrancar ritmo y drone — C3 coincide con droneFormaActual ('rectangulo').
  // Si la voz de notas ya estaba encendida no se vuelve a atacar el drone:
  // cortaría la nota que la mano está sosteniendo en ese momento.
  crearSecuencias();
  if (!state.notasIniciadas) {
    if (_modoAcordes) _acordeAtaque();
    else              _droneAtaque('C3');
    droneFormaActual = 'rectangulo';
    state.notasIniciadas = true;
  }

  Tone.getTransport().bpm.value = bpmInterno;
  Tone.getTransport().swingSubdivision = '16n';
  _aplicarSwing();
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo, seqStep].forEach(s => s.start(0));
  Tone.getTransport().start();

  state.audioIniciado = true;
  if (ritmoActual === CANDOMBE_REAL_IDX) asegurarLoop();
}

export function stopAudio() {
  pararLooper();
  _droneSuelta();
  _acordeSuelta();
  droneGain.gain.rampTo(0, 0.3);
  acordeGain.gain.rampTo(0, 0.3);
  Tone.getTransport().stop();
  [seqPiano, seqRepique, seqChico, seqMadera, seqBombo, seqStep].forEach(s => s?.dispose());
  loopPlayer?.stop();
  state.step = -1;
  state.audioIniciado  = false;
  state.notasIniciadas = false; // "Parar" es silencio: también se va la voz de notas
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
  if (_modoAcordes) acordeGain.gain.rampTo(ganancia, 0.18);
  else              droneGain.gain.rampTo(ganancia, 0.18);
}

export function actualizarNota(forma) {
  if (!forma || forma === droneFormaActual) return;
  droneFormaActual = forma;
  const nota = NOTA_POR_FORMA[forma];
  if (!nota) return;
  // La tercera del complemento depende de la nota: mayor sobre do, menor sobre
  // re. Hay que fijarla ANTES de atacar, porque el ataque ya la usa.
  _terceraSemis = TERCERA_POR_FORMA[forma] ?? 4;
  // Cada forma nueva vuelve a atacar la envolvente: eso es lo que la hace sonar
  // como una NOTA y no como una sirena que se desliza. El ataque de 0.35 s la
  // hace florecer en vez de golpear, el `portamento` del synth pone el hilo de
  // glissando, y el debounce de forma (4 frames) evita ráfagas.
  _droneAtaque(nota);
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
      // Sin re-ataque: acá el efecto es justamente el deslizarse por la escala
      _droneFrecuencia(Tone.Frequency(escala[idx]).toFrequency(), 0.05);
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
