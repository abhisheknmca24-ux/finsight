import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, signInWithCredential } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Platform-aware Google Sign-In.
 * - Web browser: uses signInWithPopup (works in normal browsers)
 * - Capacitor (Android/iOS): uses signInWithRedirect (popup blocked in WebView)
 */
export const isNativePlatform = () => Capacitor.isNativePlatform();

export const signInWithGoogle = async () => {
  if (isNativePlatform()) {
    // On native platforms, use the native Google Sign-In plugin
    const result = await FirebaseAuthentication.signInWithGoogle();

    // Create a Firebase credential from the native idToken
    const credential = GoogleAuthProvider.credential(result.credential.idToken);

    // Sign in to Firebase with the credential
    return await signInWithCredential(auth, credential);
  } else {
    // On web, popup works fine
    return await signInWithPopup(auth, googleProvider);
  }
};

export { signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword };
export default app;
