# Registro de cambios

Cómo se fue apilando la complejidad. Este archivo es, más que una formalidad, la
evidencia de que Repique Code es una obra en crecimiento y no un producto cerrado.

Las fechas salen del historial de git.

---

## 1.9 — julio 2026 · **Primera versión pública**

**Modo acordes: acompañar a alguien que canta** (6 ago)
- Interruptor `♬ acordes` en música. Las mismas ocho formas dejan de ser notas
  sueltas y pasan a ser **los acordes de una tonalidad** — I, ii, iii, IV, V, vi,
  vii° y la dominante con séptima.
- **Selector de tonalidad**, las doce. Cambiar de tono no cambia ningún gesto: la
  misma canción en el tono que le venga bien a la voz. Se transporta en caliente,
  sin rehacer el gesto.
- **Tres tercios de pantalla**: cuanto más arriba están las manos, más agudo el
  registro. En el tercio grave el acorde pierde la tercera, como haría cualquier
  pianista abajo.
- Los acordes son **diatónicos**: no hay manera de tocar uno que desafine.

**Las notas suenan sin «Arrancar»** (6 ago)
- En **🎵 música** la nota de la forma suena **en cuanto la forma aparece**: no hay
  que pulsar nada. La voz de notas (el drone del cuadrilátero) se enciende sola,
  sin ritmo ni transporte detrás.
- `Arrancar` deja de ser la llave del sonido y pasa a ser lo que agrega: el
  **ritmo**. `Parar` sigue apagando todo, ritmo y notas.
- El nombre de la nota en pantalla ya no espera al `Arrancar`: aparece con ella.


El código se abre bajo licencia MIT. Se agregan `LICENSE`, `CREDITS.md`,
`CONTRIBUTING.md`, este changelog y un workflow de GitHub Pages para que cualquier
fork tenga su propia demo en vivo.

**Los tres modos, y la pintura al frente** (4–5 ago)
- La app **abre en modo pintura**. Antes había que ir a buscarlo.
- Los tres modos quedan en una fila propia con el mismo peso: **🎵 música ·
  ✏ pintura · 🕺 baile**. Música es el modo base — se está en él cuando no hay
  ninguno de los otros dos encendido.
- `Arrancar` pasa a ser interruptor: el mismo botón enciende y apaga el audio.
  Desaparece el ■ suelto que ocupaba el lugar donde ahora está 🎵.
- **Espejo ×2** y **mandala ×6** dejan de compartir un botón que ciclaba: son dos
  botones independientes y excluyentes entre sí, y **mandala arranca encendido**:
  el primer garabato ya sale simétrico sin saber nada.
- El modo baile arranca en el efecto **orbe**.
- **Guardar** sale de la paleta de pintura: vive debajo del volumen, en verde, y se
  ve en los tres modos. El dibujo se conserva al cambiar de modo, así que guarda
  igual desde música o baile.

**Se van los gestos de puño** (4–5 ago) — el puño dejó de tener función:
- Fuera el **borrador de dos puños ✊✊**. Para borrar quedan *deshacer* y *limpiar*.
- Fuera la **selección de color con puño + un dedo**. Cortaba el trazo a mitad de
  camino: bastaba con que la otra mano cerrara el puño para que se dejara de
  dibujar. Ahora **un índice estirado siempre dibuja**, sin excepción. La función
  quedó redundante con el puntero de mano, que llega a los trece colores y no a
  cinco. Se eliminaron `esPuno`, `detectarDedoColor`, `DEDO_A_COLOR` y el aro de
  progreso de la selección.

**Un negro que se pueda acertar** (5 ago) — la paleta pasa a 13 colores. El negro
va aparte, junto a «arcoíris», al doble de tamaño que los demás: es el color que
borra sobre la cámara, se usa mucho, y un blanco de 13 px es difícil de acertar
apuntando con la mano. Lleva borde propio porque sobre el fondo negro de la app un
círculo negro sin contorno sería invisible.

**Pincel fractal** (4 ago) — reemplaza al spray. Del trazo brotan formas que se
repiten a escalas menores, en seis geometrías con un botón de una letra cada una:
**o** círculos (burbujas tangentes), **h** helecho, **n** copo (cristal de seis
brazos), **r** rayo, **c** coral y **t** triángulo (Sierpinski). El azar va por un
LCG con semilla fija por estampa que cada réplica reinicia antes de dibujar: sin
eso, con mandala ×6 cada brazo dibujaría un árbol distinto y se rompería la
simetría.

**Puntero de mano** (5 ago) — se puede manejar la app sin tocar el ordenador. Con
la **mano derecha abierta** sobre la zona de los controles aparece una flecha en
la punta del índice; lo que quede debajo se marca y la **pinza** hace clic. No hay
lista de botones: se resuelve con `elementFromPoint` + `.click()`, así que sirve
para todo lo que haya en pantalla, y además emite `mouseover` para los menús que
se abren al pasar por encima.
- La llave es abrir la mano entera porque la pinza sola ya toca La/Si en modo
  música. Mientras el puntero está encendido esa mano se excluye del resto del
  procesamiento; si no, el mismo gesto que hace clic tocaría una nota.
- Sólo actúa cerca de los controles: el resto de la pantalla queda libre.
- La lateralidad sale de `handedness` de MediaPipe. Ojo con la documentación: dice
  que la etiqueta supone imagen espejada, pero con el video tal como lo entrega
  esta app `'Right'` **es** la mano derecha real. Verificado con cámara.

**Candados cerrados de entrada** (4 ago) — tempo y graves ya no se mueven con los
gestos hasta que se abre su candado a mano, así se pueden hacer notas sin
desafinar el fondo. El mouse los mueve siempre. El bloqueo total de gestos queda
atado sólo al lock de dos pinzas 🤏🤏.

**Dos imágenes, dos criterios** (5 ago) — la composición del PNG se extrajo a
`componerImagen(desenfoque)`:
- **Descarga local** → cámara **nítida**. La imagen se la queda la persona, no sale
  de su dispositivo, y se tiene que reconocer.
- **Imagen para publicar** → cámara **desenfocada** (137 px de ancho reducido,
  referido a 1920). Se sabe que estuvo alguien pero no quién: presencia sí,
  identidad no. Escrita y lista, todavía sin usar — es para el guardado con QR.

El desenfoque se hace **achicando y volviendo a agrandar**, no con `ctx.filter`.
Dos motivos: un `ctx.filter` no soportado **se ignora en silencio** y saldría la
cara nítida sin que nadie se entere; y así la fuerza **escala sola** con la
resolución, cosa que un blur en píxeles fijos no hace.

**Vínculos como familia y como obra** (17 jul)
- El modo baile arranca en la familia **Vínculos**: las 6 voces de sinte espaciales
  (`vCristal`, `vGota`, `vHalito`, `vPulso`, `vSonar`, `vVidrio`) de la obra
  homónima, tonales al acorde y ruteadas por delay + reverb.
- El overlay de Vínculos deja de ser una simulación: el flick del índice ahora
  lanza satélites **reales** en la obra embebida, vía `postMessage` con dirección y
  velocidad en unidades normalizadas. Se eliminaron ~150 líneas de simulación
  duplicada.

**Calidad de audio** (19 jun)
- Nueva cadena de dinámica en el master: compresor suave + limiter, en lugar de ir
  directo a la salida. Antes clippeaba.
- Órgano de la familia Mate rebalanceado: menos volumen, menos sustain, vías seca y
  de reverb separadas. Calidad antes que volumen.

---

## 1.8 — junio 2026

**Familias de timbres** (17 jun) — El aporte estructural más grande del ciclo.
Los sonidos del baile dejan de estar fijos y pasan a ser **sets intercambiables**
con paleta y mapeo propios:
- `Crazy` — los efectos electrónicos originales
- `Mate` — 8 notas fijas Do-Re-Mi-Fa-Sol-La-Si-Do con timbre de órgano de iglesia
  electrónico. Al ser notas fijas y no seguir el acorde, se puede *tocar melodía*.
- `Butiá` — timbres brillantes y cristalinos

Panel `🎚 sonidos` con un `<select>` por gesto y preview ▶. Todo persistido en
localStorage. El baile autoarranca el audio: ya no hay que tocar «Arrancar».

**Looper de efectos** (15 jun) — Graba *cuándo* se dispara cada sonido durante 2
compases y lo reprograma en un `Tone.Part` cuantizado a 16n, en clave con el
ritmo. El loop sobrevive al salir del modo baile.

**Sonidos electrónicos** — Los «golpes» genéricos se reemplazan por drop tonal que
aterriza en la raíz del acorde, acid blip estilo 303, reese sub sostenido, pluck
con delay y uplifter. Escaleras direccionales con las dos manos.

**Otros** — Slider de graves/agudos con candados independientes. Arranque en
CANDOMByte en lugar de Libre. Guardado de la imagen completa (cámara + dibujo) en
el modo pintura.

---

## 1.7 — junio 2026

**Modo Baile 🕺** (10 jun) — Un modo entero nuevo. Los movimientos generan efectos
visuales que brotan **delante de las palmas**, calculando la normal 3D de la mano
con la coordenada z de MediaPipe. Ocho efectos: estela (cometa), quetzal (serpiente
emplumada), partículas, fuego, rayo, ondas, orbe y galaxia.

**Gestos-efecto estilo The Blaze** — Mano izquierda que cae = drop. Derecha que
sube = riser. Manos que se separan = stab. Que se juntan = impacto. Manos al cielo
sostenidas = shimmer. Bus de delay + reverb compartido.

**Modo Pintura ✏️** — 12 colores, 4 estilos (línea, neón, spray, arcoíris), tres
tamaños, espejo ×2 y mandala ×6, deshacer de 4 pasos, y guardado en PNG. El trazo
**late con cada negra** de la música.

**Candombe grabado** (9 jun) — Ritmo `Candombe 🎧`: un loop real de 8 compases a
131 BPM del dataset CC-BY de Jure & Rocamora, extraído por HTTP Range requests de
un zip de 628 MB y cortado en downbeats anotados.

---

## 1.6 — junio 2026

Candombe de verdad. Ritmo `CANDOMByte` con la clave real **3+3+4+2+4** y
microtiming tomado de los estudios de Jure & Rocamora (palos a −8/−12 ms).
Tambor chico de dos tonos (mano y palo). Indicador de paso en la grilla.

**1.6.1** — El chasquido de la clave estaba mal: `madera/1.mp3` es un clap, no una
clave. Se agrega una categoría virtual `clave` con los tres samples reales, más un
woodblock sintetizado de respaldo. Detectado de oído.

---

## 1.5 y anteriores — mayo 2026

La base: detección de manos con MediaPipe, clasificación geométrica del
cuadrilátero formado por pulgares e índices, drone con 8 notas por forma,
secuenciador de 16 pasos, lock de tempo con dos pinzas, y el banco inicial de
patrones.
