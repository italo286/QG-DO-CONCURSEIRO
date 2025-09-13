
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Vite does not polyfill process.env. We need to explicitly define it.
    // We will use import.meta.env for our own env variables.
    'process.env': {}
  },
  build: {
    rollupOptions: {
      external: ['firebase-admin', '@netlify/functions'],
    },
  },
})