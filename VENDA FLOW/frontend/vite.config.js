import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

// O .env fica na raiz do projeto (compartilhado com o backend)
const envDir = path.resolve(import.meta.dirname, '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '')
  const apiTarget = env.VITE_API_PROXY || 'http://localhost:8000'

  return {
    envDir,
    logLevel: 'error', // Suppress warnings, only show errors
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
  }
});
