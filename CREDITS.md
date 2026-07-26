# Créditos

Repique Code usa samples de audio de terceros. **No son obra de este proyecto.**
Se redistribuyen bajo sus licencias Creative Commons originales.

Si usás, forkeás o redistribuís Repique Code, **mantené este archivo**: varias de
estas licencias exigen atribución y esa obligación viaja con la obra.

Los datos de esta página se generan desde [`public/samples/credits.json`](public/samples/credits.json).

---

## Grabación de candombe

El ritmo **Candombe 🎧** no es síntesis: es una grabación real de tambores.

| | |
|---|---|
| **Obra** | Candombe drumming loop — `zavala.muniz.2014_46`, compases 20-28 (131 BPM) |
| **Autores** | Luis Jure & Martín Rocamora — dataset *Uruguayan candombe drumming* |
| **Fuente** | [zenodo.org/records/6533068](https://zenodo.org/records/6533068) |
| **Licencia** | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — **requiere atribución** |
| **Archivo** | `public/samples/candombe/loop1.m4a` |

Un extracto de 8 compases, cortado en downbeats anotados del dataset original.
El trabajo de Jure y Rocamora en el análisis computacional del candombe es la
razón de que este ritmo suene como suena. Vale la pena leerlos.

---

## Samples de percusión (Freesound)

### Requieren atribución — CC BY 3.0

| Archivo | Sample | Autor |
|---|---|---|
| `piano/1.mp3` | [LP Bongos Low.wav](https://freesound.org/s/455504/) | [MrRentAPercussionist](https://freesound.org/people/MrRentAPercussionist/) |
| `madera/2.mp3` | [080322 Clave single hit.wav](https://freesound.org/s/50580/) | [BoilingSand](https://freesound.org/people/BoilingSand/) |
| `madera/5.mp3` | [claves_hit07.wav](https://freesound.org/s/121389/) | [soundbytez](https://freesound.org/people/soundbytez/) |

Licencia: [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/)

### Dominio público — CC0

| Archivo | Sample | Autor |
|---|---|---|
| `repique/1.mp3` | [FD808A Conga mid.wav](https://freesound.org/s/455636/) | [Uberproduktion](https://freesound.org/people/Uberproduktion/) |
| `piano/2.mp3` | [FD808A Conga low.wav](https://freesound.org/s/455637/) | [Uberproduktion](https://freesound.org/people/Uberproduktion/) |
| `madera/1.mp3` | [DXClap_02](https://freesound.org/s/710213/) | [oceansonmars](https://freesound.org/people/oceansonmars/) |
| `madera/3.mp3` | [Percussion clave like hit](https://freesound.org/s/132417/) | [Sajmund](https://freesound.org/people/Sajmund/) |
| `madera/4.mp3` | [Cowbell_01](https://freesound.org/s/710210/) | [oceansonmars](https://freesound.org/people/oceansonmars/) |

Licencia: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) — sin obligaciones.

---

## Todo lo demás es síntesis

El tambor **chico**, la clave del ritmo CANDOMByte, el drone, el órgano de la
familia Mate, las voces de Vínculos y todos los efectos del modo baile **no usan
samples**: se generan en tiempo real con [Tone.js](https://tonejs.github.io/).
En celulares el instrumento entero funciona por síntesis, sin descargar un solo
archivo de audio.

---

## Software

| | |
|---|---|
| [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) | Google — Apache 2.0. Detección de manos |
| [Tone.js](https://tonejs.github.io/) | Yotam Mann y colaboradores — MIT. Síntesis y secuenciación |
| [Vite](https://vitejs.dev/) | Evan You y colaboradores — MIT. Build |

---

## Cómo agregar un sample nuevo

Si sumás samples en un fork, **sumá también su crédito acá**. Cualquier sample
que agregues tiene que ser CC0, CC-BY, o de tu propia autoría — nada de material
con copyright ajeno ni licencias NonCommercial (romperían la libertad de uso que
da la MIT del código).

El script `npm run fetch-samples` descarga desde Freesound y regenera
`credits.json` automáticamente con la licencia correcta de cada archivo.
