// ============================================================
// CARRITO DE COMPRAS — Kiosko D. Diego (tienda pública)
// ============================================================
// El carrito se guarda en localStorage para que persista si el
// cliente recarga la página o navega, hasta que finaliza el
// pedido por WhatsApp.
// ============================================================

const CART_STORAGE_KEY = "kiosko_cart_v1";

function readCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent("cart:updated", { detail: { items } }));
}

export function getCartItems() {
  return readCart();
}

/**
 * Agrega un producto al carrito.
 * @param {object} product - { id, name, salePrice, soldBy, imageUrl }
 * @param {number} amount - cantidad de unidades, o KG si soldBy === 'weight'
 */
export function addToCart(product, amount = 1) {
  const items = readCart();
  const existing = items.find((item) => item.productId === product.id);

  if (existing) {
    existing.amount += amount;
  } else {
    items.push({
      productId: product.id,
      name: product.name,
      unitPrice: product.salePrice,
      soldBy: product.soldBy || "unit",
      imageUrl: product.imageUrl || null,
      amount,
    });
  }
  writeCart(items);
}

export function updateCartItemAmount(productId, amount) {
  let items = readCart();
  if (amount <= 0) {
    items = items.filter((item) => item.productId !== productId);
  } else {
    const item = items.find((i) => i.productId === productId);
    if (item) item.amount = amount;
  }
  writeCart(items);
}

export function removeFromCart(productId) {
  const items = readCart().filter((item) => item.productId !== productId);
  writeCart(items);
}

export function clearCart() {
  writeCart([]);
}

export function getCartCount() {
  return readCart().reduce((sum, item) => sum + (item.soldBy === "weight" ? 1 : item.amount), 0);
}

export function getCartSubtotal() {
  return readCart().reduce((sum, item) => sum + item.unitPrice * item.amount, 0);
}
