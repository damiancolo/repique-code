import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // rutas relativas para poder servir desde cualquier subdirectorio
  build: {
    rollupOptions: {
      // Dos páginas: el instrumento y el cancionero (que el modo cantar abre arriba de la guía)
      input: { main: 'index.html', cancionero: 'cancionero.html' },
    },
  },
})
