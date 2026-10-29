import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'SERVER_URL')

  return {
    plugins: [react(), tailwindcss()],
    define: { 'import.meta.env.SERVER_URL': JSON.stringify(env.SERVER_URL ?? '') },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } } },
  }
})
