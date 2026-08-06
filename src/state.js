// Estado global compartido entre módulos.
export const state = {
  bpm: 100,
  volumen: 0.8,
  audioIniciado: false,
  // Voz de notas (el drone del cuadrilátero) sonando. Se enciende sola en modo
  // música, sin pulsar "Arrancar"; con el ritmo en marcha también está en true.
  notasIniciadas: false,
  step: -1, // paso actual del secuenciador (0-15), -1 = detenido
  mostrarOverlay: false, // skeleton y puntos de dedos ocultos por defecto
};
