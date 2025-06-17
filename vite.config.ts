import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/__/auth': {
        target: 'https://wordwise-ai-3a4e1.firebaseapp.com',
        changeOrigin: true,
        secure: true,
      },
      '/__/firebase': {
        target: 'https://wordwise-ai-3a4e1.firebaseapp.com',
        changeOrigin: true,
        secure: true,
      }
    }
  },
})
