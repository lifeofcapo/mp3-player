import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/tracks': 'http://localhost:8000',
      '/downloads': 'http://localhost:8000',
      '/playlists': 'http://localhost:8000',
      '/cookies': 'http://localhost:8000',
      '/vk': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})