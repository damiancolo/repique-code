# Repique Code — Arquitectura, stack y tecnología

> Instrumento musical que se toca con **gestos de las manos** frente a la cámara.
> Funciona 100% en el navegador, sin instalar nada y sin servidor.
> Publicado en `estudioprompt.com/lab/repique-code`.

---

## 1. En una frase

La cámara ve tus manos, un modelo de visión las convierte en puntos, y según
cómo las movés se dispara **sonido** (síntesis en tiempo real) y **gráficos**
(efectos sobre un canvas). Todo ocurre en tu propia computadora/teléfono.

---

## 2. Stack tecnológico

| Capa | Tecnología | Para qué |
|---|---|---|
| **Lenguaje** | JavaScript (ES Modules), HTML y CSS | Sin framework (ni React ni Vue): JS "a mano", liviano |
| **Visión por computadora** | [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) `@mediapipe/tasks-vision` (Hand Landmarker) | Detecta hasta 2 manos y 21 puntos por mano, en la GPU |
| **Audio** | [Tone.js](https://tonejs.github.io/) (sobre la Web Audio API) | Síntesis y secuenciación de sonido en tiempo real |
| **Gráficos** | Canvas 2D (API nativa del navegador) | Video espejado + efectos visuales del modo baile |
| **Bundler / dev** | [Vite 5](https://vitejs.dev/) | Servidor de desarrollo y empaquetado para producción |
| **Hosting** | Sitio **Astro** estático en **Vercel** | Sirve el instrumento como página embebida (iframe) |

**Dependencias reales** (`package.json`): solo dos en producción —
`@mediapipe/tasks-vision` y `tone`. No hay backend, base de datos ni API propia.

---

## 3. Principios de diseño

- **Todo en el cliente**: no hay servidor que procese imágenes ni audio. La cámara
  **nunca sale del dispositivo** → privacidad por diseño y latencia mínima.
- **Sin framework**: el núcleo es un bucle de animación (`requestAnimationFrame`)
  en JavaScript puro. Menos peso, control total del tiempo real.
- **Estático**: el build es un `index.html` + un bundle JS + assets. Se puede
  servir desde cualquier hosting de archivos (acá, Vercel vía Astro).
- **Resiliente**: el bucle principal está envuelto en `try/catch`; si un cuadro
  falla (p. ej. una colisión de tiempo en el audio), se ignora ese cuadro y la
  app sigue, nunca se congela.

---

## 4. Estructura del código

```
index.html        UI, estilos y guía de gestos (todo el layout y CSS)
src/
  main.js         Bucle principal (~60 fps), los 3 modos, controles de UI,
                  detección de gestos de movimiento → acciones
  hands.js        Envoltorio de MediaPipe: detectarManos() y clasificación
                  de formas/gestos (rectángulo, trapecios, pinzas, etc.)
  audio.js        Motor Tone.js: secuenciador de 16 pasos, drone, filtros,
                  sonidos del baile, familias de timbres y looper
  render.js       Dibujo en canvas: video espejado en gris + overlays
  state.js        Estado global compartido { bpm, volumen, audioIniciado, ... }
```

(~5.000 líneas en total; el grueso está en `main.js` y `audio.js`.)

---

## 5. El flujo de datos (el corazón del sistema)

En cada cuadro (~60 veces por segundo), el bucle de `main.js` hace:

```
  cámara (video)
      │
      ▼
  MediaPipe Hand Landmarker  ──►  21 puntos 3D por mano (hasta 2 manos)
      │
      ▼
  interpretación de gestos (main.js / hands.js)
      │
      ├──►  AUDIO   (audio.js → Tone.js → parlantes)
      └──►  GRÁFICOS (render.js + efectos → canvas)
```

- MediaPipe corre en modo **VIDEO** con **delegado GPU** → rápido y fluido.
- Los puntos llegan como coordenadas normalizadas (0–1); el código las pasa a
  píxeles y las **espeja** (`x → 1 − x`) para que se sienta como un espejo.
- A partir de los puntos se calculan: forma del cuadrilátero entre las manos,
  velocidad de cada mano, distancia entre manos, etc.

---

## 6. Los tres modos

| Modo | Cómo se activa | Qué hace |
|---|---|---|
| **Instrumento** (normal) | por defecto | Un secuenciador de ritmo de fondo + un *drone* cuya nota cambia con la **forma** de las manos (rectángulo = Do, trapecios = Re/Mi/Fa/Sol, pinzas = La/Si…) |
| **Pintura ✏** | botón ✏ | Las manos pintan sobre el canvas (colores, estilos, espejo/mandala, deshacer); el trazo "late" con el ritmo |
| **Baile 🕺** | botón 🕺 | Los **movimientos** disparan efectos visuales y **sonidos**; cada gesto se puede asociar a un sonido elegido |

---

## 7. Motor de audio (Tone.js)

Tone.js es una capa sobre la Web Audio API que facilita crear sintetizadores,
secuenciar en una grilla musical y encadenar efectos. En Repique Code:

- **Secuenciador de 16 pasos** con un banco de ritmos (`BANCO_PATRONES`),
  editable en vivo desde el visualizador. Arranca en **CANDOMByte** (un candombe
  sintetizado). En desktop usa samples reales; en móvil, síntesis directa.
- **Drone**: un oscilador sostenido cuya nota la fija la forma de las manos, con
  filtro (graves/agudos) y volumen controlados por la apertura de las manos.
- **Sonidos del baile**: cada gesto de movimiento llama a `dispararGesto(slot)`,
  que resuelve qué sonido suena según la **familia** activa.
- **Familias de timbres** (elegibles con un botón, configurables por gesto y
  guardadas en `localStorage`):
  - **Crazy** — efectos electrónicos (drop, riser, stab, láser, etc.).
  - **Mate** — órgano de iglesia electrónico/espacial; cada gesto es una **nota**
    (Do-Re-Mi-Fa-Sol-La-Si-Do), para tocar melodías.
  - **Butiá** — timbres agudos y cristalinos.
- **Looper**: graba *cuándo* se dispara cada sonido durante 2 compases y lo
  reproduce en bucle cuantizado a la grilla → queda "en clave" con el ritmo.
- **Buses de efecto**: los sonidos pasan por *delay* + *reverb* (espacio) y/o por
  una vía seca (presencia), y todo se mezcla en un `masterGain` hacia los parlantes.

---

## 8. Detección de manos y gestos

- **Formas** (modo instrumento): se clasifica el cuadrilátero formado por pulgares
  e índices de ambas manos → rectángulo, trapecios, pinzas, manos cruzadas, etc.
- **Movimientos** (modo baile): se sigue cada palma con su velocidad. Hay 13
  gestos: 8 de una mano (cada mano sube / baja / barre a la derecha / barre a la
  izquierda) y 5 de dos manos (separar, juntar/aplaudir, manos al cielo, ambas
  suben, ambas bajan). Los gestos de dos manos tienen prioridad para que no se
  solapen sonidos.
- **Atajos por gesto**: bloqueo de tempo (dos pinzas), control de sliders
  (puntas juntas), etc.

---

## 9. Render (canvas)

- El video de la cámara se dibuja **espejado y en escala de grises** como fondo.
- Encima, un segundo canvas dibuja los efectos del baile (estela, fuego, rayo,
  galaxia, partículas…) con composición aditiva (`lighter`) y gradientes.
- Todos los arreglos de partículas tienen tope y decaimiento para no crecer sin
  control (rendimiento estable).

---

## 10. Build y publicación

```bash
npm run dev      # desarrollo local (Vite)
npm run build    # genera dist/ (index.html + assets con hash)
```

El `dist/` se copia a la carpeta pública del sitio **Astro**
(`public/repique-code/`) y se publica en **Vercel** con un `git push`
(rama `principal` = producción, rama `prueba` = preview). El instrumento se
muestra embebido en la página del lab mediante un `<iframe>`.

---

## 11. Decisiones y restricciones técnicas

- **MediaPipe se carga desde CDN** (modelo + WASM): requiere conexión a internet
  la primera vez.
- **iOS/WebKit**: el contexto de audio debe reanudarse de forma **síncrona** en el
  gesto de toque del usuario (`resumeContextSync`), por eso el audio arranca al
  tocar un botón (o al entrar al modo baile).
- **Móvil**: se saltea la carga de samples y se usa síntesis directa, para evitar
  cuelgues por descarga.
- **Canvas espejado**: las coordenadas X se invierten para que la imagen funcione
  como un espejo (lo que esperás al verte en cámara).
- **Assets con hash**: cada build nombra el JS con un hash; al actualizar hay que
  borrar el viejo antes de copiar el nuevo.

---

*Documento de arquitectura — Repique Code. Mantener junto a `CLAUDE.md` (guía
técnica detallada para desarrollo).*
