import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
  getDatabase, ref, onValue, set, update, get, push 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getMessaging } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDi5nCsLUOQNhPG6Bnxgsw8W60ZPaQewgw",
  authDomain: "harvest-pi.firebaseapp.com",
  databaseURL: "https://harvest-pi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "harvest-pi",
  storageBucket: "harvest-pi.firebasestorage.app",
  messagingSenderId: "650006770674",
  appId: "1:650006770674:web:bf6291198fc0a02be7b16b",
  measurementId: "G-HV6J072QQZ"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

// Export
export {
  database,
  auth,
  messaging,
  ref,
  onValue,
  set,
  update,
  get,
  push,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
};
