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
//
// Las ocho formas recorren la escala de abajo hacia arriba, así que desde la
// tónica hasta la última forma hay una octava entera. Para que esa octava no
// termine chillando, las tres últimas tonalidades (La, Si♭, Si) **envuelven una
// octava abajo** en vez de seguir subiendo. Es un salto invisible: nadie toca
// dos tonalidades a la vez, y a cambio las doce caben en el mismo registro.
export const TONALIDADES = [
  { id: 'C',  cifrado: 'C',  nombre: 'Do',   hz: 130.81, bemoles: false }, // Do3
  { id: 'Db', cifrado: 'D♭', nombre: 'Re♭',  hz: 138.59, bemoles: true  },
  { id: 'D',  cifrado: 'D',  nombre: 'Re',   hz: 146.83, bemoles: false },
  { id: 'Eb', cifrado: 'E♭', nombre: 'Mi♭',  hz: 155.56, bemoles: true  },
  { id: 'E',  cifrado: 'E',  nombre: 'Mi',   hz: 164.81, bemoles: false },
  { id: 'F',  cifrado: 'F',  nombre: 'Fa',   hz: 174.61, bemoles: true  },
  { id: 'Gb', cifrado: 'G♭', nombre: 'Sol♭', hz: 185.00, bemoles: true  },
  { id: 'G',  cifrado: 'G',  nombre: 'Sol',  hz: 196.00, bemoles: false },
  { id: 'Ab', cifrado: 'A♭', nombre: 'La♭',  hz: 207.65, bemoles: true  }, // Sol♯3
  { id: 'A',  cifrado: 'A',  nombre: 'La',   hz: 110.00, bemoles: false }, // La2 — envuelve
  { id: 'Bb', cifrado: 'B♭', nombre: 'Si♭',  hz: 116.54, bemoles: true  },
  { id: 'B',  cifrado: 'B',  nombre: 'Si',   hz: 123.47, bemoles: false },
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
  do_alto:        'I8',
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
  // La tónica una octava arriba, y por eso `octavaArriba` se salta el plegado.
  // Antes esta forma era la dominante con séptima, y al recorrer las formas en
  // orden la escala subía do-re-mi-fa-sol-la-si y de golpe BAJABA a sol: el
  // último escalón tiraba para abajo. Así cierra la octava.
  I8:  { semis:  0, tipo: 'mayor', octavaArriba: true },
};

// ─── El complemento (subir un dedo mayor) ────────────────────────────────────
//
// Una sola idea: **la nota que le falta al acorde para pedir resolución**.
//
// En casi todos los grados esa nota es la CUARTA, que echa a la tercera y deja
// el acorde colgado — subir el dedo tensa, bajarlo resuelve. En el V la nota
// que pide volver es la SÉPTIMA, no la cuarta, así que ahí el complemento es la
// dominante. Y el vii° es el único donde una suspensión no dice nada, porque ya
// es todo tensión: ahí se le agrega la séptima y pasa a medio disminuido, que
// es el acorde que de verdad se toca.
//
// Ninguno de los ocho complementos coincide con ninguno de los ocho acordes
// base, y todos están dentro de la escala.
const COMPLEMENTO = {
  I:   'sus4',
  II:  'sus4',
  III: 'sus4',
  IV:  'sus2',    // la cuarta de fa es si: trítono, áspero. Baja a la segunda.
  V:   'dom7',
  VI:  'sus4',
  VII: 'semidim',
  I8:  'sus4',
};

const SUFIJO = {
  mayor: { cifrado: '',    nombre: 'mayor'       },
  menor: { cifrado: 'm',   nombre: 'menor'       },
  dim:   { cifrado: 'dim', nombre: 'disminuido'  },
};

const SUFIJO_COMPLEMENTO = {
  sus4:    { cifrado: 'sus4',  nombre: 'con cuarta suspendida' },
  sus2:    { cifrado: 'sus2',  nombre: 'con segunda'           },
  dom7:    { cifrado: '7',     nombre: 'séptima'               },
  semidim: { cifrado: 'm7♭5',  nombre: 'medio disminuido'      },
};

const CIFRA_S = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const CIFRA_B = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const LATINO  = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

// ─── Registro ────────────────────────────────────────────────────────────────
export const REGISTROS = ['agudo', 'medio', 'grave'];

function tonalidadDe(id) {
  return TONALIDADES.find(t => t.id === id) || TONALIDADES[0];
}

/**
 * Nombre del acorde en las dos nomenclaturas: `{ cifrado: 'Dm', nombre: 'Re menor' }`.
 * Se muestran las dos porque quien canta lee cifrado pero piensa en nombres.
 */
export function nombreAcorde(tonalidadId, grado, complemento = false) {
  const t = tonalidadDe(tonalidadId);
  const g = GRADOS[grado];
  if (!g) return null;

  const idxTonica = (t.bemoles ? CIFRA_B : CIFRA_S).indexOf(t.cifrado);
  const idx  = ((idxTonica + g.semis) % 12 + 12) % 12;
  const raiz = (t.bemoles ? CIFRA_B : CIFRA_S)[idx];
  const suf  = complemento ? SUFIJO_COMPLEMENTO[COMPLEMENTO[grado]] : SUFIJO[g.tipo];

  // 'D♭' → letra 'D' + alteración '♭' → 'Re♭'
  const latino = LATINO[raiz[0]] + (raiz.length > 1 ? raiz[1] : '');

  return {
    cifrado: raiz + suf.cifrado,
    nombre:  `${latino} ${suf.nombre}`,
    grado,
    complemento,
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
export function frecuenciasAcorde(tonalidadId, grado, registro = 'medio', complemento = false) {
  const t = tonalidadDe(tonalidadId);
  const g = GRADOS[grado];
  if (!g) return null;

  // La fundamental sube con el grado, sin plegar.
  //
  // ⚠️ Acá hubo un plegado que metía toda fundamental dentro de una misma
  // octava, para que el acompañamiento no saltara de registro al cambiar de
  // grado. Daba buena conducción de voces y ROMPÍA LA ESCALA: en Sol, el IV se
  // caía una octava y al recorrer las formas en orden el sonido bajaba en
  // medio del camino. En Do no se notaba —es la única tonalidad donde el
  // plegado no llegaba a actuar—, por eso sobrevivió hasta que el owner lo
  // escuchó. Las formas son una escala: tienen que subir.
  const r = t.hz * Math.pow(2, (g.semis + (g.octavaArriba ? 12 : 0)) / 12);

  const desde   = n => r * Math.pow(2, n / 12);
  const tercera = desde(g.tipo === 'mayor' ? 4 : 3);
  const quinta  = desde(g.tipo === 'dim' ? 6 : 7);

  // El voicing es abierto —fundamental, quinta, octava y décima— y la voz de
  // arriba es la que lleva el carácter. El complemento cambia esa voz: es la
  // tercera la que se va y entra la nota que pide resolución.
  let notas, color;
  if (!complemento) {
    notas = [r, quinta, r * 2, tercera * 2];
    color = tercera * 2;
  } else {
    switch (COMPLEMENTO[grado]) {
      case 'sus2':
        color = desde(2) * 2;
        notas = [r, quinta, r * 2, color];
        break;
      case 'dom7':
        // La dominante ocupa los mismos 16 semitonos que el resto: con un
        // voicing más abierto, en el tercio agudo la voz de arriba se iba a
        // 1480 Hz y chillaba.
        color = desde(10);
        notas = [r, quinta, color, tercera * 2];
        break;
      case 'semidim':
        color = desde(10);
        notas = [r, quinta, color, tercera * 2];
        break;
      default: // sus4
        color = desde(5) * 2;
        notas = [r, quinta, r * 2, color];
    }
  }

  if (registro === 'agudo') return notas.map(f => f * 2);

  if (registro === 'grave') {
    // Abajo se saca la tercera y quedan fundamental y quinta, como hace
    // cualquier pianista: apretado en el grave se empasta. Pero si hay
    // complemento, su nota de color TIENE que sobrevivir — si no, subir el dedo
    // en el tercio grave no se oiría.
    if (complemento) return [r / 2, quinta / 2, color];
    // El disminuido es la excepción: su «quinta» es un trítono, y un trítono a
    // 90 Hz es puro barro. Se le baja sólo la fundamental.
    if (g.tipo === 'dim') return [r / 2, r, quinta];
    return [r / 2, quinta / 2, r];
  }

  return notas;
}
