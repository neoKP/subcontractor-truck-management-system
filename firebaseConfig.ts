
// @ts-ignore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// @ts-ignore
import { getDatabase, ref, onValue, set, push, update, remove, get, query, limitToLast, orderByChild } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// @ts-ignore
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
export { ref, onValue, set, push, update, remove, get, query, limitToLast, orderByChild, storageRef, uploadBytes, getDownloadURL };
