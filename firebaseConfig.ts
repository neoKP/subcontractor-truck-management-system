
// @ts-ignore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// @ts-ignore
import { getDatabase, ref, onValue, set, push, update, remove, get, query, limitToLast, orderByChild, startAt, endAt } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// @ts-ignore
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, getBlob } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
// @ts-ignore
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB26x49UrzPAyb14FtpBdrnRkQs_P2omTM",
    authDomain: "subtruckmanagementsystem.firebaseapp.com",
    databaseURL: "https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "subtruckmanagementsystem",
    storageBucket: "subtruckmanagementsystem.firebasestorage.app",
    messagingSenderId: "29507252506",
    appId: "1:29507252506:web:59befd19557a3e8488bca3",
    measurementId: "G-DX2FD06P1V"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Phase 1 (security hardening): make sure every client holds a Firebase Auth token
// so the Realtime Database rules can later require `auth != null` (blocking anonymous
// REST access). This is additive and safe while the rules are still open — if the
// Anonymous provider isn't enabled yet, signInAnonymously rejects and we just log it;
// the app keeps working until the stricter rules are deployed (Phase 2).
// `authReady` resolves once the client is signed in; await it before reads/writes
// once the rules are tightened.
export const authReady: Promise<unknown> = signInAnonymously(auth).catch((err: any) => {
  console.error('Anonymous sign-in failed (enable Anonymous provider in Firebase Console):', err?.code || err);
});

export { ref, onValue, set, push, update, remove, get, query, limitToLast, orderByChild, startAt, endAt, storageRef, uploadBytes, getDownloadURL, getBlob };
