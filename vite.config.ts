
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente. No Vercel, elas vêm do sistema.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Injeta as chaves no frontend. No Vercel, use preferencialmente API_KEY sem o prefixo VITE_ no painel.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_GEMINI_API_KEY || ""),
      'process.env.VITE_DAILY_CHALLENGE_API_KEY': JSON.stringify(env.VITE_DAILY_CHALLENGE_API_KEY || ""),
    },
    build: {
      rollupOptions: {
        external: ['firebase-admin'],
      },
    },
  }
})
