// Lazy-loaded Firebase services to reduce initial bundle size
import type { FirebaseApp } from 'firebase/app';
import type { Auth, GoogleAuthProvider as GoogleAuthProviderType } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';

// Cached instances
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let googleProvider: GoogleAuthProviderType | null = null;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

// Lazy Firebase App initialization
export const getFirebaseApp = async (): Promise<FirebaseApp> => {
  if (!app) {
    const { initializeApp } = await import('firebase/app');
    app = initializeApp(firebaseConfig);
  }
  return app;
};

// Lazy Firebase Auth initialization
export const getFirebaseAuth = async (): Promise<Auth> => {
  if (!auth) {
    const firebaseApp = await getFirebaseApp();
    const { getAuth } = await import('firebase/auth');
    auth = getAuth(firebaseApp);
  }
  return auth;
};

// Lazy Google Auth Provider initialization
export const getGoogleProvider = async (): Promise<GoogleAuthProviderType> => {
  if (!googleProvider) {
    const { GoogleAuthProvider } = await import('firebase/auth');
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
  }
  return googleProvider;
};

// Lazy Firebase Firestore initialization
export const getFirebaseDb = async (): Promise<Firestore> => {
  if (!db) {
    const firebaseApp = await getFirebaseApp();
    const { getFirestore } = await import('firebase/firestore');
    db = getFirestore(firebaseApp);
  }
  return db;
};

// Lazy Firebase Functions initialization
export const getFirebaseFunctions = async (): Promise<Functions> => {
  if (!functions) {
    const firebaseApp = await getFirebaseApp();
    const { getFunctions } = await import('firebase/functions');
    functions = getFunctions(firebaseApp);
  }
  return functions;
};
