// Comprobaciones de la armonía del modo acordes. Correr con: npm test
//
// Lo que suena es exactamente lo que devuelve frecuenciasAcorde(), en móvil y en
// ordenador: audio.js ya no cambia de octava según el dispositivo. Si alguien
// vuelve a meter un desplazamiento en audio.js, tiene que reproducirlo acá.
import { frecuenciasAcorde, TONALIDADES, REGISTROS } from '../src/acordes.js';

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

console.log(fallos ? `\n${fallos} fallos de ${comprobados} comprobaciones` : `✓ ${comprobados} comprobaciones, todas bien`);
process.exit(fallos ? 1 : 0);
