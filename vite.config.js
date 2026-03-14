import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap:  ['gsap'],
        },
      },
    },
  },
})
