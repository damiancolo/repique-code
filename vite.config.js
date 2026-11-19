import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // rutas relativas para poder servir desde cualquier subdirectorio
  build: {
    rollupOptions: {
      // Tres páginas: el instrumento, el cancionero (arriba de la guía en cantar) y
      // la tabla de todos los acordes (el «Guía →» del modo cantar)
      input: { main: 'index.html', cancionero: 'cancionero.html', acordes: 'acordes.html' },
    },
  },
})
