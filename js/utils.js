// ============================================================
// UTILIDADES COMPARTIDAS — Kiosko D. Diego
// ============================================================

/**
 * Formatea un número como moneda en pesos argentinos.
 * Ej: formatCurrency(1500.5) -> "$1.500,50"
 */
export function formatCurrency(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

/**
 * Muestra un mensaje flotante (toast) en pantalla.
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 */
export function showToast(message, type = "info") {
  let toast = document.getElementById("global-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "global-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast is-visible ${type === "error" ? "is-error" : ""} ${
    type === "success" ? "is-success" : ""
  }`;

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}

/** Debounce simple para inputs de búsqueda */
export function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Genera un número de cliente correlativo simple, ej: "CLI-0001" */
export function generateClientNumber(count) {
  return `CLI-${String(count + 1).padStart(4, "0")}`;
}

/** Escapa texto para insertar de forma segura en innerHTML */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

/** Arma el link de WhatsApp con mensaje pre-cargado */
export function buildWhatsappLink(phoneNumber, message) {
  const cleanPhone = String(phoneNumber || "").replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
