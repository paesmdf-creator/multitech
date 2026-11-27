import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJLqkQXG4WbgVb3msPf3PeXqxw_noOQ5o",
  authDomain: "multitech-b393c.firebaseapp.com",
  projectId: "multitech-b393c",
  storageBucket: "multitech-b393c.firebasestorage.app",
  messagingSenderId: "867560015873",
  appId: "1:867560015873:web:3e328ad252a968b5d89800",
  measurementId: "G-BZ81S6KM8N"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
