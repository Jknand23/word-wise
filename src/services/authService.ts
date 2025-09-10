import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
/* removed unused FirebaseError import */

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : 'Unknown error';
  }
  return 'Unknown error';
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export const authService = {
  // Initialize auth state listener
  initializeAuth() {
    const { setUser, setLoading } = useAuthStore.getState();
    
    return onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
      
      try {
        if (user) {
          // Update last login time
          await this.updateUserProfile(user.uid, {
            lastLoginAt: new Date(),
          });
        }
        setUser(user);
      } catch (error) {
        console.error('Error updating user profile:', error);
        // Still set the user even if profile update fails
        setUser(user);
      } finally {
        setLoading(false);
      }
    });
  },

  // Register with email and password
  async registerWithEmail(email: string, password: string, displayName: string) {
    const { setError, clearError } = useAuthStore.getState();
    clearError();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update user profile
      await updateProfile(userCredential.user, {
        displayName,
      });

      // Create user document in Firestore
      await this.createUserProfile(userCredential.user.uid, {
        email,
        displayName,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      return userCredential.user;
    } catch (error: unknown) {
      setError(getErrorMessage(error));
      throw error;
    }
  },

  // Sign in with email and password
  async signInWithEmail(email: string, password: string) {
    const { setError, clearError } = useAuthStore.getState();
    clearError();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: unknown) {
      setError(getErrorMessage(error));
      throw error;
    }
  },

  // Sign in with Google using popup instead of redirect
  async signInWithGoogle() {
    const { setLoading, setError, clearError, setUser } = useAuthStore.getState();
    clearError();
    setLoading(true);
    
    try {
      console.log('Initiating Google sign-in popup...');
      const result = await signInWithPopup(auth, googleProvider);
      
      if (result.user) {
        console.log('Google sign-in popup successful:', result.user.email);
        
        // Check if user profile exists, create if not
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (!userDoc.exists()) {
          console.log('Creating new user profile...');
          await this.createUserProfile(result.user.uid, {
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            createdAt: new Date(),
            lastLoginAt: new Date(),
          });
        }
        
        setUser(result.user);
        clearError();
        return result.user;
      }
    } catch (error: unknown) {
      console.error('Google sign-in popup failed:', error);
      const code = getErrorCode(error);
      if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups and try again.');
      } else {
        setError(`Google sign-in failed: ${getErrorMessage(error)}`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  },

  // Handle the result from the redirect
  async handleRedirectResult() {
    const { setError, clearError } = useAuthStore.getState();
    
    try {
      console.log('Checking for redirect result...');
      const result = await getRedirectResult(auth);
      
      if (result && result.user) {
        console.log('Google sign-in redirect successful:', result.user.email);
        
        // Check if user profile exists, create if not
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (!userDoc.exists()) {
          console.log('Creating new user profile...');
          await this.createUserProfile(result.user.uid, {
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            createdAt: new Date(),
            lastLoginAt: new Date(),
          });
        }
        
        clearError();
        return result.user;
      } else {
        console.log('No redirect result found');
        return null;
      }
    } catch (error: unknown) {
      console.error("Error handling redirect result:", error);
      setError(`Authentication error: ${getErrorMessage(error)}`);
      throw error;
    }
  },

  // Sign out
  async signOut() {
    const { setError, clearError } = useAuthStore.getState();
    clearError();

    try {
      await signOut(auth);
    } catch (error: unknown) {
      setError(getErrorMessage(error));
      throw error;
    }
  },

  // Create user profile in Firestore
  async createUserProfile(uid: string, profileData: Omit<UserProfile, 'uid'>) {
    try {
      await setDoc(doc(db, 'users', uid), {
        uid,
        ...profileData,
      });
      console.log('User profile created successfully');
    } catch (error) {
      console.error('Failed to create user profile:', error);
      throw error;
    }
  },

  // Update user profile
  async updateUserProfile(uid: string, updates: Partial<UserProfile>) {
    try {
      await setDoc(doc(db, 'users', uid), updates, { merge: true });
    } catch (error) {
      console.error('Failed to update user profile:', error);
      // Don't throw here as this is not critical for authentication
    }
  },

  // Get user profile
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      return userDoc.exists() ? userDoc.data() as UserProfile : null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  },
}; 