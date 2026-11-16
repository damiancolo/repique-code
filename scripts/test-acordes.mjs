// Comprobaciones de la armonía del modo acordes. Correr con: npm test
//
// Lo que suena es exactamente lo que devuelve frecuenciasAcorde(), en móvil y en
// ordenador: audio.js ya no cambia de octava según el dispositivo. Si alguien
// vuelve a meter un desplazamiento en audio.js, tiene que reproducirlo acá.
import { frecuenciasAcorde, nombreAcorde, inversionAplica, TONALIDADES, REGISTROS } from '../src/acordes.js';

const GRADOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'I8'];
let fallos = 0, comprobados = 0;
const falla = msg => { fallos++; if (fallos <= 20) console.error('✗ ' + msg); };

for (const t of TONALIDADES) for (const c of [0, 1, 2]) {
  // 1. Las formas son una escala: en cada registro la fundamental sube siempre.
  for (const r of REGISTROS) {
    const fund = GRADOS.map(g => frecuenciasAcorde(t.id, g, r, c)[0]);
    for (let i = 1; i < fund.length; i++) {
      comprobados++;
      if (!(fund[i] > fund[i - 1]))
        falla(`${t.nombre} ${r} complemento ${c}: baja de ${GRADOS[i - 1]} a ${GRADOS[i]}`);
    }
  }
  // 2. Los tres registros suenan distintos: la nota de abajo de agudo > medio > grave.
  //    (Se mira la más grave: en el tercio grave el complemento conserva su nota
  //    de color arriba a propósito, así que la más aguda no sirve de medida.)
  for (const g of GRADOS) {
    const [ag, me, gr] = ['agudo', 'medio', 'grave'].map(r => frecuenciasAcorde(t.id, g, r, c));
    comprobados++;
    if (!(Math.min(...ag) > Math.min(...me) && Math.min(...me) > Math.min(...gr)))
      falla(`${t.nombre} ${g} complemento ${c}: registros que no se distinguen`);
  }
}

// ─── Sin meñique: todas las notas dentro de la escala mayor ──────────────────
const ESCALA = [0, 2, 4, 5, 7, 9, 11];
const enEscala = (t, f) => {
  const semis = Math.round(12 * Math.log2(f / t.hz));
  return ESCALA.includes(((semis % 12) + 12) % 12);
};
for (const t of TONALIDADES) for (const g of GRADOS) for (const c of [0, 1, 2]) for (const r of REGISTROS) {
  comprobados++;
  const fs = frecuenciasAcorde(t.id, g, r, c);
  if (!fs.every(f => enEscala(t, f))) falla(`${t.nombre} ${g} ${r} complemento ${c}: nota fuera de la escala sin meñique`);
}

// ─── El meñique (inversión mayor ↔ menor) ────────────────────────────────────
const tercera = (t, g, c, inv) => {
  // Intervalo entre la fundamental y la tercera, mirando las notas del medio
  const fs = frecuenciasAcorde(t.id, g, 'medio', c, inv);
  const r = fs[0];
  const ints = fs.map(f => (Math.round(12 * Math.log2(f / r)) % 12 + 12) % 12);
  return ints.includes(4) ? 'mayor' : ints.includes(3) ? 'menor' : null;
};
const CALIDAD = { I: 'mayor', II: 'menor', III: 'menor', IV: 'mayor', V: 'mayor', VI: 'menor', VII: 'menor', I8: 'mayor' };
const INVERTIDA = { I: 'menor', II: 'mayor', III: 'mayor', IV: 'menor', V: 'menor', VI: 'mayor', VII: 'menor', I8: 'menor' };
for (const t of TONALIDADES) {
  for (const g of GRADOS) {
    // 4. La tríada invertida cambia de calidad (el VII disminuido pasa a menor)
    comprobados++;
    const inv = tercera(t, g, 0, true);
    if (inv !== INVERTIDA[g]) falla(`${t.nombre} ${g}: invertido da ${inv}, se esperaba ${INVERTIDA[g]}`);
    if (g !== 'VII') {
      comprobados++;
      const base = tercera(t, g, 0, false);
      if (base !== CALIDAD[g]) falla(`${t.nombre} ${g}: sin meñique da ${base}`);
    }
    // 5. Si el meñique aplica, el acorde suena distinto en los tres registros;
    //    si no aplica (suspendido), suena exactamente igual.
    for (const c of [0, 1, 2]) for (const r of REGISTROS) {
      comprobados++;
      const a = frecuenciasAcorde(t.id, g, r, c, false), b = frecuenciasAcorde(t.id, g, r, c, true);
      const iguales = a.length === b.length && a.every((f, i) => Math.abs(f - b[i]) < 0.01);
      if (inversionAplica(g, c) === iguales)
        falla(`${t.nombre} ${g} ${r} complemento ${c}: inversionAplica=${inversionAplica(g, c)} pero ${iguales ? 'suena igual' : 'cambia'}`);
    }
    // 6. Con el meñique la escala sigue subiendo y los niveles siguen distintos
  }
  for (const c of [0, 1, 2]) for (const r of REGISTROS) {
    const fund = GRADOS.map(g => frecuenciasAcorde(t.id, g, r, c, true)[0]);
    for (let i = 1; i < fund.length; i++) {
      comprobados++;
      if (!(fund[i] > fund[i - 1])) falla(`${t.nombre} ${r} c${c} invertido: baja de ${GRADOS[i - 1]} a ${GRADOS[i]}`);
    }
  }
}
// 7. Nombres: Dm → D y Dm7 → D7 en Do
const n1 = nombreAcorde('C', 'II', 0, true), n2 = nombreAcorde('C', 'II', 2, true), n3 = nombreAcorde('C', 'IV', 0, true);
comprobados += 3;
if (n1.cifrado !== 'D')  falla(`II invertido se llama ${n1.cifrado}`);
if (n2.cifrado !== 'D7') falla(`II7 invertido se llama ${n2.cifrado}`);
if (n3.cifrado !== 'Fm') falla(`IV invertido se llama ${n3.cifrado}`);

console.log(fallos ? `\n${fallos} fallos de ${comprobados} comprobaciones` : `✓ ${comprobados} comprobaciones, todas bien`);
process.exit(fallos ? 1 : 0);
