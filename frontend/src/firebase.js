import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: "AIzaSyAa8bYmBq8z_eqiYLMHrm305UzZjRgUvYU",
  authDomain: "finsight-tracking.firebaseapp.com",
  projectId: "finsight-tracking",
  storageBucket: "finsight-tracking.firebasestorage.app",
  messagingSenderId: "473754928632",
  appId: "1:473754928632:web:1d60ce1d25832dbd80420d",
  measurementId: "G-HTC54J0F3N"
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
    // On native platforms, use redirect flow
    await signInWithRedirect(auth, googleProvider);
    // Result is handled in getRedirectResult after the page reloads
    return null;
  } else {
    // On web, popup works fine
    return await signInWithPopup(auth, googleProvider);
  }
};

export { signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword };
export default app;
