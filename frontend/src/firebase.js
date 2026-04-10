import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export { signInWithPopup, signInWithEmailAndPassword };
export default app;
