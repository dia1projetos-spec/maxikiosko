// ============================================================
// TIENDA PÚBLICA — Kiosko D. Diego
// ============================================================
import {
  db,
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
} from "./firebase-config.js";
import {
  getCartItems,
  addToCart,
  updateCartItemAmount,
  removeFromCart,
  clearCart,
  getCartCount,
  getCartSubtotal,
} from "./cart.js";
import { formatCurrency, showToast, debounce, escapeHtml, buildWhatsappLink } from "./utils.js";

// ------------------------------------------------------------
// Estado en memoria
// ------------------------------------------------------------
let allProducts = [];
let allCategories = [];
let activeCategoryId = "all";
let searchTerm = "";
let storeConfig = { deliveryEnabled: false, deliveryCost: 0, whatsappNumber: "" };

// ------------------------------------------------------------
// Referencias del DOM
// ------------------------------------------------------------
const heroTrack = document.getElementById("hero-track");
const heroDots = document.getElementById("hero-dots");
const heroEmpty = document.getElementById("hero-empty");
const categoryPillsEl = document.getElementById("category-pills");
const productGridEl = document.getElementById("product-grid");
const searchInput = document.getElementById("store-search-input");
const cartButtonCount = document.getElementById("cart-count");
const cartDrawer = document.getElementById("cart-drawer");
const cartOverlay = document.getElementById("cart-overlay");
const cartItemsEl = document.getElementById("cart-items");
const cartSubtotalEl = document.getElementById("cart-subtotal-value");
const cartDeliveryEl = document.getElementById("cart-delivery-value");
const cartDeliveryLine = document.getElementById("cart-delivery-line");
const cartTotalEl = document.getElementById("cart-total-value");
const checkoutBtn = document.getElementById("checkout-btn");
const checkoutModal = document.getElementById("checkout-overlay");
const checkoutForm = document.getElementById("checkout-form");
const brandNameEl = document.getElementById("brand-name");
const brandLogoEl = document.getElementById("brand-logo");
const footerBrandNameEl = document.getElementById("footer-brand-name");

// ============================================================
// CARGA DE CONFIGURACIÓN GENERAL (nombre, logo, whatsapp, delivery)
// ============================================================
async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "general"));
    if (snap.exists()) {
      storeConfig = { ...storeConfig, ...snap.data() };
      if (storeConfig.businessName) {
        document.title = storeConfig.businessName;
        if (brandNameEl) brandNameEl.textContent = storeConfig.businessName;
        if (footerBrandNameEl) footerBrandNameEl.textContent = storeConfig.businessName;
      }
      if (storeConfig.logoUrl && brandLogoEl) {
        brandLogoEl.src = storeConfig.logoUrl;
        brandLogoEl.style.display = "block";
      }
    }
  } catch (err) {
    console.error("Error cargando configuración:", err);
  }
}

// ============================================================
// SLIDER DE IMÁGENES (HEADER)
// ============================================================
let currentSlide = 0;
let slideCount = 0;
let slideTimer = null;

async function loadSlides() {
  try {
    const q = query(collection(db, "slides"), orderBy("order", "asc"));
    const snap = await getDocs(q);
    const slides = snap.docs.map((d) => d.data());
    slideCount = slides.length;

    if (!slides.length) {
      heroEmpty.style.display = "flex";
      heroTrack.style.display = "none";
      heroDots.style.display = "none";
      return;
    }

    heroEmpty.style.display = "none";
    heroTrack.innerHTML = slides
      .map(
        (s, i) => `
        <div class="hero-slider__slide">
          <img src="${escapeHtml(s.imageUrl)}" alt="Promoción ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}">
        </div>`
      )
      .join("");

    heroDots.innerHTML = slides
      .map(
        (_, i) =>
          `<button class="hero-slider__dot ${i === 0 ? "is-active" : ""}" data-index="${i}" aria-label="Ir a la imagen ${i + 1}"></button>`
      )
      .join("");

    heroDots.querySelectorAll(".hero-slider__dot").forEach((dot) => {
      dot.addEventListener("click", () => goToSlide(Number(dot.dataset.index)));
    });

    startAutoSlide();
  } catch (err) {
    console.error("Error cargando slides:", err);
    heroEmpty.style.display = "flex";
  }
}

function goToSlide(index) {
  currentSlide = (index + slideCount) % slideCount;
  heroTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
  heroDots.querySelectorAll(".hero-slider__dot").forEach((dot, i) => {
    dot.classList.toggle("is-active", i === currentSlide);
  });
}

function startAutoSlide() {
  if (slideCount <= 1) return;
  clearInterval(slideTimer);
  slideTimer = setInterval(() => goToSlide(currentSlide + 1), 5000);
}

document.getElementById("hero-prev")?.addEventListener("click", () => {
  goToSlide(currentSlide - 1);
  startAutoSlide();
});
document.getElementById("hero-next")?.addEventListener("click", () => {
  goToSlide(currentSlide + 1);
  startAutoSlide();
});

// ============================================================
// CATEGORÍAS Y PRODUCTOS
// ============================================================
async function loadCategories() {
  try {
    const snap = await getDocs(collection(db, "categories"));
    allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCategoryPills();
  } catch (err) {
    console.error("Error cargando categorías:", err);
  }
}

function renderCategoryPills() {
  const pills = [{ id: "all", name: "Todos" }, ...allCategories];
  categoryPillsEl.innerHTML = pills
    .map(
      (cat) =>
        `<button class="category-pill ${cat.id === activeCategoryId ? "is-active" : ""}" data-id="${cat.id}">${escapeHtml(cat.name)}</button>`
    )
    .join("");

  categoryPillsEl.querySelectorAll(".category-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      activeCategoryId = pill.dataset.id;
      renderCategoryPills();
      renderProducts();
    });
  });
}

async function loadProducts() {
  try {
    const snap = await getDocs(collection(db, "products"));
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProducts();
  } catch (err) {
    console.error("Error cargando productos:", err);
    productGridEl.innerHTML = `<div class="empty-state">No se pudieron cargar los productos.</div>`;
  }
}

function getFilteredProducts() {
  return allProducts.filter((p) => {
    const matchesCategory = activeCategoryId === "all" || p.categoryId === activeCategoryId;
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  const products = getFilteredProducts();

  if (!products.length) {
    productGridEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state__icon">🛒</div>
        <p>No encontramos productos con ese filtro.</p>
      </div>`;
    return;
  }

  productGridEl.innerHTML = products
    .map((p) => {
      const category = allCategories.find((c) => c.id === p.categoryId);
      const priceLabel =
        p.soldBy === "weight" ? `${formatCurrency(p.salePrice)} <small>/ kg</small>` : formatCurrency(p.salePrice);
      const image = p.imageUrl || "";

      return `
      <article class="product-card">
        ${image ? `<img class="product-card__image" src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}" loading="lazy">` : `<div class="product-card__image"></div>`}
        <div class="product-card__body">
          ${category ? `<span class="product-card__category">${escapeHtml(category.name)}</span>` : ""}
          <h3 class="product-card__name">${escapeHtml(p.name)}</h3>
          <div class="product-card__price">${priceLabel}</div>
          <button class="btn btn-primary btn-block btn-sm product-card__add" data-id="${p.id}">
            Agregar al carrito
          </button>
        </div>
      </article>`;
    })
    .join("");

  productGridEl.querySelectorAll(".product-card__add").forEach((btn) => {
    btn.addEventListener("click", () => handleAddToCart(btn.dataset.id));
  });
}

function handleAddToCart(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  if (product.soldBy === "weight") {
    const gramsInput = prompt(`¿Cuántos gramos de "${product.name}" querés llevar? (ej: 250)`);
    const grams = Number(gramsInput);
    if (!gramsInput || isNaN(grams) || grams <= 0) {
      if (gramsInput !== null) showToast("Ingresá una cantidad de gramos válida.", "error");
      return;
    }
    const kg = grams / 1000;
    addToCart(product, kg);
    showToast(`Agregaste ${grams} g de ${product.name}`, "success");
  } else {
    addToCart(product, 1);
    showToast(`Agregaste ${product.name} al carrito`, "success");
  }
}

// ============================================================
// CARRITO (drawer)
// ============================================================
function renderCart() {
  const items = getCartItems();
  const count = getCartCount();
  cartButtonCount.textContent = count;
  cartButtonCount.style.display = count > 0 ? "flex" : "none";

  if (!items.length) {
    cartItemsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🧾</div>
        <p>Tu carrito está vacío.</p>
      </div>`;
  } else {
    cartItemsEl.innerHTML = items
      .map((item) => {
        const subtotal = item.unitPrice * item.amount;
        const amountLabel =
          item.soldBy === "weight" ? `${(item.amount * 1000).toFixed(0)} g` : `${item.amount} un.`;
        return `
        <div class="cart-item" data-id="${item.productId}">
          <span class="cart-item__name">${escapeHtml(item.name)}</span>
          <span class="cart-item__subtotal">${formatCurrency(subtotal)}</span>
          <div class="cart-item__controls">
            ${
              item.soldBy === "weight"
                ? `<span>${amountLabel}</span>`
                : `<div class="qty-control">
                    <button class="qty-minus" aria-label="Restar unidad">−</button>
                    <span>${item.amount}</span>
                    <button class="qty-plus" aria-label="Sumar unidad">+</button>
                  </div>`
            }
            <button class="cart-item__remove">Quitar</button>
          </div>
        </div>`;
      })
      .join("");

    cartItemsEl.querySelectorAll(".cart-item").forEach((row) => {
      const id = row.dataset.id;
      const item = items.find((i) => i.productId === id);
      row.querySelector(".qty-plus")?.addEventListener("click", () => updateCartItemAmount(id, item.amount + 1));
      row.querySelector(".qty-minus")?.addEventListener("click", () => updateCartItemAmount(id, item.amount - 1));
      row.querySelector(".cart-item__remove")?.addEventListener("click", () => removeFromCart(id));
    });
  }

  const subtotal = getCartSubtotal();
  const deliveryCost = storeConfig.deliveryEnabled ? Number(storeConfig.deliveryCost) || 0 : 0;

  cartSubtotalEl.textContent = formatCurrency(subtotal);
  if (storeConfig.deliveryEnabled) {
    cartDeliveryLine.style.display = "flex";
    cartDeliveryEl.textContent = deliveryCost > 0 ? formatCurrency(deliveryCost) : "Gratis";
  } else {
    cartDeliveryLine.style.display = "none";
  }
  cartTotalEl.textContent = formatCurrency(subtotal + deliveryCost);
  checkoutBtn.disabled = items.length === 0;
}

document.addEventListener("cart:updated", renderCart);

function openCart() {
  cartDrawer.classList.add("is-open");
  cartOverlay.classList.add("is-open");
}
function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartOverlay.classList.remove("is-open");
}

document.getElementById("cart-open-btn")?.addEventListener("click", openCart);
document.getElementById("cart-close-btn")?.addEventListener("click", closeCart);
cartOverlay?.addEventListener("click", closeCart);

// ============================================================
// BÚSQUEDA
// ============================================================
searchInput?.addEventListener(
  "input",
  debounce((e) => {
    searchTerm = e.target.value.trim();
    renderProducts();
  }, 200)
);

// ============================================================
// CHECKOUT → WHATSAPP
// ============================================================
function openCheckoutModal() {
  if (!getCartItems().length) return;
  closeCart();
  checkoutModal.classList.add("is-open");
}
function closeCheckoutModal() {
  checkoutModal.classList.remove("is-open");
}

checkoutBtn?.addEventListener("click", openCheckoutModal);
document.getElementById("checkout-close-btn")?.addEventListener("click", closeCheckoutModal);
document.getElementById("checkout-overlay")?.addEventListener("click", (e) => {
  if (e.target.id === "checkout-overlay") closeCheckoutModal();
});

checkoutForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando pedido...";

  try {
    const formData = new FormData(checkoutForm);
    const customerName = formData.get("customerName")?.toString().trim();
    const customerContact = formData.get("customerContact")?.toString().trim();
    const street = formData.get("street")?.toString().trim();
    const number = formData.get("number")?.toString().trim();
    const complement = formData.get("complement")?.toString().trim();
    const neighborhood = formData.get("neighborhood")?.toString().trim();

    if (!customerName || !customerContact || !street || !number || !neighborhood) {
      showToast("Completá todos los campos obligatorios.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Finalizar pedido por WhatsApp";
      return;
    }

    const items = getCartItems();
    const subtotal = getCartSubtotal();
    const deliveryCost = storeConfig.deliveryEnabled ? Number(storeConfig.deliveryCost) || 0 : 0;
    const total = subtotal + deliveryCost;

    const orderData = {
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        amount: i.amount,
        soldBy: i.soldBy,
        unitPrice: i.unitPrice,
        subtotal: i.unitPrice * i.amount,
      })),
      subtotal,
      deliveryCost,
      total,
      customerName,
      customerContact,
      address: { street, number, complement: complement || null, neighborhood },
      status: "nuevo",
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "orders"), orderData);

    // Armamos el mensaje de WhatsApp con todos los detalles del pedido
    const lines = [
      `*Nuevo pedido - ${storeConfig.businessName || "Kiosko D. Diego"}*`,
      ``,
      `*Cliente:* ${customerName}`,
      `*Contacto:* ${customerContact}`,
      `*Dirección:* ${street} ${number}${complement ? ", " + complement : ""}, ${neighborhood}`,
      ``,
      `*Productos:*`,
      ...items.map((i) => {
        const amountLabel = i.soldBy === "weight" ? `${(i.amount * 1000).toFixed(0)} g` : `${i.amount} un.`;
        return `- ${i.name} (${amountLabel}) — ${formatCurrency(i.unitPrice * i.amount)}`;
      }),
      ``,
      `Subtotal: ${formatCurrency(subtotal)}`,
    ];
    if (storeConfig.deliveryEnabled) {
      lines.push(`Envío: ${deliveryCost > 0 ? formatCurrency(deliveryCost) : "Gratis"}`);
    }
    lines.push(`*Total: ${formatCurrency(total)}*`);

    const whatsappLink = buildWhatsappLink(storeConfig.whatsappNumber, lines.join("\n"));

    clearCart();
    closeCheckoutModal();
    showToast("¡Pedido enviado! Te llevamos a WhatsApp para confirmar.", "success");

    setTimeout(() => {
      window.open(whatsappLink, "_blank");
    }, 800);

    checkoutForm.reset();
  } catch (err) {
    console.error("Error al enviar pedido:", err);
    showToast("Ocurrió un error al enviar el pedido. Probá de nuevo.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Finalizar pedido por WhatsApp";
  }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
(async function init() {
  await loadConfig();
  await Promise.all([loadSlides(), loadCategories(), loadProducts()]);
  renderCart();
})();
