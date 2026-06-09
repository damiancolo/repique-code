# Repique Code 1.4

Instrumento de percusión candombera controlado por gestos de manos vía cámara web. Desarrollado por [Estudioprompt](https://estudioprompt.com).

Publicado en: [estudioprompt.com/lab/repique-code](https://estudioprompt.com/lab/repique-code)

## Requisitos

- Node.js 18+
- Chrome o Safari desktop (requiere HTTPS o localhost para acceder a la cámara)
- Conexión a internet en la primera carga (descarga el modelo de MediaPipe, ~35 MB)

## Instalación y desarrollo

```bash
npm install --cache /tmp/npm-cache
npm run dev
```

Abrir `http://localhost:5173` (o el puerto que indique Vite).

## Gestos

| Gesto | Nota |
|-------|------|
| Rectángulo — manos simétricas | Do |
| Trapecio piso — base más ancha | Re |
| Trapecio techo — techo más ancho | Mi |
| Trapecio izq. — lado izq. más largo | Fa |
| Trapecio der. — lado der. más largo | Sol |
| Pinza der. — pulgar+índice derechos juntos | La |
| Pinza izq. — pulgar+índice izquierdos juntos | Si |
| Pulgares ↑ — ambos pulgares arriba | Do₂ |
| Manos cruzadas (✕) | Modo acid |
| Dos pinzas simultáneas | Bloquear/desbloquear tempo y tono |

| Parámetro | Control |
|-----------|---------|
| Altura de las manos | BPM (80 abajo → 180 arriba) |
| Apertura horizontal | Filtro (abierto/cerrado) |
| Área entre dedos | Volumen del drone |

## Stack

- [Vite](https://vitejs.dev/)
- [@mediapipe/tasks-vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) — detección de manos
- [Tone.js](https://tonejs.github.io/) — síntesis y secuenciación de audio

## Estructura de fuentes

```
src/
  main.js    — bootstrap, loop principal, controles UI
  hands.js   — detección MediaPipe, clasificación geométrica de gestos
  audio.js   — motor de audio: secuenciador, synths, drone, modos house/acid
  render.js  — canvas: video espejado + overlay de gestos
  state.js   — estado global compartido entre módulos
public/
  samples/   — samples de percusión
scripts/
  fetch-samples.js  — descarga samples desde Freesound
  regen-credits.js  — regenera credits.json
```

## Deploy

El proyecto se sirve como app estática dentro del sitio Astro de Estudioprompt, en la ruta `/repique-code/`.

```bash
# 1. Hacer cambios en src/ o index.html

# 2. Build
npm run build

# 3. Copiar dist/ al Astro
ASTRO=/Users/damianlafferranderie/.gemini/antigravity/scratch/estudioprompt
cp dist/index.html $ASTRO/public/repique-code/
cp dist/logo-ep.png $ASTRO/public/repique-code/
cp -r dist/assets $ASTRO/public/repique-code/

# 4. Deploy del Astro
cd $ASTRO
npm run build
git add public/repique-code/
git commit -m "Repique Code — descripción del cambio"
git push origin main
```

> Ruta del proyecto Astro: `/Users/damianlafferranderie/.gemini/antigravity/scratch/estudioprompt/`
> URL de producción: `https://estudioprompt.com/lab/repique-code`
