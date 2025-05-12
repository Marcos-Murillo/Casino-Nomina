import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyBpK10Vdf1Uroaoozjc_Mh2fD_Rj8jBgNM",
  authDomain: "casino-spezia.firebaseapp.com",
  projectId: "casino-spezia",
  storageBucket: "casino-spezia.firebasestorage.app",
  messagingSenderId: "746493503159",
  appId: "1:746493503159:web:fb2a04c0625f3fa0df0f32"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

export { app, db, auth }
