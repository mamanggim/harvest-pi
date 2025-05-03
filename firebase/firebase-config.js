// Import Firebase SDK secara modular
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Konfigurasi Firebase (ganti dengan config kamu)
const firebaseConfig = {
  apiKey: "AIzaSyDi5nCsLUOQNhPG6Bnxgsw8W60ZPaQewgw",
  authDomain: "harvest-pi.firebaseapp.com",
  databaseURL: "https://harvest-pi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "harvest-pi",
  storageBucket: "harvest-pi.appspot.com",
  messagingSenderId: "650006770674",
  appId: "1:650006770674:web:bf6291198fc0a02be7b16b"
};

// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Inisialisasi Database dan Auth
const database = getDatabase(app);
const auth = getAuth(app);

// Export modul
export { database, auth };
