# Repique Code

Instrumento de percusión candombera controlado por gestos de manos vía cámara web. Desarrollado por [Estudioprompt](https://estudioprompt.com).

## Requisitos

- Node.js 18+
- Chrome o Safari desktop (requiere HTTPS o localhost para acceder a la cámara)
- Conexión a internet en la primera carga (descarga el modelo de MediaPipe, ~35 MB)

## Instalación y desarrollo

```bash
npm install --cache /tmp/npm-cache
npm run dev
```

Abrir `http://localhost:3333` en el navegador (o el puerto que indique Vite).

## Uso

1. Permitir acceso a la cámara cuando el navegador lo solicite.
2. Esperar a que cargue el modelo (~2–5 segundos).
3. Hacer click en **Iniciar audio** para desbloquear el motor de sonido.
4. Con dos manos frente a la cámara, el área entre pulgares e índices controla tempo y timbre.

## Gestos

| Gesto | Efecto |
|-------|--------|
| Manos separadas horizontalmente | BPM sube (60–160) |
| Manos juntas | BPM baja |
| Manos arriba | Filtro abierto (treble) |
| Manos abajo | Filtro cerrado (bass) |
| Área grande entre dedos | Nota sostenida más fuerte |
| Cambiar forma del cuadrilátero | Cambia la nota (6 formas = 6 notas) |

## Stack

- [Vite](https://vitejs.dev/)
- [@mediapipe/tasks-vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
- [Tone.js](https://tonejs.github.io/)

## Estructura

```
src/
  main.js    — bootstrap
  hands.js   — detección y clasificación geométrica de manos
  audio.js   — secuenciador y modulación con Tone.js
  render.js  — canvas (video + overlay)
  state.js   — estado compartido
```
