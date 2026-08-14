# Repique Code — Guía para Claude

> **Qué es este archivo.** El contexto que se le pasa a un asistente de IA para que
> entienda el proyecto antes de tocarlo: arquitectura, convenciones y dónde vive
> cada cosa. Buena parte de Repique Code se escribió en conversación con modelos de
> lenguaje, y este archivo es lo que hace que cada sesión no arranque de cero.
>
> Está publicado a propósito. Si vas a seguir haciendo crecer esto con ayuda de IA,
> empezá por acá. Si lo modificás a mano, actualizalo cuando cambies algo
> estructural.
>
> Para humanos: [ARQUITECTURA.md](ARQUITECTURA.md) explica lo mismo pero en prosa,
> y [CONTRIBUTING.md](CONTRIBUTING.md) tiene recetas concretas.

## Qué es

Instrumento musical controlado por gestos de manos. Usa MediaPipe para detectar manos por cámara y Tone.js para síntesis de audio. Publicado en `estudioprompt.com/lab/repique-code` como iframe embebido.

Arranca en el ritmo **CANDOMByte** (índice 5, candombe sintetizado) y **abre en modo pintura**. Tiene tres modos excluyentes en `#fila-modos`: **música 🎵** (drone + secuenciador por gestos de forma; es el modo base, se está en él cuando no hay ninguno de los otros dos), **pintura ✏** y **baile 🕺** (los movimientos disparan efectos visuales y sonidos; arranca en el efecto `orbe`). El botón `Arrancar` es un interruptor del **ritmo**: las notas de música suenan solas (ver «Voz de notas sin Arrancar»).

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

## Puntero de mano (main.js)

La app se maneja **sin tocar el ordenador**: **mano derecha abierta** sobre la zona de controles → flecha en la punta del índice (`#puntero`, DOM fijo con `pointer-events:none`); **pinza** → clic.

- Sin lista de botones: `document.elementFromPoint()` + `.closest('button, a[href]')` + `.click()`. Emite además `mouseover`/`mouseenter` para los menús que se abren al pasar por encima.
- Encender exige `manoAbierta` (4 dedos extendidos + pulgar a >0.12 del índice); sostener basta con `manoSostienePuntero` (medio/anular/meñique arriba), que son los que quedan extendidos al pinzar. **La pinza sola no sirve de llave**: ya toca La/Si en modo música.
- La mano del puntero **se excluye del resto del procesamiento** (`manos.filter(m => m !== manoPuntero)` en el loop). Si no, el mismo gesto que hace clic tocaría una nota.
- Sólo actúa dentro de `ZONAS_PUNTERO` (+45 px de margen). Las cajas con `width===0` se saltean, así los paneles ocultos no cuentan.
- ⚠️ `MANO_DERECHA = 'Right'`. La doc de MediaPipe dice que la etiqueta supone imagen espejada, lo que hace esperar lo contrario. **Verificado con cámara: es 'Right'.** No cambiarlo por lo que digan los docs.

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

## Voz de notas sin «Arrancar» (audio.js + main.js)

En modo música la nota de la forma **suena en cuanto la forma aparece**, sin
pulsar nada. `Arrancar` ya no es la llave del sonido: es lo que **agrega el
ritmo**.

- `startNotas()` (audio.js) enciende **sólo el drone**: arma la cadena
  (`asegurarCadena()`, compartida con `startAudio()`), ataca `C3` con
  `droneGain` en 0 y marca `state.notasIniciadas`. **No** crea secuencias ni
  arranca el transporte.
- `state.notasIniciadas` = "la voz de notas está sonando". `startAudio()`
  también la pone en true (y no re-ataca el drone si ya sonaba: cortaría la nota
  que la mano sostiene). `stopAudio()` apaga las dos.
- En `main.js:loop`, los bloques de nota/área/tecno se guían por
  `state.notasIniciadas`, no por `audioIniciado`.
- **El navegador no abre el audio sin un gesto del usuario**, así que se intenta
  desde tres lados: al entrar a 🎵 (o al salir de ✏), al primer
  `pointerdown`/`touchend`/`keydown` de la página, y en cada frame con forma
  (`asegurarNotas()`, con 400 ms de respiro entre reintentos). `startNotas()`
  nunca lanza: devuelve `false` si sigue bloqueado. El `Promise.race` con
  timeout es obligatorio — en Chrome `resume()` sobre un contexto bloqueado por
  autoplay queda **pendiente para siempre** hasta que el usuario toque algo.
- `notasAuto` (main.js) se apaga al pulsar **Parar**: silencio es silencio, las
  notas no vuelven solas. Se reactiva con `Arrancar` o volviendo a 🎵.

## Modo acordes (acordes.js + audio.js + main.js)

**Música ENTRA EN ACORDES** (`modoAcordes = true` de arranque). Acompañar es lo
que la gente quiere hacer con esto y la nota suelta es el caso raro, así que el
interruptor de la paleta `#paleta-musica` es **`♪ notas`**: apagado = acordes.
Cada forma es **el acorde de ese grado** en la tonalidad elegida.

La paleta muestra el control del modo en el que estés: con acordes, la
tonalidad (`#fila-tono`); con notas, el instrumento (`#fila-instrumento`).

- **`src/acordes.js` es un módulo PURO**: no importa Tone ni toca el DOM. Entra
  forma + altura, salen frecuencias. Así se razona y se prueba la música sin
  arrancar el audio. `TONALIDADES` (12), `GRADO_POR_FORMA`, `frecuenciasAcorde`,
  `nombreAcorde` (devuelve cifrado **y** nombre latino: quien canta lee `Dm`
  pero piensa «Re menor»).
- **Grados**: rectángulo=I, trapecio piso=II, techo=III, izq=IV, der=V, pinza
  der=VI, pinza izq=VII, pulgares arriba=**I8** (la tónica una octava arriba).
  `dos_triangulos` queda fuera: el modo acid no tiene acorde.
- **Calidad diatónica, no elegible.** En Do el II es Dm y no hay forma de que
  salga D. Por eso no hace falta control de mayor/menor.
- ⚠️ **NO se pliega la fundamental.** Hubo un plegado que metía toda
  fundamental dentro de una misma octava, para que el acompañamiento no saltara
  de registro. Daba buena conducción de voces y **rompía la escala**: en Sol el
  IV se caía una octava y al recorrer las formas en orden el sonido bajaba a
  mitad de camino. **En Do no se notaba** —única tonalidad donde el plegado no
  llegaba a actuar—, por eso sobrevivió hasta que el owner lo escuchó. Las
  formas son una escala: tienen que subir. Hay un test que lo comprueba en las
  doce.
- **Las tres últimas tonalidades (La, Si♭, Si) envuelven una octava abajo.** Sin
  plegado, cada tonalidad abarca una octava entera desde su tónica; si las doce
  subieran en fila, las de arriba chillarían. Nadie toca dos tonalidades a la
  vez, así que el salto es invisible.

## El complemento (los dedos mayores)

**Tres niveles según cuántos mayores estén arriba.** Son las dos únicas cosas
que se le hacen a una tríada —tensarla o abrirla—, por eso son dos y hacen juego
entre sí:

- **0 dedos** → la tríada
- **1 dedo** → **la tensión**: el acorde pide volver
- **2 dedos** → **el color**: el acorde se abre

Con un dedo alcanza para el primer nivel, cualquiera de los dos: en pleno toque
no se mira la pantalla, y la línea entre los mayores ya muestra cuál está afuera.

| grado | 1 dedo · tensión | 2 dedos · color |
|---|---|---|
| I, II, III, VI, I8 | `sus4` — la cuarta echa a la tercera | `maj7` / `m7` según la tríada |
| IV | `sus2` — la cuarta de fa es si, trítono áspero | `maj7` |
| V | `7` — acá lo que pide volver es la séptima | `9` — la séptima ya la usó un dedo, sube a la novena |
| VII | `m7♭5` — sobre un disminuido no hay tensión que agregar | `m11♭5` |

Verificado con tests sobre **864 acordes** (12 tonos × 8 grados × 3 niveles × 3
tercios): los tres niveles suenan siempre distintos entre sí, ninguno repite un
acorde base, y **todas las notas caen dentro de la escala**. También se comprueba
que los tres se distingan en el tercio grave, donde el complemento conserva su
nota de color (`[r/2, quinta/2, color]`) — con la regla normal de «sin tercera»
subir el dedo abajo no se habría oído.

**En notas** la nota crece por capas: sola → **quinta** (`droneQuinta`, hueca) →
**tercera diatónica** (`droneTercera`, el acorde entero). La tercera es mayor
sobre do y menor sobre re (`TERCERA_POR_FORMA`), que es lo que mantiene todo en
tono. No puede desafinar porque no agrega notas nuevas: agrega las que ya viven
dentro de la que tocás. Cualquier complemento diatónico de una nota sería otra
nota de la escala, o sea otra forma que ya existe; por eso no puede ser una nota.

⚠️ **Medir esta voz por nivel de dB no sirve**: los osciladores desafinados
(`fattriangle`) baten entre sí y el vibrato encima, así que el RMS oscila ±4 dB
dentro de un mismo estado. Para comprobar que una capa entra hay que mirar el
**espectro** (`Tone.FFT`) en la frecuencia de esa nota, no el volumen.
- **Voicing abierto** fundamental·quinta·octava·décima. La dominante cambia la
  octava por la séptima (`[r, quinta, 7ª, décima]`) para ocupar los mismos 16
  semitonos: con un voicing más abierto, en el tercio agudo se iba a 1480 Hz.
- **Tres tercios** por `centroY` con histéresis (`LIM_AGUDO` .36, `LIM_GRAVE`
  .64, `MARGEN` .04 en main.js; render.js los dibuja y **debe copiar los mismos
  valores**). Grave = sin tercera y una octava abajo. ⚠️ El disminuido es la
  excepción: su «quinta» es un trítono y a 90 Hz es barro, así que baja sólo la
  fundamental.
- **Compromiso por TIEMPO y por lecturas a la vez** (`ACORDE_MS`=100,
  `ACORDE_LECTURAS`=3, `ACORDE_GRACIA`=50). Sólo por cuadros el instrumento
  respondería distinto en cada máquina; sólo por tiempo, una cámara lenta se
  comprometería con una única lectura. La gracia evita que un parpadeo del
  detector corte el acorde.
- **Se compara el ACORDE, no el gesto**: si la mano tiembla entre dos posturas
  que dan lo mismo, no pasa nada.
- **Cuatro voces sostenidas** en audio.js (`vocesAcorde`) que nunca se sueltan:
  cambiar de acorde es deslizar sus frecuencias (`portamento` .09). Por eso los
  cambios se funden — un golpe en cada cambio le marcaría el tiempo a quien
  canta. Filtro propio **cerrado en 1500 Hz**: la voz humana vive entre 300 Hz y
  3 kHz y todo lo que ponga energía ahí compite con ella.
- ⚠️ **En modo acordes se desactiva el candado de dos pinzas.** VI es pinza
  derecha y VII pinza izquierda: al pasar de uno a otro se atraviesa el gesto de
  bloqueo. También se saltean el filtro por altura (esa altura ahora es el
  registro) y el modo acid.
- Sin cuantización al pulso: el modo arranca **sin ritmo**, y quien canta sin
  banda hace rubato. Si algún día se enciende el candombe debajo, ahí sí tendría
  sentido que los cambios esperen al pulso.

## La figura respira (render.js + main.js:pasoRespiro)

El cuadrilátero del modo música tiene **dos canales que no se mezclan**, y
mezclarlos es el error que hay que evitar si se toca esto:

| canal | qué es | de qué depende |
|---|---|---|
| **movimiento** — los lados se arquean | la respiración | de nada: va libre |
| **brillo** — la línea se recoge y enciende | la confirmación | sólo de un cambio que entró |

- ⚠️ **Los vértices NO se mueven.** Son las yemas de los dedos, y la inclinación
  de cada lado es lo que decide si `clasificarForma` lee trapecio o rectángulo.
  Escalar la figura movería los cuatro, y el dibujo podría decir una forma
  distinta de la que el reconocedor está leyendo. Lo que respira son los LADOS,
  con `quadraticCurveTo` (`ladoArqueado`). ⚠️ Una curva cuadrática se comba **la
  mitad** del desplazamiento de su punto de control: por eso el control va al
  doble de la panza pedida. Con panza 0 la curva **es** la recta.
- **Paso humano, no técnico.** `RESPIRO_MS = 4800`: unas 12 respiraciones por
  minuto (reposo tranquilo) y a la vez dos compases a 100 bpm. `ABRIR = 0.40`
  arquea en 1,9 s y suelta en 2,9 — el 1:1,5 de inhalar y exhalar. En 0.5 exacto
  no respiraría: un vaivén simétrico se queda quieto en los dos extremos.
- **No se engancha al transporte.** El ritmo puede estar parado, que es como se
  acompaña a alguien cantando. El techo del reconocedor (`ACORDE_MS` + 3
  lecturas medidas en vivo + `HOLGURA_MS`, el viaje del brazo) queda debajo de
  red: si una máquina fuera tan lenta que no llegara a ese paso, manda el
  reconocedor. Hoy no se activa nunca — haría falta una cámara bajo 2 fps.
- **El brillo es de un hecho, no de un reloj.** `_registradoEn` se marca en los
  dos modos en el punto exacto donde cambia el sonido: al disparar `sonarAcorde`,
  al confirmar la forma con `actualizarNota`, y también al cambiar el complemento
  en notas (en acordes ya va dentro de la lectura comprometida; en notas se
  aplica sin debounce y se quedaría sin acusar). Así el destello no puede
  desincronizarse de lo que se oye.
- **Respirar BAJA el peso de la línea**, no lo sube. Es a propósito: deja libre
  el rango de arriba para el destello. Si la respiración ya brillara, el acuse
  de un cambio no tendría contra qué destacar.
- **La línea de los mayores no respira ni se arquea.** Su información es el salto
  del extremo del nudillo a la punta; con el latido encima habría dos
  movimientos en el mismo trazo. Quieta hace además de referencia contra la que
  se mide cuánto se arquearon los lados.

## Instrumentos de la voz de notas (audio.js — INSTRUMENTOS)

Cinco timbres para el modo de nota suelta: **Aire** (el original, pad tibio, por
defecto), **Cuerda** (pulsada), **Caña** (soplada), **Órgano**, **Campana** (FM).
`setInstrumento(id)` / `getInstrumento()`; botón `#btn-instrumento` + menú
`#menu-instrumento`.

Todos comparten la arquitectura de dos capas (fundamental + octava), así que
cambiar de instrumento es reconfigurar los dos sintes y su cadena — nada más.
**Lo que de verdad los diferencia es la envolvente**: sustain alto = se sostiene
mientras haya manos; sustain bajo = suena y se apaga solo, que es lo que hace
que una cuerda pulsada se sienta pulsada.

- Se aplica con `synth.set({ oscillator, envelope, volume })`, la vía idiomática
  de Tone: el OmniOscillator resuelve solo el tipo y sus parámetros extra
  (`count`/`spread` de los «fat», `harmonicity` de los «fm»). Saltar entre
  familias (fat → fm → sine) está probado y no lanza.
- Al cambiar se hace `_droneRepulsar()`: sin eso, en los de caída habría que
  esperar a la próxima forma para oír el timbre nuevo.
- ⚠️ **Los volúmenes están nivelados a oído-medido** (picos entre −4 y −10 dB).
  Si agregás uno, medilo: la primera versión tenía Caña y Órgano 8 dB por encima
  de Cuerda y cambiar de instrumento era un salto de volumen.

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

**Ranuras de gesto** (`GESTOS_BAILE`, 13 slots): 8 de una mano — `derSube`, `derCae`, `derDer` (swipe a la derecha), `derIzq` (swipe a la izquierda), `izqSube`, `izqCae`, `izqDer`, `izqIzq` — + 5 de dos manos: `separar`, `juntar` (aplaudir), `cielo`, `ambasSuben`, `ambasBajan`. Los swipes distinguen dirección por el signo de `h.vx` (canvas espejado: vx>0 = a la derecha). 

**Audio se autoarranca al entrar a baile**: el handler de `btn-baile` (main.js) es async, llama `resumeContextSync()` y `startAudio()` si `!state.audioIniciado` → el baile suena sin tocar "Arrancar".

**Anti-solapamiento** (clave — gestos de dos manos tienen prioridad y suprimen los de una):
- `dobleVert`: si ambas manos van juntas en vertical → suena sólo la escalera (suprime drop/riser/arp/láser), aunque la escalera esté en cooldown.
- `dobleHoriz`: si ambas manos van en horizontal en sentidos opuestos (separar/juntar) → suprime los swipes de una mano (sólo stab/impacto).

**Familias** (`FAMILIAS`, `BIBLIOTECAS`): tres sets de timbres, cada uno con su paleta y su mapeo por gesto propio:
- `crazy` → "Crazy": efectos electrónicos originales (drop, riser, stab, láser, shimmer, pluck, sweep, escalera, + percusión kick/clap/hat/snare/etc.).
- `grave` → "Mate": **8 NOTAS FIJAS de la escala** (gDo='C3', gRe='D3', gMi='E3', gFa='F3', gSol='G3', gLa='A3', gSi='B3', gDo2='C4') con timbre de **órgano de iglesia electrónico/espacial** (`organSynth` fatsine + `organHi` capa de octava suave → `organFilter` → fxDelay/reverb = "del espacio"), vía helper `_organNota(nota, time)`. A diferencia de Crazy/Butiá, estas notas son FIJAS (no siguen `_acordeRoot`) → identificables, se puede "tocar" una melodía. Mapeo Mate (pedido del owner): derSube=Do, derIzq=Re, derDer=Mi, derCae=Fa, izqSube=Sol, izqDer=La, izqIzq=Si, izqCae=Do↑; ambas suben=acorde Do mayor (`gAcordeDo`), separar=`gOrganoSube`, ambas bajan=`gOrganoBaja`, **juntar/aplaudir=`gOrganoHit` (ARMONÍA: acorde amplio sostenido)**, al cielo=`gPadOrgano`. El órgano va por dos vías (seca a `sfxDry` para volumen/presencia + reverb a `fxDelay` para el espacio); volúmenes subidos (organSynth +2, organHi −10) porque sonaba bajo. **Familia por defecto** (`let _familia = 'grave'`). Iteró mucho (jun 2026): notas largas → techno percusivo → órgano armónico → **notas fijas Do-Re-Mi de órgano espacial** (pedido del owner).
- `aguda` → "Butiá": timbres brillantes (aBell, aGlass, aChime, aSpark, aBlip, aCrystal, aZapHi).

API audio.js: `getFamilia()`/`setFamilia(id)`, `getBiblioteca()` (paleta de la familia activa), `getAsignaciones()`/`setAsignacion(slot,id)` (mapa de la familia activa), `dispararGesto`, `previewSonido(id)`, `exportarConfig()`/`importarConfig(cfg)` (persistencia). Todos los sonidos son funciones `(time)` que se auto-registran en el looper si `time===undefined`, y están en `FX_FUNCS`.

**Sonidos tonales**: usan `_acordeRoot()`/`_acordeNotas()` (acorde actual de la progresión `STAB_CHORDS`) para afinar al groove. `_fam()` es un transpose global (hoy identidad, `_familiaSemis=0`).

**UI** (`index.html` `#config-sonidos` + main.js): botón `🎚 sonidos` en la paleta de baile abre el panel; botones de familia `.fam-btn` (Crazy/Mate/Butiá, `data-fam`); un `<select>` por gesto con la paleta de la familia activa + ▶ preview. Config guardada en localStorage (`repique_baile_config`).

**Robustez**: el loop principal (`main.js:loop`) está envuelto en `try/catch` → una excepción de Tone.js (colisión de timing) ya no congela la app; sólo se pierde ese frame.

**Looper** (`audio.js`): graba CUÁNDO se dispara cada sonido (por id) durante 2 compases y lo replaya en un `Tone.Part` cuantizado a 16n. Botón `🔁 loop`. El loop sigue sonando al salir del baile; sólo lo corta el botón verde o Stop.

## Cómo hacer deploy

El build es estático y no depende de ningún hosting en particular:

```bash
npm run build     # queda todo en dist/
```

`dist/` se puede servir desde cualquier hosting de archivos. `vite.config.js` usa
`base: './'` (rutas relativas), así que funciona también desde un subdirectorio o
embebido en un iframe.

Los forks tienen un workflow de GitHub Pages listo en `.github/workflows/pages.yml`
(activarlo en Settings → Pages → Source: GitHub Actions).

⚠️ Los assets del build llevan hash en el nombre (ej. `index-C6z8meJ1.js`). Si
copiás `dist/` sobre un deploy anterior, borrá el JS viejo primero o vas a servir
dos bundles.

> El despliegue de la instancia oficial en `estudioprompt.com/lab/repique-code`
> usa un sitio Astro aparte, fuera de este repositorio.

## npm

```bash
npm install
```

## Tempo y graves: solo con el ratón

Se retiró el gesto de **«dos dedos pegados»** (índice y mayor a menos de 0.08,
`dosDeadosPegados`) que arrastraba los sliders, y también el mapeo de **altura de
manos → filtro**. Con ellos se fueron `tempoLocked`/`filtroLocked`, los botones
de candado 🔒 de los sliders y `dedosSobreSlider`.

**Por qué**: esa postura es exactamente la que el dedo mayor necesita como
modificador de acordes y notas (ver el mapa del mayor). Dejarla ocupada por un
control de tempo bloqueaba el camino. Y un candado que ya no traba nada es peor
que no tenerlo: promete un estado que no existe.

Queda en pie el arrastre con el ratón sobre el **track** de cada slider (ojo:
el listener está en `#tempo-slider-track`, no en el wrap) y el modo acid de los
dos triángulos, que mueve el filtro porque ahí es un efecto y no un control.

## Perfil de altavoz chico (móvil) — audio.js

`ES_MOVIL` (declarado **arriba del todo**, antes de cualquier nodo que lo use)
enciende un perfil de mezcla distinto. **No cambia ni una nota**: cambia el
timbre para que la altura sobreviva a un altavoz de teléfono.

**El síntoma**: en el iPhone el modo acordes sonaba fino y nasal; con auriculares
sonaba bien. Eso descartó la CPU y señaló el transductor.

**La causa**: las fundamentales de los acordes viven en 130–260 Hz y un altavoz
de móvil no da casi nada por debajo de 500 Hz. Encima el acorde usaba
`fattriangle`, cuyos armónicos caen como 1/n² — o sea que arriba tampoco había
nada que oír, y el filtro en 1500 Hz se comía lo poco que quedaba.

**El arreglo**, apoyado en la fundamental ausente (el oído reconstruye la nota
grave a partir de sus armónicos):

| | escritorio | móvil |
|---|---|---|
| oscilador del acorde | `fattriangle` | `triangle` + **octava en seno** |
| filtro del acorde | 1500 Hz | 2800 Hz |
| reverb del acorde | Freeverb | **ninguna** |
| filtro de la voz de notas | según instrumento | × 1.6 |
| capa de octava en notas | — | +6 dB (es la que el altavoz sí da) |
| paso-alto de salida | — | 120 Hz |

⚠️ **Aquí hubo un `fatsawtooth` y sonaba mal.** La primera versión de este perfil
(6 ago) subió la audibilidad con diente de sierra y filtro en 3200, y se validó
midiendo **dB**, o sea CUÁNTO se oye. Funcionaba para eso y era horrible: metía
el triple de energía entre 500 Hz y 2 kHz, justo la banda donde el altavoz de un
teléfono es más eficiente y más chillón. Audible y áspero a la vez.

**La lección: medir el nivel no mide el timbre.** Si tocás este perfil, mirá
también el REPARTO por bandas, no sólo el RMS.

La versión de ahora rescata la altura con puntería en vez de a lo bruto:
triángulo (armónicos que caen rápido) **más una octava en seno por voz**, al
mismo nivel que la fundamental. El oído reconstruye la grave a partir de esa
octava sin llenar de armónicos la banda incómoda. Medido: **13% de energía en
medios en vez de 23%, y un 19% más audible** en un altavoz de teléfono simulado.
Verificado además en la cadena real con el navegador emulando un móvil: a 130 Hz
−33,4 dB y a 261 Hz −32,8, o sea la octava tan presente como la fundamental (en
escritorio los 261 Hz quedan 1,8 dB por debajo, que es el armónico natural).

La **octava vive dentro de cada voz** (`vocesAcorde[i].octava`, sólo en móvil) y
va por el mismo `gain`, así el acorde entra, se desliza y sale de una pieza. Si
tocás `_acordeAtaque`, `_acordeSuelta` o `sonarAcorde`, la octava tiene que
seguir a su voz en los tres sitios o queda colgada.

Y la **reverb del acorde no se conecta en móvil**: Freeverb son ocho peines y
cuatro pasa-todo —el nodo más caro de la cadena— y su cola vive en los
graves-medios, justo lo que ese altavoz no reproduce. Lo que llegaba no era
espacio, era barro encima de la nota. La voz de NOTAS conserva la suya.

⚠️ **Los volúmenes están medidos, no estimados.** Renderizando fuera de línea el
acorde de Do por dos paso-alto en cascada a 500 Hz (un altavoz de teléfono
simulado): el perfil de escritorio **pierde 14,4 dB** por ese altavoz, el móvil
sólo 3. La base del oscilador quedó en **−9 dB** tras barrer valores: con −13 el
altavoz ganaba 4,4 dB pero el total caía 7 y con auriculares habría quedado
bajo; con −9 el altavoz gana 8,4 y el total sólo baja 3.

**Cómo se mide esto sin dispositivo**: `OfflineAudioContext`, la cadena real, y
comparar el RMS con y sin el altavoz simulado. No hace falta gesto de usuario ni
que el contexto esté corriendo — que es justo lo que no se puede tener en un
entorno sin cámara ni altavoz.

## Trampas que ya nos costaron una sesión

- **Asignar a una variable no declarada NO crea un global.** Los módulos ES son
  estrictos: lanza `ReferenceError`. Un `zoomActivo = false` sobrevivió meses en
  `apagarPintura()` después de que se borrara la función de zoom, y hacía que
  **el primer clic en 🎵 no hiciera nada** — la excepción mataba el resto del
  handler. Si un botón «no hace nada», mirar la consola antes que el CSS.
- **Tone exige que cada ataque caiga ESTRICTAMENTE después del anterior.** Dos
  `triggerAttack` en el mismo cuadro comparten el instante del reloj y lanzan
  «Start time must be strictly greater than previous start time». Pasaba al
  salir de acordes a notas con una figura ya en pantalla. Por eso los ataques de
  la voz de notas van por `_atacarVocesNota()`, que lleva la cuenta del último
  instante y empuja 2 ms si hace falta.
- **Un canvas de ancho 0 hace que `drawImage` lance.** Si la página carga sin
  tamaño (iframe todavía sin medidas), `innerWidth` es 0 y guardar moría en
  silencio. `redimensionar()` clampa a 1 y el loop reajusta si el tamaño cambió
  sin que llegara un `resize`.
- **Para depurar la interfaz sin cámara**: copiar `index.html` a un archivo
  temporal e inyectar antes del `<script type="module">` un
  `navigator.mediaDevices.getUserMedia` falso que devuelva
  `canvas.captureStream()`. `init()` no aborta, se registran todos los handlers
  y se pueden pulsar los botones desde la consola. Es la única forma de
  reproducir bugs de UI en un entorno sin webcam.

## Notas técnicas

- MediaPipe se carga desde CDN (no bundle local) — requiere internet
- Canvas espejado: coordenadas X se invierten con `(1 - p.x) * w`
- `FRAMES_FORMA = 4` frames para confirmar una forma (debounce)
- `FRAMES_DOS_PINZAS = 8` frames para activar el lock
- iOS/WebKit: `resumeContextSync()` debe llamarse síncronamente en el evento de click
- Samples de producción en `public/samples/`, referenciados via `credits.json`
- Assets del build tienen hash en el nombre (ej: `index-C6z8meJ1.js`) — al actualizar, borrar el JS viejo del Astro antes de copiar el nuevo
