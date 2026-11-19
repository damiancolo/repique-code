// Estado global compartido entre módulos.
export const state = {
  bpm: 100,
  volumen: 0.8,
  audioIniciado: false,
  // Ancho (px de CSS) que ocupa arriba a la derecha el cancionero del modo cantar:
  // render.js corre a su izquierda la lectura del acorde para que no quede tapada.
  reservaDerecha: 0,
  // Caja del panel de botones (px de CSS): render.js corre las etiquetas de los
  // tercios para que nunca queden debajo de un botón.
  panel: null,
  // Voz de notas (el drone del cuadrilátero) sonando. Se enciende sola en modo
  // música, sin pulsar "Arrancar"; con el ritmo en marcha también está en true.
  notasIniciadas: false,
  // Sonidos de los gestos del baile listos (cadena armada, sin ritmo).
  sonidosIniciados: false,
  step: -1, // paso actual del secuenciador (0-15), -1 = detenido
  // Dos canales distintos de la figura, y no hay que mezclarlos:
  //
  // `respiro` es el MOVIMIENTO — los lados arqueándose a un paso humano, libre,
  // pase lo que pase. { fase 0-1 dentro del ciclo, ms que dura el ciclo }.
  //
  // `registro` es el BRILLO — cuántos ms hace que entró un cambio de verdad,
  // acorde o nota. Es un acuse de recibo de un hecho, no de un reloj.
  //
  // `null` en los dos = no hay voz de notas, nada que mostrar.
  respiro: null,
  registro: null,
  mostrarOverlay: false, // skeleton y puntos de dedos ocultos por defecto
};
