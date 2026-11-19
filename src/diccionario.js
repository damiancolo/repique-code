// Todos los acordes del modo cantar, con sus manos — ver acordes.html.
//
// Se recorren las figuras del modo × 0/1/2 dedos mayores × meñique, y de cada
// acorde se queda la combinación que menos dedos pide (como el cancionero).
// Van en tres grupos: los de la figura sola, los que suman dedos mayores y los
// que cambian con el meñique (los prestados, fuera de la escala).

import { TONALIDADES, GRADO_POR_FORMA_CANTAR, nombreAcorde } from './acordes.js';
import { MANOS } from './manos-cancionero.js';

const $ = (id) => document.getElementById(id);
const valido = (t) => TONALIDADES.some(x => x.id === t);
let tono = new URLSearchParams(location.search).get('tono');
if (!valido(tono)) tono = 'G';

function acordesDe(tonoId) {
  const vistos = new Map();
  for (const [figura, grado] of Object.entries(GRADO_POR_FORMA_CANTAR))
    for (const comp of [0, 1, 2]) for (const inv of [false, true]) {
      const n = nombreAcorde(tonoId, grado, comp, inv);
      if (!n) continue;
      const costo = comp + (inv ? 1.5 : 0);
      const prev = vistos.get(n.cifrado);
      if (!prev || prev.costo > costo) vistos.set(n.cifrado, { ...n, figura, comp, inv, costo });
    }
  return [...vistos.values()];
}

function pista(a) {
  const p = [];
  if (a.comp) p.push(a.comp === 1 ? '+ un mayor' : '+ los dos mayores');
  if (a.inv) p.push('+ meñique');
  return p.join(' · ');
}

function tarjeta(a) {
  const mano = MANOS[`${a.figura}|${a.comp}|${a.inv ? 1 : 0}`] || '';
  return `<div class="ac">${mano}<b>${a.cifrado}</b><small>${a.nombre}</small>${pista(a) ? `<i>${pista(a)}</i>` : ''}</div>`;
}

function pintar() {
  const t = TONALIDADES.find(x => x.id === tono);
  document.querySelectorAll('#tonos button').forEach(b => b.classList.toggle('activo', b.dataset.tono === tono));
  const todos = acordesDe(tono);
  const orden = Object.keys(GRADO_POR_FORMA_CANTAR);
  const porFigura = (a, b) => orden.indexOf(a.figura) - orden.indexOf(b.figura) || a.comp - b.comp;
  const solos = todos.filter(a => !a.comp && !a.inv).sort(porFigura);
  const dedos = todos.filter(a => a.comp && !a.inv).sort(porFigura);
  const menique = todos.filter(a => a.inv).sort(porFigura);
  const grupo = (tit, sub, nota, lista) => lista.length
    ? `<h2>${tit} <span>${sub}</span></h2>${nota ? `<p class="nota">${nota}</p>` : ''}<div class="grilla">${lista.map(tarjeta).join('')}</div>` : '';
  $('lista').innerHTML =
    grupo('Los de siempre', `· en ${t.nombre} (${t.cifrado})`, '', solos) +
    grupo('Con los dedos mayores', '· tensión y color', 'Un mayor arriba tensa el acorde (sus4, o la séptima en el V); los dos lo abren (maj7, m7, 9).', dedos) +
    grupo('Con el meñique derecho', '· mayor ↔ menor', 'Mientras el meñique está arriba el acorde cambia de calidad: así salen los que no son de la tonalidad.', menique);
}

TONALIDADES.forEach(t => {
  const b = document.createElement('button');
  b.dataset.tono = t.id; b.textContent = t.cifrado;
  b.addEventListener('click', () => {
    tono = t.id; pintar();
    if (window.parent !== window) window.parent.postMessage({ tipo: 'cancionero-tono', tono }, '*');
  });
  $('tonos').appendChild(b);
});

addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data || e.data.tipo !== 'tono' || !valido(e.data.tono)) return;
  if (e.data.tono !== tono) { tono = e.data.tono; pintar(); }
});

pintar();
