# Repique Code — Guía para Claude

## Qué es

Instrumento musical controlado por gestos de manos. Usa MediaPipe para detectar manos por cámara y Tone.js para síntesis de audio. Publicado en `estudioprompt.com/lab/repique-code` como iframe embebido. Versión actual: **1.5**.

Arranca siempre en el ritmo **Libre ✎** (índice 6) para que el usuario pueda editar directamente.

## Arquitectura

```
index.html          — UI (botones, menú ritmos, guía de gestos, estilos)
src/
  main.js           — loop principal (requestAnimationFrame), debounce de formas, controles UI
  hands.js          — MediaPipe: detectarManos(), calcularGestos(), clasificarForma()
  audio.js          — Tone.js: secuenciador 16 pasos, drone, filtro, BPM, notas, patrones
  render.js         — canvas: video espejado en gris + overlay de cuadrilátero/triángulos
  state.js          — { bpm, volumen, audioIniciado }
```

## Gestos implementados

El cuadrilátero se forma con pulgares e índices de ambas manos.
Clasificación en `hands.js:clasificarForma()`:

| Forma | Nota | Cómo |
|-------|------|------|
| rectangulo | Do | lados y bases paralelos |
| trapecio_piso | Re | base más ancha que techo |
| trapecio_techo | Mi | techo más ancho que base |
| trapecio_izq | Fa | lado izq. más largo |
| trapecio_der | Sol | lado der. más largo |
| la | La | pinza mano derecha (dist pulgar-índice < 0.07) |
| si | Si | pinza mano izquierda |
| do_alto | Do₂ | ambos pulgares > índices en Y en 0.10 |
| dos_triangulos | Acid | cuadrilátero auto-intersectante (manos cruzadas) |
| dosPinzas (no forma) | Toggle lock | ambas manos en pinza simultáneamente (8 frames) |

## Lock de tempo/tono (dos pinzas)

Implementado en `main.js`. Cuando `dosPinzas` se mantiene ≥8 frames → toggle `locked`.
Cuando `locked = true`:
- `actualizarBPM` no se llama (tempo congelado)
- `actualizarNota` no se llama (nota congelada)
- Filtro y área del drone siguen respondiendo
- Indicador visual: `#lock-indicator` arriba a la derecha

## Banco de patrones (audio.js — BANCO_PATRONES)

Array de 6 patrones exportado como `BANCO_PATRONES`. Cada patrón tiene 5 tracks × 16 pasos:
- `piano` — kick principal
- `repique` — snare/repique
- `chico` — hihat/chico
- `madera` — madera/clave
- `bombo` — bombo sub-grave (bypasea el filtro)

| Índice | Nombre | Descripción |
|--------|--------|-------------|
| 0 | House | Kick 4/4, snare 2+4, hihat corcheas |
| 1 | Dos pulsos | Kick en 1+3, snare en 2+4, hihat constante |
| 2 | Escalera | Piano:1, repique:2, chico:3, madera:4 por tiempo |
| 3 | Tresillo | División 3-3-2, groove afrolatino sincopado |
| 4 | Medianoche | Medio tiempo muy abierto, golpes mínimos (lento) |
| 5 | Llamada | Chico constante, repique sincopado, bombo en tiempos |
| 6 | **Libre ✎** | Patrón editable en tiempo real por el usuario — **default al cargar** |

Para agregar un ritmo nuevo: agregar objeto al array `BANCO_PATRONES` en `audio.js`, y el botón correspondiente en `#menu-ritmo` de `index.html` con `data-ritmo="N"`.

## Visualizador de ritmo (tooltip hover)

Al hacer hover sobre un botón del menú de ritmos aparece una ventana flotante a la derecha con la grilla 5×16. Implementado en `main.js` función `mostrarViz()`. Los tracks tienen emojis como label:
🔔 Chico · 🥁 Repique · 🔴 Piano · 👏 Madera (palmas) · 💥 Bombo

Hover sobre el botón ♩ → muestra el viz del ritmo que está sonando actualmente.
Junto al ♩ hay un `#ritmo-nombre` en rojo que siempre indica el ritmo activo.

En el modo Libre ✎ el footer del viz tiene dos botones: **↺ limpiar** (borra todo) y **⟳ actualizar** (refresca la vista).

## Flujo de audio

`startAudio()` en `audio.js`:
1. En desktop: carga samples reales desde `public/samples/`
2. En móvil: síntesis directa (MembraneSynth/MetalSynth), sin samples
3. Secuenciador Tone.js: 5 tracks (piano/kick, repique/snare, chico/hihat, madera, bombo)
4. Drone: OmniOscillator triangle, pitch controlado por `actualizarNota(forma)`

`actualizarBPM(bpm)` — suavizado: `Si += (objetivo - Si) * 0.04`
`actualizarFiltro(ancho)` — lowpass 3500-12000 Hz según apertura de manos
`actualizarArea(area)` — volumen del drone según bounding box de dedos

## Cómo hacer deploy

⚠️ El webhook automático GitHub → Vercel **no es confiable**. Usar siempre deploy manual:

```bash
# 1. Build del instrumento
cd /Users/damianlafferranderie/Desktop/programeitor/repique-code
npm run build --cache /tmp/npm-cache

# 2. Copiar al Astro (SOLO el JS actual — borrar los viejos del assets/)
ASTRO=/Users/damianlafferranderie/.gemini/antigravity/scratch/estudioprompt
cp dist/index.html $ASTRO/public/repique-code/
cp dist/logo-ep.png $ASTRO/public/repique-code/
# Limpiar assets viejos y copiar el nuevo
rm -f $ASTRO/public/repique-code/assets/index-*.js
cp -r dist/assets $ASTRO/public/repique-code/

# 3. Build del Astro
cd $ASTRO
npm run build

# 4. Commit y push a GitHub
git add public/repique-code/
git commit -m "Repique Code X.X — descripción"
git push origin main

# 5. Deploy a Vercel (SIEMPRE con npx, no confiar en el webhook)
npx --cache /tmp/npm-cache --yes vercel@latest --prod
```

El deploy confirma con: `▲ Aliased https://estudioprompt.com`

## npm

```bash
npm install --cache /tmp/npm-cache
```
(el cache de npm tiene archivos de root, usar siempre ese flag)

## Notas técnicas

- MediaPipe se carga desde CDN (no bundle local) — requiere internet
- Canvas espejado: coordenadas X se invierten con `(1 - p.x) * w`
- `FRAMES_FORMA = 4` frames para confirmar una forma (debounce)
- `FRAMES_DOS_PINZAS = 8` frames para activar el lock
- iOS/WebKit: `resumeContextSync()` debe llamarse síncronamente en el evento de click
- Samples de producción en `public/samples/`, referenciados via `credits.json`
- Assets del build tienen hash en el nombre (ej: `index-C6z8meJ1.js`) — al actualizar, borrar el JS viejo del Astro antes de copiar el nuevo
