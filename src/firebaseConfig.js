import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // 👉 Tambahan baru

// Ganti konfigurasi di bawah ini dengan kredensial dari project Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyAFCl4oL1WimGeQF9qrtGjECAriq0L7_ag",
  authDomain: "keuangan-jemaat.firebaseapp.com",
  projectId: "keuangan-jemaat",
  storageBucket: "keuangan-jemaat.firebasestorage.app",
  messagingSenderId: "808764974592",
  appId: "1:808764974592:web:45aa014035f4cedc735ae5"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app); // 👉 Tambahan baru