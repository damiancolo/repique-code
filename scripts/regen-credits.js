/**
 * regen-credits.js — Regenera credits.json desde los archivos locales existentes
 *
 * Lee el credits.json actual, descarta las entradas cuyos archivos
 * ya no existen (fueron eliminados manualmente) y reescribe el JSON.
 * No hace llamadas a la API de Freesound.
 *
 * Uso: npm run regen-credits
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CREDITS_PATH = join('public', 'samples', 'credits.json');

if (!existsSync(CREDITS_PATH)) {
  console.error('❌  No se encontró public/samples/credits.json');
  console.error('   Primero corré: npm run fetch-samples');
  process.exit(1);
}

const raw     = readFileSync(CREDITS_PATH, 'utf-8');
const credits = JSON.parse(raw);

const antes  = credits.samples.length;
const activos = credits.samples.filter(s => {
  const ruta = join('public', 'samples', s.file);
  return existsSync(ruta);
});

const credits2 = {
  downloaded_at: credits.downloaded_at, // conservamos la fecha original
  regenerated_at: new Date().toISOString(),
  samples: activos,
};

writeFileSync(CREDITS_PATH, JSON.stringify(credits2, null, 2));

const eliminados = antes - activos.length;
console.log(`\n✅  credits.json regenerado`);
console.log(`   Samples antes: ${antes}`);
console.log(`   Samples ahora: ${activos.length}`);
if (eliminados > 0) console.log(`   Eliminados: ${eliminados}`);
console.log();
