# Repique Code

**Un instrumento de percusión candombera que se toca con las manos en el aire.**

La cámara ve tus manos. Un modelo de visión las convierte en 21 puntos por mano.
Según cómo las movés, se dispara sonido, ritmo, efectos visuales y dibujo.
Todo pasa en tu navegador: **el video nunca sale de tu dispositivo.**

🎛 **[Probalo acá →](https://estudioprompt.com/lab/repique-code)**

[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-8b1a2c)](LICENSE)
[![Sin backend](https://img.shields.io/badge/backend-ninguno-333)](ARQUITECTURA.md)
[![Hecho en Uruguay](https://img.shields.io/badge/hecho%20en-Uruguay-4a90d9)](https://es.wikipedia.org/wiki/Candombe)

---

## Esto es una obra abierta, no una obra terminada

Repique Code no está "listo". Está **creciendo**.

Empezó como un experimento de detectar manos con la cámara y terminó siendo un
instrumento con tres modos, ocho ritmos editables, cuatro familias de timbres, un
looper cuantizado y un modo de pintura que late con el beat. Cada capa se agregó
encima de la anterior, durante meses, en diálogo con modelos de IA. La complejidad
no fue planificada: **se acumuló**. Y va a seguir acumulándose.

El código es libre justamente por eso. Bajalo, rompelo, cambiale los sonidos,
inventale gestos, sacale el candombe y ponele otra cosa. **No hace falta pedir
permiso ni devolver nada.** Si hacés algo raro con él, me encantaría verlo:
abrí un issue y mostralo.

---

## Qué hace

Tres modos, todos con las manos:

| Modo | Qué pasa |
|---|---|
| 🥁 **Normal** | Formás figuras con pulgares e índices → un drone cambia de nota. La altura de las manos mueve el filtro, la apertura el volumen. De fondo corre un secuenciador de 16 pasos. |
| ✏️ **Pintura** | Tu índice dibuja en el aire. 12 colores, 4 estilos (línea, neón, spray, arcoíris), espejo y mandala. El trazo **late con cada negra** de la música. |
| 🕺 **Baile** | Tus movimientos disparan sonidos: manos que suben, que caen, que barren, que se juntan. 13 gestos × 4 familias de timbres, con un looper que los graba y los repite en clave. |

### Los ritmos

Ocho patrones de 5 instrumentos × 16 pasos, **todos editables en tiempo real**
(clic en una celda de la grilla y suena en la próxima pasada):

`El cualca` · `House` · `Dos pulsos` · `Escalera` · `Libre ✎` · **`CANDOMByte`** · `Candombe 🎧` · `Techno`

**CANDOMByte** (el que arranca por defecto) es candombe sintetizado con la clave
real 3+3+4+2+4 y microtiming tomado de los estudios de Jure & Rocamora.
**Candombe 🎧** no es síntesis: es una grabación real de tambores uruguayos.

---

## Correlo en tu máquina

```bash
git clone https://github.com/damiancolo/repique-code.git
cd repique-code
npm install
npm run dev
```

Abrí `http://localhost:5173` y dale permiso a la cámara.

**Necesitás:**
- Node.js 18 o más
- Un navegador con cámara — Chrome, Edge o Safari
- Internet en la primera carga (baja el modelo de MediaPipe, ~35 MB, desde CDN)
- `localhost` o **HTTPS**: los navegadores no dan acceso a la cámara sin eso

En celulares funciona, pero por síntesis directa (no baja los samples).

### Publicar tu propia versión

El build es estático (`index.html` + un bundle + assets) y usa rutas relativas,
así que se sirve desde cualquier lado:

```bash
npm run build   # queda todo en dist/
```

Si forkeás el repo en GitHub, el workflow incluido en
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) te deja **tu propia
demo en vivo** en GitHub Pages con cada push a `main`. Solo tenés que activar
Pages en *Settings → Pages → Source: GitHub Actions*.

---

## Gestos

### Notas del drone (cuadrilátero con pulgares e índices)

| Gesto | Nota |
|---|---|
| ✋🤚 Rectángulo — manos simétricas | Do |
| 🤲 Trapecio piso — base más ancha | Re |
| 🙌 Trapecio techo — techo más ancho | Mi |
| ✋🤏 Trapecio izquierdo | Fa |
| 🤏✋ Trapecio derecho | Sol |
| ✋👌 Pinza derecha | La |
| 👌✋ Pinza izquierda | Si |
| 👍👍 Pulgares arriba | Do₂ |
| 🤞🤞 Manos cruzadas | Modo acid |

### Controles continuos

| Gesto | Controla |
|---|---|
| Altura del cuadrilátero | Filtro (arriba agudos, abajo graves) |
| Área entre los dedos | Volumen del drone |
| ☝🤞 Puntas juntas sobre un slider | Tempo (80–180 BPM) o graves |
| 🤏🤏 Dos pinzas | Bloquear tempo y filtro · ✌️ desbloquea |

La guía completa está dentro de la app (botón **Guía completa →**), incluidos los
13 gestos del modo baile y los del modo pintura.

---

## Cómo está hecho

Sin framework. Sin backend. Sin base de datos. Dos dependencias.

| Capa | Tecnología |
|---|---|
| Lenguaje | JavaScript puro (ES Modules), HTML, CSS |
| Visión | [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) — Hand Landmarker |
| Audio | [Tone.js](https://tonejs.github.io/) sobre Web Audio API |
| Gráficos | Canvas 2D nativo |
| Build | [Vite](https://vitejs.dev/) |

```
index.html      UI, estilos y guía de gestos
src/
  main.js       Bucle principal (~60 fps), los 3 modos, controles
  hands.js      MediaPipe + clasificación geométrica de formas
  audio.js      Motor Tone.js: secuenciador, drone, familias, looper
  render.js     Canvas: video espejado + overlays
  state.js      Estado global compartido
public/samples/ Samples de percusión (ver CREDITS.md)
```

📐 **[ARQUITECTURA.md](ARQUITECTURA.md)** explica en detalle cómo funciona cada
pieza y por qué está hecha así.

---

## Modificarlo

Esa es la idea. **[CONTRIBUTING.md](CONTRIBUTING.md)** tiene recetas concretas:

- Agregar un **timbre** nuevo al modo baile
- Agregar un **ritmo** al banco de patrones
- Agregar una **familia** completa de sonidos
- Agregar un **gesto** nuevo
- Cambiar los **samples** por los tuyos

No hace falta que abras un PR. Forkealo y hacelo tuyo. Pero si querés que tu
cambio viva acá también, los PRs son bienvenidos.

---

## Hecho con IA, y a la vista

Buena parte de este código se escribió en conversación con modelos de lenguaje,
a lo largo de decenas de sesiones. Eso no se esconde: se documenta.

El archivo [`CLAUDE.md`](CLAUDE.md) es el mapa que le paso a la IA para que
entienda el proyecto — arquitectura, convenciones, dónde toca cada cosa. Está
publicado a propósito: si vas a seguir haciendo crecer esto con asistencia de IA,
ese archivo es tu punto de partida. Y el [CHANGELOG](CHANGELOG.md) es el registro
de cómo la complejidad se fue apilando, versión a versión.

Es un experimento sobre qué pasa cuando una obra deja de tener un estado final y
pasa a tener solo estados sucesivos.

---

## Licencia

**Código: [MIT](LICENSE).** Usalo, copialo, modificalo, vendelo si querés. Solo
mantené el aviso de copyright.

**Samples de audio: CC0 y CC-BY**, de terceros. No son obra de este proyecto y
varios exigen atribución → **[CREDITS.md](CREDITS.md)**. Si redistribuís, ese
archivo va con vos.

---

## In English

**Repique Code** is a gesture-controlled Uruguayan candombe percussion instrument
that runs entirely in the browser. A webcam tracks your hands with MediaPipe;
Tone.js turns your movements into rhythm, drone, synth voices and reactive
visuals. No backend, no framework, two dependencies — your camera feed never
leaves your device.

It is an **open, unfinished work**: it has grown in layers over months in
collaboration with AI models, and it is meant to keep growing. Fork it, break it,
take it somewhere else. Code is MIT; audio samples are CC0/CC-BY (see
[CREDITS.md](CREDITS.md)).

```bash
npm install && npm run dev
```

---

Hecho en Uruguay por [Estudioprompt](https://estudioprompt.com) 🇺🇾
