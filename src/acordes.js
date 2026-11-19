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

// ─── Modo cantar: los acordes de guitarra ────────────────────────────────────
// Pedido de Damián (19 nov 2026): un modo para quien canta y toca la guitarra.
// Las mismas ocho figuras, pero con los acordes que más se usan en una canción:
// la tónica, el ii, el vi, el IV, la dominante CON séptima, las dos dominantes
// secundarias (II7 lleva al V, III7 lleva al vi) y el V sin séptima. Fuera el
// iii y el vii°, que casi no aparecen en un cancionero. En Sol: G Am Em C D7 A7
// B7 D. Las figuras dejan de ser una escala que sube: acá manda la comodidad.
export const GRADO_POR_FORMA_CANTAR = {
  rectangulo:     'I',
  trapecio_piso:  'II',
  trapecio_techo: 'VI',
  trapecio_izq:   'IV',
  trapecio_der:   'V7',
  la:             'II7',
  si:             'III7',
  do_alto:        'V',
};

// La calidad de cada grado viene puesta por la tonalidad: en Do el segundo
// acorde es Dm. Lo único que la cambia es el MEÑIQUE DERECHO (ver «La
// inversión» más abajo), y sólo mientras está arriba.
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
  // Los del modo cantar: dominantes que ya son de séptima sin subir ningún dedo
  // (`base`). El meñique las pasa a m7 como al resto (D7 → Dm7).
  V7:   { semis:  7, tipo: 'mayor', base: 'dom7' },
  II7:  { semis:  2, tipo: 'mayor', base: 'dom7' },
  III7: { semis:  4, tipo: 'mayor', base: 'dom7' },
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
// Un dedo = LA TENSIÓN: el acorde pide volver.
const COMPLEMENTO = {
  I:   'sus4',
  II:  'sus4',
  III: 'sus4',
  IV:  'sus2',    // la cuarta de fa es si: trítono, áspero. Baja a la segunda.
  V:   'dom7',
  VI:  'sus4',
  VII: 'semidim',
  I8:  'sus4',
  V7:  'sus4',    // la dominante colgada: D7 → Dsus4
  II7: 'sus4',
  III7:'sus4',
};

// Los DOS dedos = EL COLOR: el acorde se abre. Son las dos únicas cosas que se
// le hacen a una tríada —tensarla o abrirla—, por eso hacen juego entre sí y
// por eso son dos y no tres.
const COMPLEMENTO2 = {
  I:   'maj7',
  II:  'min7',
  III: 'min7',
  IV:  'maj7',
  V:   'nueve',      // en el V la séptima ya la usó un dedo: sube a la novena
  VI:  'min7',
  VII: 'semidim11',
  I8:  'maj7',
  V7:  'nueve',
  II7: 'nueve',
  III7:'nueve',
};

const SUFIJO = {
  mayor: { cifrado: '',    nombre: 'mayor'       },
  menor: { cifrado: 'm',   nombre: 'menor'       },
  dim:   { cifrado: 'dim', nombre: 'disminuido'  },
};

const SUFIJO_COMPLEMENTO = {
  sus4:       { cifrado: 'sus4',   nombre: 'con cuarta suspendida'        },
  sus2:       { cifrado: 'sus2',   nombre: 'con segunda'                  },
  dom7:       { cifrado: '7',      nombre: 'séptima'                      },
  semidim:    { cifrado: 'm7♭5',   nombre: 'medio disminuido'             },
  maj7:       { cifrado: 'maj7',   nombre: 'con séptima mayor'            },
  min7:       { cifrado: 'm7',     nombre: 'menor con séptima'            },
  nueve:      { cifrado: '9',      nombre: 'con novena'                   },
  semidim11:  { cifrado: 'm11♭5',  nombre: 'medio disminuido con oncena'  },
  min9:       { cifrado: 'm9',     nombre: 'menor con novena'             },
  min11:      { cifrado: 'm11',    nombre: 'menor con oncena'             },
};

// ─── La inversión (el meñique derecho) ───────────────────────────────────────
//
// Mientras el meñique derecho está arriba, el acorde cambia de calidad: mayor
// pasa a menor y menor a mayor. Es la puerta a los acordes PRESTADOS, que son
// los que se usan para salir un momento de la tonalidad: en Do, el II pasa a
// D (la dominante de Sol), el VI a A (la de Re menor), el IV a Fm (el iv menor).
// Es el único gesto que saca notas fuera de la escala, y sólo mientras se pide.
//
// Se SOSTIENE, no se fija: al bajar el meñique vuelve solo. Un interruptor que
// queda puesto no se puede leer sin mirar la pantalla, y un parpadeo de la
// cámara lo daría vuelta sin querer.
//
// Casos especiales:
// - El disminuido (VII) no tiene «mayor» natural: invertido pasa a MENOR (Bm).
// - Los suspendidos (un mayor arriba, salvo en V y VII) no tienen tercera, así
//   que el meñique no les cambia nada. Es lo correcto: no hay qué invertir.
// - Con séptima, se invierte el acorde entero hacia lo que se toca de verdad:
//   maj7 → m7, m7 → 7 (Dm7 → D7, la dominante prestada más usada),
//   el 7 del V → m7, el 9 → m9, el m7♭5 → m7 y el m11♭5 → m11.
const TIPO_INVERTIDO = { mayor: 'menor', menor: 'mayor', dim: 'menor' };
const COMPLEMENTO_INVERTIDO = {
  maj7: 'min7', min7: 'dom7', dom7: 'min7', nueve: 'min9',
  semidim: 'min7', semidim11: 'min11',
  // sus4 y sus2 no tienen tercera: quedan igual
};

/** La calidad del grado, con el meñique arriba o no */
function tipoDe(g, invertido) {
  return invertido ? TIPO_INVERTIDO[g.tipo] : g.tipo;
}

/** El tipo de complemento según cuántos mayores estén arriba (0, 1 o 2) */
function tipoComplemento(grado, nivel, invertido = false) {
  let t = null;
  if (nivel >= 2) t = COMPLEMENTO2[grado];
  else if (nivel >= 1) t = COMPLEMENTO[grado];
  else t = GRADOS[grado]?.base ?? null;   // las dominantes del modo cantar
  if (t && invertido) t = COMPLEMENTO_INVERTIDO[t] ?? t;
  return t;
}

/**
 * ¿Cambia algo el meñique en este acorde? No, si está suspendido (no hay
 * tercera que invertir). main.js lo usa para no tratar como «cambio» —ni
 * destellar— lo que suena exactamente igual.
 */
export function inversionAplica(grado, complemento) {
  if (!GRADOS[grado]) return false;
  const t = tipoComplemento(grado, complemento);
  return t !== 'sus4' && t !== 'sus2';
}

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
export function nombreAcorde(tonalidadId, grado, complemento = 0, invertido = false) {
  const t = tonalidadDe(tonalidadId);
  const g = GRADOS[grado];
  if (!g) return null;

  const idxTonica = (t.bemoles ? CIFRA_B : CIFRA_S).indexOf(t.cifrado);
  const idx  = ((idxTonica + g.semis) % 12 + 12) % 12;
  const raiz = (t.bemoles ? CIFRA_B : CIFRA_S)[idx];
  const tipo = tipoComplemento(grado, complemento, invertido);
  const suf  = tipo ? SUFIJO_COMPLEMENTO[tipo] : SUFIJO[tipoDe(g, invertido)];

  // 'D♭' → letra 'D' + alteración '♭' → 'Re♭'
  const latino = LATINO[raiz[0]] + (raiz.length > 1 ? raiz[1] : '');

  return {
    cifrado: raiz + suf.cifrado,
    nombre:  `${latino} ${suf.nombre}`,
    grado,
    complemento,
    invertido,
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
export function frecuenciasAcorde(tonalidadId, grado, registro = 'medio', complemento = 0, invertido = false) {
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

  const tipo    = tipoDe(g, invertido);
  const desde   = n => r * Math.pow(2, n / 12);
  const tercera = desde(tipo === 'mayor' ? 4 : 3);
  const quinta  = desde(tipo === 'dim' ? 6 : 7);

  // El voicing es abierto —fundamental, quinta, octava y décima— y la voz de
  // arriba es la que lleva el carácter. El complemento cambia esa voz: es la
  // tercera la que se va y entra la nota que pide resolución.
  let notas, color;
  switch (tipoComplemento(grado, complemento, invertido)) {
    // ── Un dedo: la tensión ────────────────────────────────────────────────
    case 'sus4':
      color = desde(5) * 2;
      notas = [r, quinta, r * 2, color];
      break;
    case 'sus2':
      color = desde(2) * 2;
      notas = [r, quinta, r * 2, color];
      break;
    case 'dom7':
    case 'semidim':
      // La dominante ocupa los mismos 16 semitonos que el resto: con un
      // voicing más abierto, en el tercio agudo la voz de arriba se iba a
      // 1480 Hz y chillaba.
      color = desde(10);
      notas = [r, quinta, color, tercera * 2];
      break;

    // ── Dos dedos: el color ────────────────────────────────────────────────
    case 'maj7':
      color = desde(11);
      notas = [r, quinta, color, tercera * 2];
      break;
    case 'min7':
      color = desde(10);
      notas = [r, quinta, color, tercera * 2];
      break;
    case 'nueve':
      // Acá sí entra la tercera abajo: una dominante sin tercera pierde el
      // carácter, y es lo único que distingue a este acorde del de un dedo.
      color = desde(2) * 2;
      notas = [r, tercera, desde(10), color];
      break;
    case 'semidim11':
    case 'min11':        // invertido: el mismo voicing, con la quinta justa
      color = desde(5) * 2;
      notas = [r, quinta, desde(10), color];
      break;
    case 'min9':         // invertido del 9: la tercera abajo es la menor
      color = desde(2) * 2;
      notas = [r, tercera, desde(10), color];
      break;

    // ── Sin dedos: la tríada ───────────────────────────────────────────────
    default:
      color = tercera * 2;
      notas = [r, quinta, r * 2, color];
  }

  if (registro === 'agudo') return notas.map(f => f * 2);

  if (registro === 'grave') {
    // Abajo se saca la tercera y quedan fundamental y quinta, como hace
    // cualquier pianista: apretado en el grave se empasta. Pero si hay
    // complemento, su nota de color TIENE que sobrevivir — si no, subir el dedo
    // en el tercio grave no se oiría.
    //
    // Lo mismo con el meñique: la tríada grave no tiene tercera, así que
    // invertirla no cambiaría nada. Con el meñique arriba la tercera (la
    // invertida) entra arriba como color, para que el gesto se oiga también acá.
    // Con complemento Y meñique, la nota de color (séptima, novena) es la misma
    // invertido o no —Dm7 y D7 comparten la séptima—: lo único que cambia es la
    // tercera, así que esa entra también como cuarta voz.
    if (complemento && invertido && tipoComplemento(grado, complemento) !== 'sus4'
        && tipoComplemento(grado, complemento) !== 'sus2') {
      return [r / 2, quinta / 2, tercera, color];
    }
    if (complemento || invertido) return [r / 2, quinta / 2, color];
    // El disminuido es la excepción: su «quinta» es un trítono, y un trítono a
    // 90 Hz es puro barro. Se le baja sólo la fundamental.
    if (tipo === 'dim') return [r / 2, r, quinta];
    return [r / 2, quinta / 2, r];
  }

  return notas;
}
