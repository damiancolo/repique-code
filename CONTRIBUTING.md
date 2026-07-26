# Modificar Repique Code

Este proyecto existe para ser modificado. No es una biblioteca con una API estable
que hay que respetar: es un instrumento inacabado al que le podés cambiar lo que
quieras.

**No hace falta que abras un PR.** Forkealo y hacelo tuyo. Si además querés que tu
cambio viva acá, mejor todavía — abajo está cómo.

---

## Arrancar

```bash
git clone https://github.com/damiancolo/repique-code.git
cd repique-code
npm install
npm run dev
```

No hay tests ni linter. El ciclo de trabajo es: cambiar, mirar la pantalla,
escuchar. Vite recarga solo.

Leé [ARQUITECTURA.md](ARQUITECTURA.md) antes de meter mano en algo grande.

---

## Recetas

### Agregar un timbre nuevo al modo baile

Los sonidos del baile son funciones `(time)` registradas en un mapa. Tres pasos,
todos en `src/audio.js`:

**1. Escribí la función.** Recibe un `time` opcional; si viene `undefined` es un
disparo en vivo y hay que avisarle al looper:

```js
function miSonido(time) {
  const now = time ?? Tone.now()
  if (time === undefined) _registrarFx('miSonido')   // ← lo hace grabable
  // ...tu síntesis Tone.js acá
}
```

Si querés que suene afinado con el groove, usá `_acordeRoot()` o `_acordeNotas()`
para tomar el acorde actual de la progresión.

**2. Registralo** en `FX_FUNCS`:

```js
const FX_FUNCS = {
  // ...
  miSonido,
}
```

**3. Sumalo a una familia** en `BIBLIOTECAS`, para que aparezca en el `<select>`
del panel `🎚 sonidos`:

```js
const BIBLIOTECAS = {
  crazy: [ /* ... */ { id: 'miSonido', nombre: 'Mi sonido' } ],
}
```

Listo: ya se puede asignar a cualquier gesto, previsualizar con ▶ y grabar en el
looper.

### Agregar una familia entera de timbres

Una familia es un set de timbres con su propia paleta y su propio mapeo por gesto.
En `src/audio.js`:

1. Entrada en `FAMILIAS` con el id y el nombre visible.
2. Entrada en `BIBLIOTECAS[tuFamilia]` con la lista de sonidos.
3. Un mapeo por defecto que reparta esos sonidos en las 13 ranuras de `GESTOS_BAILE`.
4. Un botón `<button class="fam-btn" data-fam="tuFamilia">` en `#config-familia`
   dentro de `index.html`.

**No hay que tocar `main.js`**: el sistema de familias es genérico, itera sobre
los `.fam-btn` del DOM y llama a `getBiblioteca()`.

### Agregar un ritmo

En `src/audio.js`, un objeto al array `BANCO_PATRONES` con 5 tracks × 16 pasos.
Los valores van de 0 a 1 (son velocity, no booleanos — ahí está la humanización):

```js
{
  nombre: 'Mi ritmo',
  piano:   [1,0,0,0, 0.8,0,0,0, 1,0,0,0, 0.8,0,0,0],  // kick
  repique: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],      // snare
  chico:   [0.6,0.4,0.6,0.4, /* ... */],               // hihat
  madera:  [/* ... */],                                // clave
  bombo:   [/* ... */],                                // sub-grave
}
```

Después, un botón en `#menu-ritmo` (`index.html`) con `data-ritmo="N"`, donde `N`
es el índice en el array. Tiene que coincidir con el orden del array o el menú
queda desfasado.

### Agregar un gesto

Depende de qué tipo de gesto sea:

- **Gesto de forma** (posición estática de las manos): en `src/hands.js`, dentro
  de `clasificarForma()`. Se confirma tras `FRAMES_FORMA = 4` cuadros para evitar
  parpadeo.
- **Gesto de movimiento** (velocidad, para el modo baile): en `src/main.js`,
  dentro de `detectarGestosMusica()`. Cada mano tiene `vx`/`vy` en `_baileHands`.

⚠️ **Ojo con el solapamiento.** Es el problema más molesto de este código. Los
gestos de dos manos tienen prioridad sobre los de una: si detectás algo nuevo,
fijate en las banderas `dobleVert` y `dobleHoriz` para no disparar dos cosas a la
vez. Y usá un cooldown (`_coolGesto`), o el gesto se dispara 60 veces por segundo.

⚠️ **El canvas está espejado.** Las X se invierten con `(1 - p.x) * w`. Un `vx > 0`
significa movimiento **hacia la derecha en pantalla**, que es la izquierda real de
quien se está filmando. Cuesta acostumbrarse.

### Cambiar los samples

Los samples viven en `public/samples/`, organizados por categoría
(`repique/`, `piano/`, `madera/`, `candombe/`). Podés reemplazarlos por los tuyos
sin tocar código, respetando los nombres.

Si sumás archivos nuevos, **actualizá [CREDITS.md](CREDITS.md)**. Y usá solo
material CC0, CC-BY o de tu autoría: nada con copyright ajeno ni licencias
NonCommercial, que romperían la libertad que da la MIT del código.

El script `npm run fetch-samples` baja desde Freesound y regenera `credits.json`
con la licencia correcta de cada archivo. Necesita una API key gratuita de
Freesound en `.env` (ver [`.env.example`](.env.example)).

---

## Cosas que conviene saber antes de romperte la cabeza

Están todas aprendidas a los golpes:

- **`Tone.Sequence` no relee un array mutado.** Si editás un patrón en vivo, hay
  que re-armar la secuencia (`cambiarRitmo`). Este bug hizo que el editor Libre no
  sonara en tiempo real durante varias versiones.
- **`Transport.nextSubdivision()` devuelve tiempo de AudioContext**, pero
  `scheduleOnce` y `Part.start` esperan TransportTime (ticks desde 0). Mezclarlos
  hace que las cosas no pasen nunca, silenciosamente. Calculá en ticks.
- **iOS/WebKit exige `resumeContextSync()` sincrónico** dentro del handler del
  click. Si lo llamás después de un `await`, no suena nada y no hay error.
- **El bucle principal está en `try/catch`** a propósito. Una excepción de timing
  de Tone.js congelaba la app entera; ahora solo se pierde ese cuadro.
- **Los assets del build llevan hash** en el nombre. Si copiás `dist/` a algún
  lado, borrá el JS viejo antes o vas a servir dos bundles.
- **MediaPipe se baja de CDN**, no está en el bundle. Sin internet, la primera
  carga falla.

---

## Estilo

Nada estricto, pero para que el código siga leyéndose parejo:

- JavaScript puro, ES Modules. **No agregues un framework.** Media parte de la
  gracia es que esto sean dos dependencias.
- Comentarios en español, como el resto.
- Funciones cortas en `main.js`; la síntesis pesada va a `audio.js`.
- Si agregás una dependencia, justificá por qué en el PR. El listón es alto.

---

## Pull requests

1. Forkeá y hacé una rama desde `main`.
2. Probalo de verdad: cámara encendida, con audio, en desktop **y** en celular si
   tocaste algo del motor de audio (en móvil no hay samples, es todo síntesis).
3. Contá **qué se escucha o se ve distinto**. Un video corto o un GIF vale más que
   tres párrafos, en un proyecto que es sonido y movimiento.
4. Si agregaste samples, actualizá `CREDITS.md`.

## Issues

Sirven igual para reportar bugs que para mostrar qué hiciste con tu fork. Lo
segundo es, honestamente, más interesante.

---

## Sobre trabajar con IA acá

Buena parte de este proyecto se escribió conversando con modelos de lenguaje. Si
vas por ese camino, [`CLAUDE.md`](CLAUDE.md) es el archivo de contexto que se le
pasa al asistente: arquitectura, convenciones y dónde vive cada cosa. Mantenerlo
actualizado cuando cambiás algo estructural es lo que hace que la próxima sesión
no arranque de cero.

No hay ninguna regla en contra del código generado por IA. La regla es la de
siempre: **probalo, escuchalo, y hacete cargo de lo que mandás.**
