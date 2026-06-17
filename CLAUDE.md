# Repique Code — Guía para Claude

## Qué es

Instrumento musical controlado por gestos de manos. Usa MediaPipe para detectar manos por cámara y Tone.js para síntesis de audio. Publicado en `estudioprompt.com/lab/repique-code` como iframe embebido.

Arranca en el ritmo **CANDOMByte** (índice 5, candombe sintetizado). Tiene tres modos: **normal** (drone + secuenciador por gestos de forma), **pintura ✏** y **baile 🕺** (los movimientos disparan efectos visuales y sonidos).

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

Array de 8 patrones exportado como `BANCO_PATRONES`. Cada patrón tiene 5 tracks × 16 pasos:
- `piano` — kick principal
- `repique` — snare/repique
- `chico` — hihat/chico
- `madera` — madera/clave
- `bombo` — bombo sub-grave (bypasea el filtro)

| Índice | Nombre | Descripción |
|--------|--------|-------------|
| 0 | El cualca | Kick 4/4, snare 2+4, hihat corcheas, perc offbeat |
| 1 | House | Four-on-the-floor, hihat con bombeo, clap 2+4 |
| 2 | Dos pulsos | Kick 1+3, snare 2+4, hihat constante |
| 3 | Escalera | Piano:1, repique:2, chico:3, madera:4 por tiempo |
| 4 | Libre ✎ | Patrón editable, arranca casi vacío |
| 5 | **CANDOMByte** | Candombe sintetizado, clave 3+3+4+2+4 — **default al cargar** |
| 6 | Candombe 🎧 | Loop grabado real (no editable; suena un Tone.Player) |
| 7 | Techno | Kick+bombo pesados, hihat contratiempo, clap escaso |

`CANDOMBE_IDX = 5`, `CANDOMBE_REAL_IDX = 6` (exportado). Todos editables en tiempo real desde el viz salvo el 6. Botones en `#menu-ritmo` de `index.html` con `data-ritmo="N"`; el activo y `#ritmo-nombre` deben coincidir con `ritmoActual` (audio.js) y `ritmoActivoIdx` (main.js).

Para agregar un ritmo nuevo: objeto al array `BANCO_PATRONES` en `audio.js` + botón en `#menu-ritmo`.

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

## Modo baile: gestos → sonidos, biblioteca y familias (audio.js + main.js)

En modo baile los gestos de movimiento disparan efectos de audio (además de los visuales). El flujo: `main.js:detectarGestosMusica(dt)` detecta el gesto → llama `dispararGesto(slot)` (audio.js) → resuelve el sonido asignado vía `FX_FUNCS[id]`.

**Ranuras de gesto** (`GESTOS_BAILE`, 11 slots): `izqCae`, `derSube`, `izqSube`, `derCae`, `separar`, `juntar`, `cielo`, `swipeDer`, `swipeIzq`, `ambasSuben`, `ambasBajan`.

**Anti-solapamiento** (clave — gestos de dos manos tienen prioridad y suprimen los de una):
- `dobleVert`: si ambas manos van juntas en vertical → suena sólo la escalera (suprime drop/riser/arp/láser), aunque la escalera esté en cooldown.
- `dobleHoriz`: si ambas manos van en horizontal en sentidos opuestos (separar/juntar) → suprime los swipes de una mano (sólo stab/impacto).

**Familias** (`FAMILIAS`, `BIBLIOTECAS`): tres sets de timbres, cada uno con su paleta y su mapeo por gesto propio:
- `crazy` → "Crazy": efectos electrónicos originales (drop, riser, stab, láser, shimmer, pluck, sweep, escalera, + percusión kick/clap/hat/snare/etc.).
- `grave` → "Mate": **8 NOTAS FIJAS de la escala** (gDo='C3', gRe='D3', gMi='E3', gFa='F3', gSol='G3', gLa='A3', gSi='B3', gDo2='C4') con timbre de **órgano de iglesia electrónico/espacial** (`organSynth` fatsine + `organHi` capa de octava suave → `organFilter` → fxDelay/reverb = "del espacio"), vía helper `_organNota(nota, time)`. A diferencia de Crazy/Butiá, estas notas son FIJAS (no siguen `_acordeRoot`) → identificables, se puede "tocar" una melodía. **Familia por defecto** (`let _familia = 'grave'`). Iteró mucho (jun 2026): notas largas → techno percusivo → órgano armónico → **notas fijas Do-Re-Mi de órgano espacial** (pedido del owner).
- `aguda` → "Butiá": timbres brillantes (aBell, aGlass, aChime, aSpark, aBlip, aCrystal, aZapHi).

API audio.js: `getFamilia()`/`setFamilia(id)`, `getBiblioteca()` (paleta de la familia activa), `getAsignaciones()`/`setAsignacion(slot,id)` (mapa de la familia activa), `dispararGesto`, `previewSonido(id)`, `exportarConfig()`/`importarConfig(cfg)` (persistencia). Todos los sonidos son funciones `(time)` que se auto-registran en el looper si `time===undefined`, y están en `FX_FUNCS`.

**Sonidos tonales**: usan `_acordeRoot()`/`_acordeNotas()` (acorde actual de la progresión `STAB_CHORDS`) para afinar al groove. `_fam()` es un transpose global (hoy identidad, `_familiaSemis=0`).

**UI** (`index.html` `#config-sonidos` + main.js): botón `🎚 sonidos` en la paleta de baile abre el panel; botones de familia `.fam-btn` (Crazy/Mate/Butiá, `data-fam`); un `<select>` por gesto con la paleta de la familia activa + ▶ preview. Config guardada en localStorage (`repique_baile_config`).

**Robustez**: el loop principal (`main.js:loop`) está envuelto en `try/catch` → una excepción de Tone.js (colisión de timing) ya no congela la app; sólo se pierde ese frame.

**Looper** (`audio.js`): graba CUÁNDO se dispara cada sonido (por id) durante 2 compases y lo replaya en un `Tone.Part` cuantizado a 16n. Botón `🔁 loop`. El loop sigue sonando al salir del baile; sólo lo corta el botón verde o Stop.

## Cómo hacer deploy

Hay DOS repos: el del instrumento (este) y el Astro del sitio. El webhook GitHub→Vercel del Astro **funciona** (push a `principal` deploya producción; push a `prueba` deploya preview). Flujo:

```bash
# 1. Build del instrumento
cd /Users/damianlafferranderie/Desktop/programeitor/recursos/repique-code
npm run build --cache /tmp/npm-cache

# 2. Copiar al Astro (borrar el JS viejo con hash antes de copiar el nuevo)
ASTRO=/Users/damianlafferranderie/Desktop/programeitor/estudioprompt.com/estudioprompt
cp dist/index.html $ASTRO/public/repique-code/
rm -f $ASTRO/public/repique-code/assets/index-*.js
cp -r dist/assets/. $ASTRO/public/repique-code/assets/

# 3. Build + commit + push del Astro
cd $ASTRO && npm run build
git add public/repique-code/
git commit -m "Repique Code — descripción"
git push origin principal     # producción · (push a 'prueba' = preview)
```

La rama `prueba` del Astro es el **preview de Repique Code** (no es trabajo ajeno). Sus commits históricos (desarrollo del looper/baile) ya llegaron a producción por la vía looper-fx→main, así que hoy `prueba` y `principal` sólo difieren en un archivo generado (`.astro/content.d.ts`). Flujo: copiar el `dist` en ambas ramas por separado (no hace falta merge).

El alias estable del preview `estudioprompt-prueba.vercel.app` es manual: repuntar tras cada deploy de `prueba` (`POST /v2/deployments/<DPL>/aliases`). Token Vercel en `~/Library/Application Support/com.vercel.cli/auth.json`. Project `prj_JgzHVi1v7h2eTU9yfWt9RjxGXp7T`, team `team_ABSUeFTZC1zeHHswIAVbNDJ0`.

El repo del instrumento NO tiene remote; las ramas (baile-fx, beta-rara, candombe-1-6, looper-fx, pintura-viva) se mantienen sincronizadas a `main`.

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
