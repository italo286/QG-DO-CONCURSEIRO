
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do sistema e do arquivo .env
  // Fix: Property 'cwd' does not exist on type 'Process' on line 8. Casting to any ensures compatibility with Node environments.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Mapeia as variáveis para o frontend respeitando a sintaxe process.env exigida
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_GEMINI_API_KEY || ""),
      'process.env.VITE_DAILY_CHALLENGE_API_KEY': JSON.stringify(env.VITE_DAILY_CHALLENGE_API_KEY || ""),
    },
    build: {
      rollupOptions: {
        external: ['firebase-admin', '@netlify/functions'],
      },
    },
  }
})
