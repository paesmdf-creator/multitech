import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Substitua pelos dados do seu projeto Firebase exclusivo do Multitech
const firebaseConfig = {
  apiKey: "SUA_API_KEY_DO_MULTITECH",
  authDomain: "SEU_PROJETO_MULTITECH.firebaseapp.com",
  projectId: "SEU_PROJETO_MULTITECH",
  storageBucket: "SEU_PROJETO_MULTITECH.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
