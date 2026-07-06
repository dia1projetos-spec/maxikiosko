// ============================================================
// LAYOUT COMPARTIDO DEL PANEL ADMINISTRATIVO
// ============================================================
import { requireAuth, logout } from "../../js/auth.js";
import { db, doc, getDoc } from "../../js/firebase-config.js";

const NAV_ITEMS = [
  { group: "Principal", items: [
    { href: "dashboard.html", icon: "🏠", label: "Inicio", key: "dashboard" },
  ]},
  { group: "Catálogo", items: [
    { href: "categorias.html", icon: "🏷️", label: "Categorías", key: "categorias" },
    { href: "productos.html", icon: "📦", label: "Productos", key: "productos" },
    { href: "resumen-productos.html", icon: "📊", label: "Resumen de productos", key: "resumen-productos" },
  ]},
  { group: "Ventas", items: [
    { href: "caja.html", icon: "🧾", label: "Caja (PDV)", key: "caja" },
    { href: "compras.html", icon: "🗂️", label: "Historial de compras", key: "compras" },
    { href: "compras-familiares.html", icon: "👨‍👩‍👧", label: "Retiros familiares", key: "compras-familiares" },
    { href: "resumen-financiero.html", icon: "💰", label: "Resumen financiero", key: "resumen-financiero" },
  ]},
  { group: "Clientes", items: [
    { href: "clientes.html", icon: "🧑‍🤝‍🧑", label: "Clientes", key: "clientes" },
  ]},
  { group: "Tienda online", items: [
    { href: "slides.html", icon: "🖼️", label: "Slides del inicio", key: "slides" },
    { href: "configuracion.html", icon: "⚙️", label: "Configuración", key: "configuracion" },
  ]},
];

/**
 * Inicializa el layout del panel: exige login, dibuja sidebar/topbar
 * y devuelve el usuario autenticado.
 * @param {string} activeKey - key de la página actual (ver NAV_ITEMS)
 * @param {string} pageTitle - título mostrado en la topbar
 */
export async function initAdminLayout(activeKey, pageTitle) {
  const user = await requireAuth();

  const root = document.getElementById("admin-root");
  root.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="admin-sidebar__brand">
          <img id="admin-brand-logo" src="" alt="" style="display:none;">
          <span id="admin-brand-name">Kiosko D. Diego</span>
        </div>
        <nav class="admin-nav">
          ${NAV_ITEMS.map(
            (group) => `
            <div class="admin-nav__group-label">${group.group}</div>
            ${group.items
              .map(
                (item) => `
              <a href="${item.href}" class="${item.key === activeKey ? "is-active" : ""}">
                <span>${item.icon}</span> ${item.label}
              </a>`
              )
              .join("")}
          `
          ).join("")}
        </nav>
        <div class="admin-sidebar__footer">
          <button id="logout-btn" class="btn btn-outline btn-block" style="border-color: rgba(255,255,255,0.3); color: var(--color-paper);">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div class="admin-main">
        <div class="admin-topbar">
          <div style="display:flex; align-items:center; gap: var(--space-3);">
            <button class="admin-menu-toggle" id="menu-toggle" aria-label="Abrir menú">☰</button>
            <h1>${pageTitle}</h1>
          </div>
          <a href="../index.html" target="_blank" class="btn btn-outline btn-sm">Ver tienda ↗</a>
        </div>
        <div class="admin-content" id="admin-content"></div>
      </div>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("admin-sidebar").classList.toggle("is-open");
  });

  // Cargar nombre/logo del negocio en la sidebar
  try {
    const snap = await getDoc(doc(db, "config", "general"));
    if (snap.exists()) {
      const config = snap.data();
      if (config.businessName) document.getElementById("admin-brand-name").textContent = config.businessName;
      if (config.logoUrl) {
        const logoEl = document.getElementById("admin-brand-logo");
        logoEl.src = config.logoUrl;
        logoEl.style.display = "block";
      }
    }
  } catch (err) {
    console.error("Error cargando config en sidebar:", err);
  }

  return user;
}

/** Atajo para insertar HTML dentro del área de contenido de la página */
export function setContent(html) {
  document.getElementById("admin-content").innerHTML = html;
}
