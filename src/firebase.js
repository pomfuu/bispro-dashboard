// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBL-XIQqNyBPrwc4AaXP_oedesrfqIkHfI",
  authDomain: "bispro-bcaf.firebaseapp.com",
  projectId: "bispro-bcaf",
  storageBucket: "bispro-bcaf.firebasestorage.app",
  messagingSenderId: "712039412062",
  appId: "1:712039412062:web:061152c559e846873ddfcf",
  measurementId: "G-B8CBJJR35B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };