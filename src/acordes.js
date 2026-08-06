/**
 * acordes.js — Teoría del modo acordes.
 *
 * Módulo puro: no importa Tone.js ni toca el DOM. Entra una forma de la mano y
 * una altura de pantalla, salen frecuencias. Así se puede razonar (y probar) la
 * música sin arrancar el audio.
 *
 * La idea: las ocho formas que ya detecta `hands.js` son los grados de una
 * tonalidad, y cada grado suena como el acorde que le toca dentro de esa
 * tonalidad. Como todos los acordes salen de la misma escala, no hay manera de
 * tocar uno que desafine.
 */

// ─── Tonalidades ─────────────────────────────────────────────────────────────
// La tónica va en la 3.ª octava. Da igual que unas queden más altas que otras:
// el plegado de PISO/TECHO (abajo) mete la fundamental de cada acorde en la
// misma octava pase lo que pase.
export const TONALIDADES = [
  { id: 'C',  cifrado: 'C',  nombre: 'Do',   hz: 130.81, bemoles: false },
  { id: 'Db', cifrado: 'D♭', nombre: 'Re♭',  hz: 138.59, bemoles: true  },
  { id: 'D',  cifrado: 'D',  nombre: 'Re',   hz: 146.83, bemoles: false },
  { id: 'Eb', cifrado: 'E♭', nombre: 'Mi♭',  hz: 155.56, bemoles: true  },
  { id: 'E',  cifrado: 'E',  nombre: 'Mi',   hz: 164.81, bemoles: false },
  { id: 'F',  cifrado: 'F',  nombre: 'Fa',   hz: 174.61, bemoles: true  },
  { id: 'Gb', cifrado: 'G♭', nombre: 'Sol♭', hz: 185.00, bemoles: true  },
  { id: 'G',  cifrado: 'G',  nombre: 'Sol',  hz: 196.00, bemoles: false },
  { id: 'Ab', cifrado: 'A♭', nombre: 'La♭',  hz: 207.65, bemoles: true  },
  { id: 'A',  cifrado: 'A',  nombre: 'La',   hz: 220.00, bemoles: false },
  { id: 'Bb', cifrado: 'B♭', nombre: 'Si♭',  hz: 233.08, bemoles: true  },
  { id: 'B',  cifrado: 'B',  nombre: 'Si',   hz: 246.94, bemoles: false },
];

// ─── Las ocho formas son los grados ──────────────────────────────────────────
// `dos_triangulos` queda fuera a propósito: el modo acid no tiene acorde.
export const GRADO_POR_FORMA = {
  rectangulo:     'I',
  trapecio_piso:  'II',
  trapecio_techo: 'III',
  trapecio_izq:   'IV',
  trapecio_der:   'V',
  la:             'VI',
  si:             'VII',
  do_alto:        'V7',
};

// La calidad de cada grado NO se elige: viene puesta por la tonalidad. Por eso
// no hace falta un control de mayor/menor — en Do el segundo acorde es Dm y no
// hay forma de que salga D.
const GRADOS = {
  I:   { semis:  0, tipo: 'mayor' },
  II:  { semis:  2, tipo: 'menor' },
  III: { semis:  4, tipo: 'menor' },
  IV:  { semis:  5, tipo: 'mayor' },
  V:   { semis:  7, tipo: 'mayor' },
  VI:  { semis:  9, tipo: 'menor' },
  VII: { semis: 11, tipo: 'dim'   },
  V7:  { semis:  7, tipo: 'dom7'  },
};

const SUFIJO = {
  mayor: { cifrado: '',    nombre: 'mayor'       },
  menor: { cifrado: 'm',   nombre: 'menor'       },
  dim:   { cifrado: 'dim', nombre: 'disminuido'  },
  dom7:  { cifrado: '7',   nombre: 'séptima'     },
};

const CIFRA_S = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const CIFRA_B = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const LATINO  = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

// ─── Registro ────────────────────────────────────────────────────────────────
export const REGISTROS = ['agudo', 'medio', 'grave'];

// Ventana donde vive la fundamental de TODOS los acordes: Do3–Do4.
const PISO  = 130.0;
const TECHO = 261.0;

function tonalidadDe(id) {
  return TONALIDADES.find(t => t.id === id) || TONALIDADES[0];
}

/**
 * Nombre del acorde en las dos nomenclaturas: `{ cifrado: 'Dm', nombre: 'Re menor' }`.
 * Se muestran las dos porque quien canta lee cifrado pero piensa en nombres.
 */
export function nombreAcorde(tonalidadId, grado) {
  const t = tonalidadDe(tonalidadId);
  const g = GRADOS[grado];
  if (!g) return null;

  const idxTonica = (t.bemoles ? CIFRA_B : CIFRA_S).indexOf(t.cifrado);
  const idx  = ((idxTonica + g.semis) % 12 + 12) % 12;
  const raiz = (t.bemoles ? CIFRA_B : CIFRA_S)[idx];
  const suf  = SUFIJO[g.tipo];

  // 'D♭' → letra 'D' + alteración '♭' → 'Re♭'
  const latino = LATINO[raiz[0]] + (raiz.length > 1 ? raiz[1] : '');

  return {
    cifrado: raiz + suf.cifrado,
    nombre:  `${latino} ${suf.nombre}`,
    grado,
  };
}

/**
 * Las frecuencias que hay que hacer sonar.
 *
 * El voicing es ABIERTO — fundamental, quinta, octava y décima — y no una
 * tríada apretada: apretada en el registro grave se empasta y suena a barro.
 *
 * En el tercio grave se saca la tercera y quedan fundamental y quinta, que es
 * lo que hace cualquier pianista abajo. Sigue siendo el mismo acorde, hueco.
 */
export function frecuenciasAcorde(tonalidadId, grado, registro = 'medio') {
  const t = tonalidadDe(tonalidadId);
  const g = GRADOS[grado];
  if (!g) return null;

  // Fundamental plegada SIEMPRE dentro de Do3–Do4. Esto es lo que hace que dos
  // acordes seguidos queden cerca uno del otro sea cual sea la tonalidad: el
  // acompañamiento no pega saltos de registro al cambiar de grado.
  let r = t.hz * Math.pow(2, g.semis / 12);
  while (r >= TECHO) r /= 2;
  while (r <  PISO)  r *= 2;

  const desde   = n => r * Math.pow(2, n / 12);
  const tercera = desde(g.tipo === 'mayor' || g.tipo === 'dom7' ? 4 : 3);
  const quinta  = desde(g.tipo === 'dim' ? 6 : 7);

  // La dominante cambia la octava por la séptima: fundamental, quinta, séptima
  // y décima. Es lo que la hace sonar a «esto vuelve al primero». Ocupa los
  // mismos 16 semitonos que los demás acordes — con un voicing más abierto, en
  // el tercio agudo la voz de arriba se iba a 1480 Hz y chillaba.
  const notas = g.tipo === 'dom7'
    ? [r, quinta, desde(10), tercera * 2]
    : [r, quinta, r * 2, tercera * 2];

  if (registro === 'agudo') return notas.map(f => f * 2);

  if (registro === 'grave') {
    // El disminuido es la excepción: su «quinta» es un trítono, y un trítono a
    // 90 Hz es puro barro. Se le baja sólo la fundamental y el trítono se queda
    // arriba, donde se entiende. El resto pierde la tercera y baja entero.
    if (g.tipo === 'dim') return [r / 2, r, quinta];
    return [notas[0] / 2, notas[1] / 2, notas[0]];
  }

  return notas;
}
