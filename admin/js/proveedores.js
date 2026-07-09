// ============================================================
// MÓDULO DE PROVEEDORES
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
import { formatCurrency, showToast, escapeHtml } from "../../js/utils.js";

await initAdminLayout("proveedores", "Proveedores");

setContent(`
  <div class="stat-grid" style="margin-bottom: var(--space-5);">
    <div class="stat-card stat-card--loss">
      <div class="stat-card__label">Total pagado a proveedores</div>
      <div class="stat-card__value" id="total-paid-all">—</div>
    </div>
  </div>

  <div class="panel">
    <div class="panel__header">
      <h2>Proveedores</h2>
      <button id="new-supplier-btn" class="btn btn-primary">+ Nuevo proveedor</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Nombre</th><th>Contacto</th><th>Pedidos</th><th>Total pagado</th><th style="width:150px;">Acciones</th></tr>
        </thead>
        <tbody id="suppliers-tbody"><tr><td colspan="5"><div class="spinner"></div></td></tr></tbody>
      </table>
    </div>
  </div>
`);

let allSuppliers = [];
let currentOrdersSupplierId = null;

const tbody = document.getElementById("suppliers-tbody");
const newSupplierBtn = document.getElementById("new-supplier-btn");

const supplierModal = document.getElementById("supplier-modal");
const supplierForm = document.getElementById("supplier-form");
const supplierModalTitle = document.getElementById("supplier-modal-title");
const supplierIdInput = document.getElementById("supplier-id");
const nameInput = document.getElementById("supplier-name");
const contactInput = document.getElementById("supplier-contact");
const saveBtn = document.getElementById("supplier-save-btn");

const ordersModal = document.getElementById("orders-modal");
const ordersModalTitle = document.getElementById("orders-modal-title");
const ordersTbody = document.getElementById("orders-tbody");
const orderForm = document.getElementById("order-form");
const orderItemInput = document.getElementById("order-item");
const orderDateInput = document.getElementById("order-date");
const orderAmountInput = document.getElementById("order-amount");
const supplierTotalPaidEl = document.getElementById("supplier-total-paid");

function supplierTotal(supplier) {
  return (supplier.orders || []).reduce((sum, o) => sum + (o.amountPaid || 0), 0);
}

// ------------------------------------------------------------
// Cargar / renderizar proveedores
// ------------------------------------------------------------
async function loadSuppliers() {
  const q = query(collection(db, "suppliers"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  allSuppliers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

function render() {
  if (!allSuppliers.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Todavía no cargaste ningún proveedor.</td></tr>`;
    document.getElementById("total-paid-all").textContent = formatCurrency(0);
    return;
  }

  let grandTotal = 0;
  tbody.innerHTML = allSuppliers
    .map((s) => {
      const total = supplierTotal(s);
      grandTotal += total;
      return `
      <tr data-id="${s.id}">
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.contact || "—")}</td>
        <td>${(s.orders || []).length}</td>
        <td>${formatCurrency(total)}</td>
        <td>
          <div class="action-icons">
            <button class="icon-btn orders-btn" title="Ver pedidos">📦</button>
            <button class="icon-btn edit-btn" title="Editar">✏️</button>
            <button class="icon-btn icon-btn--danger delete-btn" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  document.getElementById("total-paid-all").textContent = formatCurrency(grandTotal);

  tbody.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => openEditModal(e.target.closest("tr").dataset.id))
  );
  tbody.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => handleDelete(e.target.closest("tr").dataset.id))
  );
  tbody.querySelectorAll(".orders-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => showOrders(e.target.closest("tr").dataset.id))
  );
}

// ------------------------------------------------------------
// Crear / editar proveedor
// ------------------------------------------------------------
function resetForm() {
  supplierForm.reset();
  supplierIdInput.value = "";
}

newSupplierBtn.addEventListener("click", () => {
  resetForm();
  supplierModalTitle.textContent = "Nuevo proveedor";
  supplierModal.classList.add("is-open");
});
document.getElementById("supplier-modal-close").addEventListener("click", () => supplierModal.classList.remove("is-open"));

function openEditModal(id) {
  const supplier = allSuppliers.find((s) => s.id === id);
  if (!supplier) return;
  resetForm();
  supplierModalTitle.textContent = "Editar proveedor";
  supplierIdInput.value = id;
  nameInput.value = supplier.name;
  contactInput.value = supplier.contact || "";
  supplierModal.classList.add("is-open");
}

supplierForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando...";
  try {
    const id = supplierIdInput.value;
    const data = {
      name: nameInput.value.trim(),
      contact: contactInput.value.trim() || null,
    };
    if (id) {
      await updateDoc(doc(db, "suppliers", id), data);
    } else {
      data.orders = [];
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "suppliers"), data);
    }
    supplierModal.classList.remove("is-open");
    showToast("Proveedor guardado.", "success");
    await loadSuppliers();
  } catch (err) {
    console.error(err);
    showToast("No se pudo guardar el proveedor.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar proveedor";
  }
});

async function handleDelete(id) {
  const supplier = allSuppliers.find((s) => s.id === id);
  if (!confirm(`¿Eliminar a "${supplier?.name}"? Se perderá todo su historial de pedidos.`)) return;
  try {
    await deleteDoc(doc(db, "suppliers", id));
    showToast("Proveedor eliminado.", "success");
    loadSuppliers();
  } catch (err) {
    console.error(err);
    showToast("No se pudo eliminar el proveedor.", "error");
  }
}

// ------------------------------------------------------------
// Pedidos del proveedor
// ------------------------------------------------------------
function showOrders(id) {
  const supplier = allSuppliers.find((s) => s.id === id);
  if (!supplier) return;
  currentOrdersSupplierId = id;
  ordersModalTitle.textContent = `Pedidos de ${supplier.name}`;
  orderDateInput.value = new Date().toISOString().slice(0, 10);
  renderOrders(supplier);
  ordersModal.classList.add("is-open");
}

function renderOrders(supplier) {
  const orders = [...(supplier.orders || [])].sort((a, b) => (b.receivedDate || "").localeCompare(a.receivedDate || ""));
  supplierTotalPaidEl.textContent = `Total pagado: ${formatCurrency(supplierTotal(supplier))}`;

  if (!orders.length) {
    ordersTbody.innerHTML = `<tr><td colspan="4" class="empty-state">Todavía no hay pedidos registrados.</td></tr>`;
    return;
  }

  ordersTbody.innerHTML = orders
    .map((o, index) => {
      const [y, m, d] = (o.receivedDate || "").split("-");
      const dateLabel = y ? `${d}/${m}/${y}` : "—";
      return `
      <tr data-index="${index}">
        <td>${dateLabel}</td>
        <td>${escapeHtml(o.item)}</td>
        <td>${formatCurrency(o.amountPaid)}</td>
        <td><button class="icon-btn icon-btn--danger delete-order-btn" title="Eliminar">🗑️</button></td>
      </tr>`;
    })
    .join("");

  ordersTbody.querySelectorAll(".delete-order-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const sortedIndex = Number(e.target.closest("tr").dataset.index);
      const orderToRemove = orders[sortedIndex];
      handleDeleteOrder(orderToRemove);
    })
  );
}

document.getElementById("orders-modal-close").addEventListener("click", () => ordersModal.classList.remove("is-open"));

orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentOrdersSupplierId) return;
  const submitBtn = orderForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const supplier = allSuppliers.find((s) => s.id === currentOrdersSupplierId);
    const newOrder = {
      item: orderItemInput.value.trim(),
      receivedDate: orderDateInput.value,
      amountPaid: Number(orderAmountInput.value),
      createdAt: new Date(),
    };
    const updatedOrders = [...(supplier.orders || []), newOrder];
    await updateDoc(doc(db, "suppliers", currentOrdersSupplierId), { orders: updatedOrders });
    supplier.orders = updatedOrders;

    orderItemInput.value = "";
    orderAmountInput.value = "";
    orderDateInput.value = new Date().toISOString().slice(0, 10);

    renderOrders(supplier);
    render();
    showToast("Pedido registrado.", "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo registrar el pedido.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

async function handleDeleteOrder(orderToRemove) {
  if (!confirm("¿Eliminar este pedido del historial?")) return;
  try {
    const supplier = allSuppliers.find((s) => s.id === currentOrdersSupplierId);
    const updatedOrders = (supplier.orders || []).filter((o) => o !== orderToRemove);
    await updateDoc(doc(db, "suppliers", currentOrdersSupplierId), { orders: updatedOrders });
    supplier.orders = updatedOrders;
    renderOrders(supplier);
    render();
    showToast("Pedido eliminado.", "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo eliminar el pedido.", "error");
  }
}

await loadSuppliers();
