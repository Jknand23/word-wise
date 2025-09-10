import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split Firebase into smaller chunks
          if (id.includes('firebase/app')) return 'firebase-app';
          if (id.includes('firebase/auth')) return 'firebase-auth';
          if (id.includes('firebase/firestore')) return 'firebase-firestore';
          if (id.includes('firebase/functions')) return 'firebase-functions';
          
          // Vendor chunks
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor';
          }
          if (id.includes('lucide-react')) return 'ui-vendor';
          
          // Feature chunks
          if (id.includes('src/components/ai/TextEditor') || id.includes('src/pages/DocumentEditor')) {
            return 'editor';
          }
          if (id.includes('src/components/auth/') || id.includes('src/services/authService')) {
            return 'auth';
          }
          if (id.includes('src/components/dashboard/') || id.includes('src/pages/MyDocuments')) {
            return 'dashboard';
          }
          if (id.includes('src/services/')) {
            return 'services';
          }
          
          // Default for node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 400
  },
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
