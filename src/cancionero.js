// Cancionero de Repique Code — ver el comentario de cancionero.html.
//
// Lee una canción en formato cancionero (acordes en su línea, encima de la
// letra) y le pone al lado de cada acorde el dibujo de las manos que lo tocan en
// Repique Code. La figura sale del mapa INVERSO de acordes.js: para cada
// tonalidad se recorren las ocho figuras × 0/1/2 dedos mayores × meñique y se
// anota qué acorde da cada combinación, quedándose con la que menos dedos pide.

import { TONALIDADES, GRADO_POR_FORMA, GRADO_POR_FORMA_CANTAR, nombreAcorde } from './acordes.js';
import { MANOS } from './manos-cancionero.js';

const CANTAR = /[?&]modo=cantar/.test(location.search);
const FIGURAS = CANTAR ? GRADO_POR_FORMA_CANTAR : GRADO_POR_FORMA;
const GUIA = /[?&]guia/.test(location.search);

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── Leer acordes ──────────────────────────────────────────────────────────────
const LETRA_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LATINO_A = { Do: 'C', Re: 'D', Mi: 'E', Fa: 'F', Sol: 'G', La: 'A', Si: 'B' };
const alter = (a) => (a === '#' || a === '♯') ? 1 : (a === 'b' || a === '♭') ? -1 : 0;
// Cómo los escribe la gente → cómo los nombra acordes.js
const EXACTOS = {
  '': '', 'M': '', 'maj': '',
  'm': 'm', 'min': 'm', 'mi': 'm', '-': 'm',
  'dim': 'dim', '°': 'dim', 'º': 'dim', 'o': 'dim',
  '7': '7',
  'maj7': 'maj7', 'M7': 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', '7M': 'maj7', 'ma7': 'maj7', 'j7': 'maj7', '7+': 'maj7',
  'm7': 'm7', 'min7': 'm7', 'mi7': 'm7', '-7': 'm7',
  'm7b5': 'm7♭5', 'm7♭5': 'm7♭5', 'ø': 'm7♭5', 'ø7': 'm7♭5', '-7b5': 'm7♭5', 'm7(b5)': 'm7♭5',
  'sus4': 'sus4', 'sus': 'sus4', '4': 'sus4', 'sus2': 'sus2', '2': 'sus2',
  '9': '9', 'm9': 'm9', 'm11': 'm11', 'm11b5': 'm11♭5',
};
// Los que Repique Code no tiene: suena la tríada de la misma raíz (≈)
const APROX = new Set(['6', '69', '6/9', 'add9', 'add2', 'add4', 'maj9', 'M9', '11', '13', '7sus4', '7sus2', '9sus4',
  'aug', '+', '5', 'dim7', '°7', 'º7', 'm6', 'madd9', 'm(add9)', '7b9', '7#9', '7b5', '7#5', 'm(maj7)', 'mM7',
  'm13', 'maj13', '7(9)', '7(b9)', '7(13)', '7(#9)', 'sus9', '(9)', '(add9)', 'm(9)', '7M(9)']);
function triadaDe(suf) {
  if (/^(dim|°|º)/.test(suf)) return 'dim';
  if (/^(m|min|mi|-)(?!aj)/.test(suf)) return 'm';
  return '';
}
function leerAcorde(tok) {
  let m = tok.match(/^([A-G])([#b♯♭]?)(.*)$/), letra, acc, suf;
  if (m) [, letra, acc, suf] = m;
  else {
    m = tok.match(/^(Do|Re|Mi|Fa|Sol|La|Si)([#b♯♭]?)(.*)$/);
    if (!m) return null;
    letra = LATINO_A[m[1]]; acc = m[2]; suf = m[3];
  }
  suf = suf.replace(/\/.*$/, '');           // el bajo no cambia la figura
  const pc = ((LETRA_PC[letra] + alter(acc)) % 12 + 12) % 12;
  if (suf in EXACTOS) return { pc, tipo: EXACTOS[suf], exacto: true };
  if (APROX.has(suf)) return { pc, tipo: triadaDe(suf), exacto: false };
  return null;
}
// Lo que puede acompañar a los acordes en su línea sin que deje de serlo
const NO_ACORDE = /^(\||\|\||\/|-|–|%|\.|,|\(|\)|\(?x\d+\)?|\(?\d+x\)?|\(?\d+|x\)?|:\|\|?|\|\|?:|\[[^\]]*\]:?|\w+:)$/i;
function tokensDeAcordes(linea) {
  if (!linea.trim()) return null;
  const toks = []; const re = /\S+/g; let m, alguno = false;
  while ((m = re.exec(linea))) {
    const pre = m[0].startsWith('(') ? 1 : 0;
    const raw = m[0].replace(/^\(|[),;.]+$/g, '');
    const ac = leerAcorde(raw);
    if (ac) { toks.push({ texto: raw, col: m.index + pre, ac }); alguno = true; }
    else if (NO_ACORDE.test(m[0])) toks.push({ texto: m[0], col: m.index, ac: null });
    else return null;
  }
  return alguno ? toks : null;
}

// ── El mapa inverso: qué figura da cada acorde, en cada tonalidad ────────────
function pcSuf(c) {
  const alt = c[1] === '♯' || c[1] === '♭';
  return { pc: ((LETRA_PC[c[0]] + (c[1] === '♯' ? 1 : c[1] === '♭' ? -1 : 0)) + 12) % 12, suf: c.slice(alt ? 2 : 1) };
}
const MAPAS = {};
for (const t of TONALIDADES) {
  const mapa = {};
  for (const [figura, grado] of Object.entries(FIGURAS)) for (const comp of [0, 1, 2]) for (const inv of [false, true]) {
    const n = nombreAcorde(t.id, grado, comp, inv);
    if (!n) continue;
    const { pc, suf } = pcSuf(n.cifrado);
    const costo = comp + (inv ? 1 : 0);
    const k = pc + '|' + suf;
    if (!mapa[k] || mapa[k].costo > costo) mapa[k] = { figura, comp, inv, costo, cifrado: n.cifrado };
  }
  MAPAS[t.id] = mapa;
}
function resolver(ac, tono) {
  const mapa = MAPAS[tono];
  const ex = mapa[ac.pc + '|' + ac.tipo];
  if (ex) return { ...ex, aprox: !ac.exacto };
  // Sin el acorde exacto: el de la misma raíz más parecido (un C7 en un modo que no lo tiene → C)
  const parecidos = { '7': ['', 'm'], 'm7': ['m', ''], 'maj7': ['', 'm'], '9': ['7', ''], 'm9': ['m7', 'm'] }[ac.tipo] || [];
  for (const tri of [...parecidos, triadaDe(ac.tipo), '', 'm', 'dim']) {
    const r = mapa[ac.pc + '|' + tri];
    if (r) return { ...r, aprox: true };
  }
  return { fuera: true };
}
/** La tonalidad donde más acordes salen exactos (el meñique resta: saca de la escala) */
function deducirTono(acordes) {
  let mejor = null;
  for (const t of TONALIDADES) {
    let p = 0;
    for (const a of acordes) {
      const r = resolver(a, t.id);
      if (!r.fuera) p += (r.aprox ? 1 : 3) - (r.inv ? 1.6 : 0);
    }
    for (const a of [acordes[0], acordes.at(-1)]) {
      const r = a && resolver(a, t.id);
      // Las canciones suelen empezar y terminar en la tónica o en su relativa menor (vi)
      if (r && !r.fuera && ['I', 'VI', 'I8'].includes(FIGURAS[r.figura])) p += 2;
    }
    if (!mejor || p > mejor.p) mejor = { id: t.id, p };
  }
  return mejor ? mejor.id : 'C';
}

// ── Pintar ────────────────────────────────────────────────────────────────────
let cancion = '';
let tonoAvisado = null;

function anchoCaracter() {
  const s = document.createElement('span');
  s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
  s.textContent = 'x'.repeat(100);
  $('cancion').appendChild(s);
  const w = s.getBoundingClientRect().width / 100; s.remove();
  return w || 9;
}

// «← guía» esconde la canción y vuelve a la lámina sin perderla; «canción →» la
// trae de vuelta. Escribir en la caja también la vuelve a mostrar.
let oculta = false;

function pintar() {
  pintarCancion();
  const hay = !!$('cancion').querySelector('.fila-ac');
  $('cancion').style.display = (hay && oculta) ? 'none' : '';
  $('b-guia').classList.toggle('visible', hay && !oculta);
  $('b-cancion').classList.toggle('visible', hay && oculta);
  avisarAlto();
}
$('b-guia').addEventListener('click', () => { oculta = true; pintar(); });
$('b-cancion').addEventListener('click', () => { oculta = false; pintar(); });

// Dentro de la guía: le cuenta al instrumento cuánto mide y si ya hay canción,
// para que la guía pase a ser la canción (y vuelva a ser la guía al borrarla)
function avisarAlto() {
  if (!GUIA || window.parent === window) return;
  const conCancion = !!$('cancion').querySelector('.fila-ac') && !oculta;
  // Se mide el contenido (main), no el documento: el documento nunca es más bajo
  // que el iframe, y así la caja no se achicaría al borrar la canción
  const alto = Math.ceil(document.querySelector('main').getBoundingClientRect().height);
  window.parent.postMessage({ tipo: 'cancionero-alto', alto, conCancion }, '*');
}

function pintarCancion() {
  // Los cancioneros meten caracteres invisibles (Cifra Club pone un espacio de
  // ancho cero al principio de cada línea) y espacios duros: fuera, o «​D» no es «D»
  const texto = cancion.replace(/[​-‍⁠﻿]/g, '').replace(/[   ]/g, ' ')
    .replace(/\*\*|`/g, '').replace(/\r/g, '').replace(/\t/g, '    ');
  if (!texto.trim()) { $('cancion').innerHTML = ''; return; }
  const filas = texto.split('\n').map(l => ({ l, toks: tokensDeAcordes(l) }));
  const todos = filas.flatMap(f => f.toks ? f.toks.filter(t => t.ac).map(t => t.ac) : []);
  if (!todos.length) { $('estado').textContent = 'No encontré acordes en ese texto.'; $('cancion').innerHTML = ''; return; }
  const tono = deducirTono(todos);
  const t = TONALIDADES.find(x => x.id === tono);
  $('estado').textContent = '';
  if (window.parent !== window && tono !== tonoAvisado) {
    tonoAvisado = tono;
    window.parent.postMessage({ tipo: 'cancionero-tono', tono }, '*');
  }

  const ch = anchoCaracter();
  const MANO = GUIA ? 54 : 84;
  document.documentElement.style.setProperty('--mano', MANO + 'px');
  const cabeza = `<div class="tono">${CANTAR ? 'Modo cantar · ' : ''}Tonalidad en Repique Code: <b>${t.nombre} (${t.cifrado})</b></div>`;
  $('cancion').innerHTML = cabeza + filas.map(f => {
    if (!f.toks) return `<div class="linea">${esc(f.l) || ' '}</div>`;
    // Cada acorde va en su columna, pero con la mano al lado ocupa más que en el
    // texto: si el renglón no entra en el ancho, sigue en otro renglón (antes se
    // salía por la derecha y había que desplazar para ver los últimos).
    const ancho = Math.max(120, $('cancion').clientWidth - 4);
    const renglones = [[]];
    let fin = -Infinity, envuelto = false;
    for (const tok of f.toks) {
      // Pasado el primer renglón ya no hay columna que respetar: van seguidos
      let x = envuelto ? fin + 8 : Math.max(tok.col * ch, fin + 6);
      const r = tok.ac ? resolver(tok.ac, tono) : null;
      const largo = tok.texto.length * ch + (r && !r.fuera ? 3 + MANO : 0);
      if (x + largo > ancho && renglones.at(-1).length) { renglones.push([]); x = 0; envuelto = true; }
      fin = x + largo;
      let html;
      if (!tok.ac) html = `<span class="txt" style="left:${x.toFixed(1)}px">${esc(tok.texto)}</span>`;
      else if (r.fuera) html = `<span class="ac fuera" style="left:${x.toFixed(1)}px" title="No está en ${t.nombre}"><span class="nom">${esc(tok.texto)}</span></span>`;
      else {
        const marca = r.aprox ? `<span class="marca" title="Suena ${esc(r.cifrado)}">≈</span>` : '';
        html = `<span class="ac" style="left:${x.toFixed(1)}px"><span class="nom">${esc(tok.texto)}</span>${marca}${MANOS[`${r.figura}|${r.comp}|${r.inv ? 1 : 0}`]}</span>`;
      }
      renglones.at(-1).push(html);
    }
    return renglones.map(p => `<div class="fila-ac">${p.join('')}</div>`).join('');
  }).join('');
}

// ── Una sola caja: enlace, captura o texto ───────────────────────────────────
async function leer(cuerpo, aviso) {
  $('estado').textContent = aviso;
  try {
    const r = await fetch('/lab/cancionero/leer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.texto) { $('estado').textContent = d.error || 'Aquí sólo se puede pegar el texto de la canción.'; return; }
    cancion = (d.titulo ? d.titulo + '\n\n' : '') + d.texto;
    oculta = false;
    pintar();
  } catch { $('estado').textContent = 'No hay conexión con el lector. Pega el texto de la canción.'; }
}
function imagenADataURL(archivo) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 2000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(archivo);
  });
}
async function leerCaptura(archivo) {
  if (!archivo || !archivo.type.startsWith('image/')) return;
  $('caja').value = '(captura)';
  leer({ imagen: await imagenADataURL(archivo) }, 'Leyendo la captura…');
}
function desdeCaja() {
  const v = $('caja').value.trim();
  if (!v || v === '(captura)') return;
  if (/^https?:\/\/\S+$/.test(v)) { leer({ url: v }, 'Leyendo la página…'); return; }
  cancion = $('caja').value;
  oculta = false;
  pintar();
}

let espera;
$('caja').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(desdeCaja, 350); });
document.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); leerCaptura(item.getAsFile()); }
});
document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('soltando'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('soltando'); });
document.addEventListener('drop', (e) => {
  e.preventDefault(); document.body.classList.remove('soltando');
  const f = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
  if (f) leerCaptura(f);
});
window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(pintar, 150); });
// Si la caja se vacía, vuelve la guía
$('caja').addEventListener('input', () => { if (!$('caja').value.trim()) { cancion = ''; $('estado').textContent = ''; pintar(); } });
if (GUIA) new ResizeObserver(avisarAlto).observe(document.querySelector('main'));
document.fonts.ready.then(pintar);

// Para pruebas desde la consola
window.__cancionero = { leerAcorde, tokensDeAcordes, resolver, deducirTono, set: (t) => { cancion = t; pintar(); } };
