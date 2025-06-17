import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Debug environment variables
console.log('Firebase env vars:', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
});

createRoot(document.getElementById('root')!).render(
  // Temporarily removing StrictMode as it can cause issues with Firebase auth
  // <StrictMode>
    <App />
  // </StrictMode>
)
