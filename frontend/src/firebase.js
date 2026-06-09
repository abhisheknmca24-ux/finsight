import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, signInWithCredential } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

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
