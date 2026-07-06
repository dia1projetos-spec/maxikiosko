// ============================================================
// AUTENTICACIÓN — Kiosko D. Diego
// ============================================================
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase-config.js";

/**
 * Protege una página administrativa: si no hay usuario logueado,
 * redirige a login.html. Se debe llamar al inicio de cada página
 * del panel admin.
 * @returns {Promise<import("firebase/auth").User>}
 */
export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        const basePath = window.location.pathname.includes("/admin/") ? "../login.html" : "login.html";
        window.location.href = basePath;
      } else {
        resolve(user);
      }
    });
  });
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
  const basePath = window.location.pathname.includes("/admin/") ? "../login.html" : "login.html";
  window.location.href = basePath;
}
