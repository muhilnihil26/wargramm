import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCzs6P6jELOmaPvZZgmPZQ_NXXP3B5mSyc",
  authDomain: "wargram-c2a79.firebaseapp.com",
  databaseURL: "https://wargram-c2a79-default-rtdb.firebaseio.com",
  projectId: "wargram-c2a79",
  storageBucket: "wargram-c2a79.firebasestorage.app",
  messagingSenderId: "936093319009",
  appId: "1:936093319009:web:0299d618233a2507db0f20",
  measurementId: "G-3BWVY36EKL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const database = getDatabase(app);
export const firestore = getFirestore(app);
export const messaging = getMessaging(app);
export const storage = getStorage(app);

export default app;