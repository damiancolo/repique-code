# Registro de cambios

Cómo se fue apilando la complejidad. Este archivo es, más que una formalidad, la
evidencia de que Repique Code es una obra en crecimiento y no un producto cerrado.

Las fechas salen del historial de git.

---

## 1.9 — julio 2026 · **Primera versión pública**

El código se abre bajo licencia MIT. Se agregan `LICENSE`, `CREDITS.md`,
`CONTRIBUTING.md`, este changelog y un workflow de GitHub Pages para que cualquier
fork tenga su propia demo en vivo.

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
