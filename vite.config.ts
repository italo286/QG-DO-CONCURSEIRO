
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Expõe a variável de ambiente API_KEY para o frontend como process.env.API_KEY
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    rollupOptions: {
      external: ['firebase-admin', '@netlify/functions'],
    },
  },
})
