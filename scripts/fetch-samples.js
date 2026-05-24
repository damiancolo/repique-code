/**
 * fetch-samples.js — Descarga samples de Freesound para Repique Code
 *
 * Solo acepta CC0 y CC-BY (apto uso comercial).
 * La API devuelve licencias como URLs; la validación es client-side.
 * Lee la API key de .env (FREESOUND_API_KEY).
 *
 * Uso: npm run fetch-samples
 */

import 'dotenv/config';
import { createWriteStream, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = process.env.FREESOUND_API_KEY;

if (!API_KEY) {
  console.error('\n❌  FREESOUND_API_KEY no encontrada en .env');
  console.error('   Obtené tu key en: https://freesound.org/apiv2/apply/');
  console.error('   Luego creá el archivo .env con:  FREESOUND_API_KEY=tu_key_aqui\n');
  process.exit(1);
}

const BASE_URL    = 'https://freesound.org/apiv2';
const MAX_TOTAL   = 20;
const MAX_POR_CAT = 5;
const MIN_POR_CAT = 3;
const PAUSA_MS    = 400;

const CATEGORIAS = [
  {
    nombre: 'chico',
    queries: ['candombe chico', 'tamboril agudo', 'afro drum high', 'high conga hit'],
  },
  {
    nombre: 'repique',
    queries: ['candombe repique', 'tamboril drum', 'afro drum medium', 'mid conga hit'],
  },
  {
    nombre: 'piano',
    queries: ['candombe piano drum', 'tamboril grave', 'low afro drum', 'low conga hit'],
  },
  {
    nombre: 'madera',
    queries: ['clave percussion hit', 'wooden stick hit', 'claves percussion'],
  },
];

// ─── Licencias ────────────────────────────────────────────────────────────────
// La API devuelve la licencia como URL, p.ej:
//   "http://creativecommons.org/publicdomain/zero/1.0/"
//   "http://creativecommons.org/licenses/by/3.0/"
//   "http://creativecommons.org/licenses/by-nc/3.0/"

function licenciaOK(url) {
  if (!url) return false;
  if (url.includes('/publicdomain/zero/')) return true;           // CC0 ✓
  if (url.includes('/licenses/by/') && !url.match(/by-\w/)) return true; // CC-BY ✓ (solo by/, no by-nc/, by-sa/, etc.)
  return false;
}

function licenseNombre(url) {
  if (!url) return 'Desconocida';
  if (url.includes('/publicdomain/zero/')) return 'Creative Commons 0';
  if (url.includes('/licenses/by/'))       return 'Attribution';
  return url;
}

function licenseUrlCanonica(url) {
  if (!url) return '';
  if (url.includes('/publicdomain/zero/')) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (url.includes('/licenses/by/'))       return 'https://creativecommons.org/licenses/by/3.0/';
  return url;
}

// ─── Validación de cada sound ────────────────────────────────────────────────

function esValido(sound) {
  // Duración estricta (0.05 – 2.0 s)
  if (!sound.duration || sound.duration < 0.05 || sound.duration > 2.0) return false;

  // Rating mínimo si está disponible
  if (typeof sound.avg_rating === 'number' && sound.avg_rating < 3) return false;

  // Descartar loops y música (busco golpes secos)
  const texto = [sound.name, ...(sound.tags ?? [])].join(' ').toLowerCase();
  if (/\bloop\b|\bmusic\b|\bsong\b|\bmelody\b|\bchord\b|\bambient\b|\bpad\b/.test(texto)) return false;

  // Licencia apta
  if (!licenciaOK(sound.license)) return false;

  return true;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function buscar(query, pageSize = 20) {
  const url = new URL(`${BASE_URL}/search/text/`);
  url.searchParams.set('query',     query);
  url.searchParams.set('filter',    'duration:[0.05 TO 2.0]'); // filtro de duración en Solr
  url.searchParams.set('sort',      'rating_desc');
  url.searchParams.set('fields',    'id,name,username,license,previews,duration,avg_rating,tags');
  url.searchParams.set('page_size', String(pageSize));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Token ${API_KEY}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.results ?? [];
}

async function descargar(previewUrl, destPath) {
  const res = await fetch(previewUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🥁  Repique Code — descarga de samples de Freesound\n');

  const creditsList = [];
  let totalDescargados = 0;

  for (const cat of CATEGORIAS) {
    console.log(`\n── ${cat.nombre.toUpperCase()} ──`);
    const dirPath = join('public', 'samples', cat.nombre);
    mkdirSync(dirPath, { recursive: true });
    const samplescat = [];

    for (const query of cat.queries) {
      if (samplescat.length >= MAX_POR_CAT) break;
      if (totalDescargados >= MAX_TOTAL)    break;

      console.log(`   Buscando: "${query}"...`);
      await pausa(PAUSA_MS);

      let resultados;
      try {
        resultados = await buscar(query);
      } catch (err) {
        console.warn(`   ✗ Error en búsqueda: ${err.message}`);
        continue;
      }

      const validos = resultados.filter(esValido);
      console.log(`   → ${resultados.length} resultados, ${validos.length} aptos (duración + licencia CC0/CC-BY)`);

      for (const sound of validos) {
        if (samplescat.length >= MAX_POR_CAT) break;
        if (totalDescargados >= MAX_TOTAL)    break;
        if (samplescat.some(s => s.freesound_id === sound.id)) continue;

        const n          = samplescat.length + 1;
        const filename   = `${n}.mp3`;
        const destPath   = join(dirPath, filename);
        const previewUrl = sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'];

        if (!previewUrl) { console.warn(`   ✗ Sin preview MP3 para "${sound.name}"`); continue; }

        try {
          await descargar(previewUrl, destPath);

          const entry = {
            file:         `${cat.nombre}/${filename}`,
            category:     cat.nombre,
            freesound_id: sound.id,
            freesound_url:`https://freesound.org/s/${sound.id}/`,
            name:          sound.name,
            author:        sound.username,
            author_url:   `https://freesound.org/people/${sound.username}/`,
            license:       licenseNombre(sound.license),
            license_url:   licenseUrlCanonica(sound.license),
          };

          samplescat.push(entry);
          creditsList.push(entry);
          totalDescargados++;

          console.log(`   ✓ ${cat.nombre}/${filename} — "${sound.name}" por ${sound.username} (${licenseNombre(sound.license)}) [${sound.duration.toFixed(2)}s]`);
        } catch (err) {
          console.warn(`   ✗ Error descargando "${sound.name}": ${err.message}`);
        }

        await pausa(PAUSA_MS);
      }

      if (samplescat.length >= MIN_POR_CAT) break;
    }

    if (samplescat.length < MIN_POR_CAT) {
      console.warn(`   ⚠  Solo ${samplescat.length} samples para "${cat.nombre}" (mínimo: ${MIN_POR_CAT})`);
    }
  }

  // credits.json
  await writeFile(
    join('public', 'samples', 'credits.json'),
    JSON.stringify({ downloaded_at: new Date().toISOString(), samples: creditsList }, null, 2)
  );

  // Resumen
  console.log('\n\n📋  Resumen:');
  for (const s of creditsList) {
    console.log(`   ✓ ${s.file} — "${s.name}" por ${s.author} (${s.license})`);
  }
  console.log(`\n   Total: ${creditsList.length} / ${MAX_TOTAL} samples`);
  console.log('   Credits: public/samples/credits.json\n');
  console.log('─'.repeat(60));
  console.log('✅  Descarga completa.');
  console.log('   Escuchá los samples en public/samples/ antes de continuar.');
  console.log('   Para eliminar los que no te gusten: borrá el archivo y corré npm run regen-credits');
  console.log('   Cuando estés conforme, decime "integrar al motor".');
  console.log('─'.repeat(60) + '\n');
}

function pausa(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => {
  console.error('\n❌  Error:', err.message);
  process.exit(1);
});
