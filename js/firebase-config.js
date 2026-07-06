// ============================================================
// CONFIGURACIÓN DE FIREBASE — Kiosko D. Diego
// ============================================================
// Este archivo centraliza la conexión con Firebase. Se importa
// como módulo ES6 (por eso los <script> que lo usan llevan
// type="module") en todas las páginas del sistema.
//
// La apiKey de Firebase NO es un secreto: está diseñada para ir
// en el frontend. La seguridad real se controla con las Reglas
// de Seguridad de Firestore/Storage (ver docs/MODELO-DE-DATOS.md).
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmMxiJBVTiTqAWGr8fSC4sqMT1ovHN5Gk",
  authDomain: "maxikiosko-8d78f.firebaseapp.com",
  projectId: "maxikiosko-8d78f",
  storageBucket: "maxikiosko-8d78f.firebasestorage.app",
  messagingSenderId: "1056346698286",
  appId: "1:1056346698286:web:df6b57027a66b3393c65bf",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
  app,
  db,
  auth,
  // Firestore helpers re-exportados para no repetir imports en cada página
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
  // Auth helpers
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
