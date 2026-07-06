// ============================================================
// MÓDULO DE PRODUCTOS
// ============================================================
import { initAdminLayout, setContent } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "../../js/firebase-config.js";
import { uploadImageToCloudinary } from "../../js/cloudinary-config.js";
import { formatCurrency, showToast, escapeHtml } from "../../js/utils.js";

await initAdminLayout("productos", "Productos");

setContent(`
  <div class="panel">
    <div class="panel__header">
      <h2>Catálogo de productos</h2>
      <button id="new-product-btn" class="btn btn-primary">+ Nuevo producto</button>
    </div>
    <div class="form-group" style="max-width: 320px;">
      <input type="text" id="product-search" placeholder="Buscar por nombre o código de barras...">
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Venta</th>
            <th>Costo</th>
            <th>Stock</th>
            <th style="width:150px;">Acciones</th>
          </tr>
        </thead>
        <tbody id="products-tbody">
          <tr><td colspan="6"><div class="spinner"></div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
`);

let allProducts = [];
let allCategories = [];
let currentImageData = { url: null, publicId: null };

const tbody = document.getElementById("products-tbody");
const searchInput = document.getElementById("product-search");
const newProductBtn = document.getElementById("new-product-btn");

const productModal = document.getElementById("product-modal");
const productForm = document.getElementById("product-form");
const productModalTitle = document.getElementById("product-modal-title");
const productIdInput = document.getElementById("product-id");
const nameInput = document.getElementById("product-name");
const costPriceInput = document.getElementById("product-cost-price");
const salePriceInput = document.getElementById("product-sale-price");
const salePriceLabel = document.getElementById("sale-price-label");
const barcodeInput = document.getElementById("product-barcode");
const categorySelect = document.getElementById("product-category");
const stockInput = document.getElementById("product-stock");
const profitInput = document.getElementById("product-profit");
const imageInput = document.getElementById("product-image");
const imagePreview = document.getElementById("product-image-preview");
const saveBtn = document.getElementById("product-save-btn");

const qrModal = document.getElementById("qr-modal");
const qrImage = document.getElementById("qr-image");
const qrDownloadLink = document.getElementById("qr-download-link");
const qrProductName = document.getElementById("qr-product-name");

// ------------------------------------------------------------
// Cargar categorías (para el <select>)
// ------------------------------------------------------------
async function loadCategories() {
  const snap = await getDocs(collection(db, "categories"));
  allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  categorySelect.innerHTML =
    `<option value="">Sin categoría</option>` +
    allCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

// ------------------------------------------------------------
// Cargar y renderizar productos
// ------------------------------------------------------------
async function loadProducts() {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderProducts();
}

function renderProducts() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = allProducts.filter(
    (p) => !term || p.name.toLowerCase().includes(term) || (p.barcode || "").includes(term)
  );

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay productos que coincidan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((p) => {
      const category = allCategories.find((c) => c.id === p.categoryId);
      const saleLabel = p.soldBy === "weight" ? `${formatCurrency(p.salePrice)} / kg` : formatCurrency(p.salePrice);
      return `
      <tr data-id="${p.id}">
        <td style="display:flex; align-items:center; gap:10px;">
          ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;">` : ""}
          <span>${escapeHtml(p.name)}</span>
        </td>
        <td>${category ? escapeHtml(category.name) : "—"}</td>
        <td>${saleLabel}</td>
        <td>${p.costPrice ? formatCurrency(p.costPrice) : "—"}</td>
        <td>${p.stock ?? "—"}</td>
        <td>
          <div class="action-icons">
            <button class="icon-btn qr-btn" title="Ver / descargar QR">🔳</button>
            <button class="icon-btn edit-btn" title="Editar">✏️</button>
            <button class="icon-btn icon-btn--danger delete-btn" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => openEditModal(e.target.closest("tr").dataset.id))
  );
  tbody.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => handleDelete(e.target.closest("tr").dataset.id))
  );
  tbody.querySelectorAll(".qr-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => showQrModal(e.target.closest("tr").dataset.id))
  );
}

searchInput.addEventListener("input", renderProducts);

// ------------------------------------------------------------
// Modal: abrir para crear / editar
// ------------------------------------------------------------
function resetForm() {
  productForm.reset();
  productIdInput.value = "";
  currentImageData = { url: null, publicId: null };
  imagePreview.style.display = "none";
  document.querySelector('input[name="soldBy"][value="unit"]').checked = true;
  updateSalePriceLabel();
}

function updateSalePriceLabel() {
  const soldBy = document.querySelector('input[name="soldBy"]:checked').value;
  salePriceLabel.textContent = soldBy === "weight" ? "Precio por kilo (kg) *" : "Precio de venta *";
}
document.querySelectorAll('input[name="soldBy"]').forEach((r) => r.addEventListener("change", updateSalePriceLabel));

newProductBtn.addEventListener("click", () => {
  resetForm();
  productModalTitle.textContent = "Nuevo producto";
  productModal.classList.add("is-open");
});

document.getElementById("product-modal-close").addEventListener("click", () => {
  productModal.classList.remove("is-open");
});

function openEditModal(id) {
  const product = allProducts.find((p) => p.id === id);
  if (!product) return;
  resetForm();
  productModalTitle.textContent = "Editar producto";
  productIdInput.value = id;
  nameInput.value = product.name;
  costPriceInput.value = product.costPrice ?? "";
  salePriceInput.value = product.salePrice ?? "";
  barcodeInput.value = product.barcode ?? "";
  categorySelect.value = product.categoryId ?? "";
  stockInput.value = product.stock ?? "";
  profitInput.value = product.profit ?? "";
  document.querySelector(`input[name="soldBy"][value="${product.soldBy || "unit"}"]`).checked = true;
  updateSalePriceLabel();
  if (product.imageUrl) {
    currentImageData = { url: product.imageUrl, publicId: product.cloudinaryPublicId || null };
    imagePreview.src = product.imageUrl;
    imagePreview.style.display = "block";
  }
  productModal.classList.add("is-open");
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.src = reader.result;
    imagePreview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// ------------------------------------------------------------
// Guardar producto (crear o actualizar) + generar QR
// ------------------------------------------------------------
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando...";

  try {
    const id = productIdInput.value;
    const soldBy = document.querySelector('input[name="soldBy"]:checked').value;

    // Subir imagen nueva si se seleccionó un archivo
    const file = imageInput.files[0];
    if (file) {
      saveBtn.textContent = "Subiendo imagen...";
      const uploaded = await uploadImageToCloudinary(file, "kiosko-d-diego/productos");
      currentImageData = uploaded;
    }

    const productData = {
      name: nameInput.value.trim(),
      soldBy,
      costPrice: costPriceInput.value ? Number(costPriceInput.value) : null,
      salePrice: Number(salePriceInput.value),
      barcode: barcodeInput.value.trim() || null,
      categoryId: categorySelect.value || null,
      stock: stockInput.value ? Number(stockInput.value) : null,
      profit: profitInput.value ? Number(profitInput.value) : null,
      imageUrl: currentImageData.url,
      cloudinaryPublicId: currentImageData.publicId,
    };

    saveBtn.textContent = "Guardando...";

    let productId = id;
    if (id) {
      await updateDoc(doc(db, "products", id), productData);
    } else {
      productData.totalSold = 0;
      productData.totalProfit = 0;
      productData.createdAt = serverTimestamp();
      productData.qrCodeDataUrl = "";
      const newDoc = await addDoc(collection(db, "products"), productData);
      productId = newDoc.id;

      // Generar QR code apuntando al ID del producto (usado en Caja/PDV)
      const qrText = `KIOSKO-PROD:${productId}`;
      const qrDataUrl = await QRCode.toDataURL(qrText, { width: 400, margin: 1 });
      await updateDoc(doc(db, "products", productId), { qrCodeDataUrl: qrDataUrl });
    }

    productModal.classList.remove("is-open");
    showToast("Producto guardado correctamente.", "success");
    await loadProducts();

    // Si es un producto nuevo, mostramos el QR automáticamente
    if (!id) showQrModal(productId);
  } catch (err) {
    console.error(err);
    showToast(err.message || "No se pudo guardar el producto.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar producto";
  }
});

async function handleDelete(id) {
  const product = allProducts.find((p) => p.id === id);
  if (!confirm(`¿Eliminar "${product?.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await deleteDoc(doc(db, "products", id));
    showToast("Producto eliminado.", "success");
    loadProducts();
  } catch (err) {
    console.error(err);
    showToast("No se pudo eliminar el producto.", "error");
  }
}

function showQrModal(id) {
  const product = allProducts.find((p) => p.id === id) || { name: "", qrCodeDataUrl: "" };
  qrProductName.textContent = product.name;
  qrImage.src = product.qrCodeDataUrl;
  qrDownloadLink.href = product.qrCodeDataUrl;
  qrDownloadLink.download = `qr-${(product.name || "producto").replace(/\s+/g, "-").toLowerCase()}.png`;
  qrModal.classList.add("is-open");
}
document.getElementById("qr-close-btn").addEventListener("click", () => qrModal.classList.remove("is-open"));

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
await loadCategories();
await loadProducts();
