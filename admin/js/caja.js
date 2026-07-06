// ============================================================
// MÓDULO DE CAJA (PDV)
// ============================================================
import { initAdminLayout, setContent } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  increment,
} from "../../js/firebase-config.js";
import { formatCurrency, showToast, escapeHtml, debounce } from "../../js/utils.js";

await initAdminLayout("caja", "Caja (PDV)");

setContent(`
  <div class="pos-layout">
    <div>
      <div class="panel">
        <div class="panel__header"><h2>Buscar producto</h2></div>
        <div style="display:flex; gap: var(--space-3); flex-wrap:wrap;">
          <div class="form-group" style="flex:1; min-width:220px; margin-bottom:0;">
            <input type="text" id="search-input" placeholder="🔎 Buscar por nombre o código de barras...">
          </div>
          <button id="scan-btn" class="btn btn-secondary">📷 Escanear QR</button>
        </div>
        <div id="search-results" class="pos-search-results" style="display:none;"></div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Productos disponibles</h2></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th style="width:90px;"></th></tr></thead>
            <tbody id="all-products-tbody"><tr><td colspan="4"><div class="spinner"></div></td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="pos-ticket">
      <h2 style="margin-bottom: var(--space-3);">🧾 Ticket actual</h2>
      <div id="ticket-items">
        <div class="empty-state"><p>Agregá productos para empezar.</p></div>
      </div>
      <div class="pos-ticket__total">
        <span>Total</span>
        <span id="ticket-total">$0,00</span>
      </div>
      <button id="finalize-btn" class="btn btn-primary btn-block" style="margin-top: var(--space-4);" disabled>
        Finalizar venta
      </button>
      <button id="clear-ticket-btn" class="btn btn-outline btn-block" style="margin-top: var(--space-2);">
        Vaciar ticket
      </button>
    </div>
  </div>
`);

// ------------------------------------------------------------
// Estado
// ------------------------------------------------------------
let allProducts = [];
let allClients = [];
let ticket = []; // { productId, name, unitPrice, amount, soldBy, profit }

const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const allProductsTbody = document.getElementById("all-products-tbody");
const ticketItemsEl = document.getElementById("ticket-items");
const ticketTotalEl = document.getElementById("ticket-total");
const finalizeBtn = document.getElementById("finalize-btn");
const clearTicketBtn = document.getElementById("clear-ticket-btn");

// ------------------------------------------------------------
// Cargar productos y clientes
// ------------------------------------------------------------
async function loadData() {
  const [productsSnap, clientsSnap] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(collection(db, "clients")),
  ]);
  allProducts = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  allClients = clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAllProducts();
  populateClientSelect();
}

function renderAllProducts() {
  if (!allProducts.length) {
    allProductsTbody.innerHTML = `<tr><td colspan="4" class="empty-state">No hay productos cargados.</td></tr>`;
    return;
  }
  allProductsTbody.innerHTML = allProducts
    .map((p) => {
      const priceLabel = p.soldBy === "weight" ? `${formatCurrency(p.salePrice)}/kg` : formatCurrency(p.salePrice);
      return `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${priceLabel}</td>
        <td>${p.stock ?? "—"}</td>
        <td><button class="btn btn-primary btn-sm add-to-ticket" data-id="${p.id}">Agregar</button></td>
      </tr>`;
    })
    .join("");
  allProductsTbody.querySelectorAll(".add-to-ticket").forEach((btn) =>
    btn.addEventListener("click", () => handleAddProduct(btn.dataset.id))
  );
}

// ------------------------------------------------------------
// Búsqueda (nombre / código de barras)
// ------------------------------------------------------------
searchInput.addEventListener(
  "input",
  debounce((e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) {
      searchResults.style.display = "none";
      return;
    }
    const matches = allProducts.filter(
      (p) => p.name.toLowerCase().includes(term) || (p.barcode || "").toLowerCase() === term
    );
    if (!matches.length) {
      searchResults.innerHTML = `<div class="pos-search-result">Sin resultados</div>`;
    } else {
      searchResults.innerHTML = matches
        .map(
          (p) => `
        <div class="pos-search-result" data-id="${p.id}">
          <span>${escapeHtml(p.name)}</span>
          <strong>${formatCurrency(p.salePrice)}${p.soldBy === "weight" ? "/kg" : ""}</strong>
        </div>`
        )
        .join("");
      searchResults.querySelectorAll(".pos-search-result[data-id]").forEach((row) =>
        row.addEventListener("click", () => {
          handleAddProduct(row.dataset.id);
          searchInput.value = "";
          searchResults.style.display = "none";
        })
      );
    }
    searchResults.style.display = "block";
  }, 200)
);

// ------------------------------------------------------------
// Escáner de código QR (cámara)
// ------------------------------------------------------------
const scanModal = document.getElementById("qr-scanner-modal");
let html5QrCode = null;

document.getElementById("scan-btn").addEventListener("click", async () => {
  scanModal.classList.add("is-open");
  html5QrCode = new Html5Qrcode("qr-reader");
  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        const match = decodedText.match(/^KIOSKO-PROD:(.+)$/);
        if (match) {
          handleAddProduct(match[1]);
          showToast("Producto agregado desde QR.", "success");
        } else {
          showToast("Ese QR no corresponde a un producto del sistema.", "error");
        }
        closeScannerModal();
      }
    );
  } catch (err) {
    console.error(err);
    showToast("No se pudo acceder a la cámara.", "error");
    closeScannerModal();
  }
});

function closeScannerModal() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
  scanModal.classList.remove("is-open");
}
document.getElementById("qr-scanner-close").addEventListener("click", closeScannerModal);

// ------------------------------------------------------------
// Manejo del ticket
// ------------------------------------------------------------
function handleAddProduct(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) {
    showToast("Producto no encontrado.", "error");
    return;
  }

  if (product.soldBy === "weight") {
    const gramsInput = prompt(`¿Cuántos gramos de "${product.name}"?`);
    const grams = Number(gramsInput);
    if (!gramsInput || isNaN(grams) || grams <= 0) return;
    addToTicket(product, grams / 1000);
  } else {
    addToTicket(product, 1);
  }
}

function addToTicket(product, amount) {
  const existing = ticket.find((i) => i.productId === product.id);
  if (existing) {
    existing.amount += amount;
  } else {
    ticket.push({
      productId: product.id,
      name: product.name,
      unitPrice: product.salePrice,
      soldBy: product.soldBy || "unit",
      profit: product.profit || 0,
      amount,
    });
  }
  renderTicket();
}

function renderTicket() {
  if (!ticket.length) {
    ticketItemsEl.innerHTML = `<div class="empty-state"><p>Agregá productos para empezar.</p></div>`;
    finalizeBtn.disabled = true;
  } else {
    ticketItemsEl.innerHTML = ticket
      .map((item, index) => {
        const amountLabel =
          item.soldBy === "weight" ? `${(item.amount * 1000).toFixed(0)} g` : `${item.amount} un.`;
        return `
        <div class="pos-ticket__item" data-index="${index}">
          <span>${escapeHtml(item.name)} <br><small>${amountLabel}</small></span>
          <span>
            ${formatCurrency(item.unitPrice * item.amount)}
            <button class="remove-ticket-item" style="margin-left:8px; color: var(--color-brick);" title="Quitar">✕</button>
          </span>
        </div>`;
      })
      .join("");
    ticketItemsEl.querySelectorAll(".remove-ticket-item").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const index = Number(e.target.closest(".pos-ticket__item").dataset.index);
        ticket.splice(index, 1);
        renderTicket();
      })
    );
    finalizeBtn.disabled = false;
  }
  const total = ticket.reduce((sum, i) => sum + i.unitPrice * i.amount, 0);
  ticketTotalEl.textContent = formatCurrency(total);
}

clearTicketBtn.addEventListener("click", () => {
  if (!ticket.length) return;
  if (confirm("¿Vaciar el ticket actual?")) {
    ticket = [];
    renderTicket();
  }
});

// ------------------------------------------------------------
// Modal de pago
// ------------------------------------------------------------
const paymentModal = document.getElementById("payment-modal");
const paymentClientSelect = document.getElementById("payment-client");
const familyClientHint = document.getElementById("family-client-hint");
const cashGroup = document.getElementById("cash-group");
const cashGivenInput = document.getElementById("cash-given");
const changeHint = document.getElementById("change-hint");
const jointGroup = document.getElementById("joint-group");
const jointCheckbox = document.getElementById("joint-checkbox");
const jointClientsWrap = document.getElementById("joint-clients-wrap");
const jointClientsList = document.getElementById("joint-clients-list");
const paymentTotalEl = document.getElementById("payment-total");
const confirmSaleBtn = document.getElementById("confirm-sale-btn");

function populateClientSelect() {
  paymentClientSelect.innerHTML =
    `<option value="">Sin cliente asociado</option>` +
    allClients
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} ${c.type === "family" ? "(familiar)" : ""}</option>`)
      .join("");
}

finalizeBtn.addEventListener("click", () => {
  paymentTotalEl.textContent = ticketTotalEl.textContent;
  paymentModal.classList.add("is-open");
  updatePaymentUI();
});
document.getElementById("payment-modal-close").addEventListener("click", () => paymentModal.classList.remove("is-open"));

paymentClientSelect.addEventListener("change", updatePaymentUI);
document.querySelectorAll('input[name="paymentMethod"]').forEach((r) => r.addEventListener("change", updatePaymentUI));
cashGivenInput.addEventListener("input", updateChangeHint);
jointCheckbox.addEventListener("change", () => {
  jointClientsWrap.style.display = jointCheckbox.checked ? "block" : "none";
});

function updatePaymentUI() {
  const clientId = paymentClientSelect.value;
  const client = allClients.find((c) => c.id === clientId);
  const method = document.querySelector('input[name="paymentMethod"]:checked').value;

  familyClientHint.style.display = client?.type === "family" ? "block" : "none";
  cashGroup.style.display = method === "efectivo" && client?.type !== "family" ? "block" : "none";
  jointGroup.style.display = method === "fiado" && clientId && client?.type !== "family" ? "block" : "none";

  if (jointGroup.style.display === "block") {
    jointClientsList.innerHTML = allClients
      .filter((c) => c.id !== clientId)
      .map(
        (c) => `<label style="display:flex; gap:8px; padding:4px 0;">
          <input type="checkbox" class="joint-client-check" value="${c.id}" style="width:auto;"> ${escapeHtml(c.name)}
        </label>`
      )
      .join("");
  }

  updateChangeHint();
}

function updateChangeHint() {
  const total = ticket.reduce((sum, i) => sum + i.unitPrice * i.amount, 0);
  const given = Number(cashGivenInput.value) || 0;
  if (given > 0) {
    const change = given - total;
    changeHint.textContent =
      change >= 0 ? `Vuelto a entregar: ${formatCurrency(change)}` : `Falta: ${formatCurrency(Math.abs(change))}`;
    changeHint.style.color = change >= 0 ? "var(--color-success)" : "var(--color-brick)";
  } else {
    changeHint.textContent = "";
  }
}

// ------------------------------------------------------------
// Confirmar venta
// ------------------------------------------------------------
confirmSaleBtn.addEventListener("click", async () => {
  if (!ticket.length) return;
  confirmSaleBtn.disabled = true;
  confirmSaleBtn.textContent = "Guardando venta...";

  try {
    const clientId = paymentClientSelect.value || null;
    const client = allClients.find((c) => c.id === clientId);
    const isFamilyWithdrawal = client?.type === "family";
    const method = document.querySelector('input[name="paymentMethod"]:checked').value;
    const total = ticket.reduce((sum, i) => sum + i.unitPrice * i.amount, 0);
    const isJoint = !isFamilyWithdrawal && method === "fiado" && jointCheckbox.checked;
    const jointClientIds = isJoint
      ? Array.from(jointClientsList.querySelectorAll(".joint-client-check:checked")).map((el) => el.value)
      : [];

    if (method === "fiado" && !isFamilyWithdrawal && !clientId) {
      showToast("Para vender fiado, primero seleccioná un cliente.", "error");
      confirmSaleBtn.disabled = false;
      confirmSaleBtn.textContent = "Confirmar venta";
      return;
    }

    const cashGiven = method === "efectivo" && !isFamilyWithdrawal ? Number(cashGivenInput.value) || 0 : null;
    const change = cashGiven !== null ? cashGiven - total : null;

    const saleData = {
      items: ticket.map((i) => ({
        productId: i.productId,
        name: i.name,
        qty: i.amount,
        unitPrice: i.unitPrice,
        subtotal: i.unitPrice * i.amount,
        soldBy: i.soldBy,
      })),
      total,
      clientId,
      jointClientIds,
      isJoint,
      isFamilyWithdrawal,
      paymentMethod: isFamilyWithdrawal ? "retiro_familiar" : method,
      cashGiven,
      change,
      fiadoPaid: false,
      fiadoPaidAt: null,
      createdAt: serverTimestamp(),
    };

    const saleDoc = await addDoc(collection(db, "sales"), saleData);

    // Actualizar contadores de productos (más vendido / ganancia)
    for (const item of ticket) {
      await updateDoc(doc(db, "products", item.productId), {
        totalSold: increment(item.amount),
        totalProfit: increment((item.profit || 0) * (item.soldBy === "weight" ? item.amount : item.amount)),
      });
    }

    // Actualizar cliente(s): historial + fiado
    if (isFamilyWithdrawal && clientId) {
      await addHistoryEntry(clientId, saleDoc.id, total, "retiro_familiar", { isFamilyWithdrawal: true });
    } else if (method === "fiado" && clientId) {
      if (isJoint && jointClientIds.length) {
        const share = total / (jointClientIds.length + 1);
        await addHistoryEntry(clientId, saleDoc.id, share, "fiado", { isJoint: true }, share);
        for (const jId of jointClientIds) {
          await addHistoryEntry(jId, saleDoc.id, share, "fiado", { isJoint: true }, share);
        }
      } else {
        await addHistoryEntry(clientId, saleDoc.id, total, "fiado", {}, total);
      }
    } else if (clientId) {
      await addHistoryEntry(clientId, saleDoc.id, total, method, {});
    }

    showToast("¡Venta registrada correctamente!", "success");
    ticket = [];
    renderTicket();
    paymentModal.classList.remove("is-open");
    cashGivenInput.value = "";
    jointCheckbox.checked = false;
    paymentClientSelect.value = "";
    await loadData();
  } catch (err) {
    console.error(err);
    showToast("No se pudo registrar la venta.", "error");
  } finally {
    confirmSaleBtn.disabled = false;
    confirmSaleBtn.textContent = "Confirmar venta";
  }
});

async function addHistoryEntry(clientId, saleId, total, paymentMethod, extra = {}, fiadoAmountToAdd = 0) {
  const client = allClients.find((c) => c.id === clientId);
  if (!client) return;
  const newHistory = [
    ...(client.history || []),
    {
      saleId,
      date: new Date(),
      total,
      paymentMethod,
      isJoint: !!extra.isJoint,
      isFamilyWithdrawal: !!extra.isFamilyWithdrawal,
      paidAt: null,
    },
  ];
  const updates = { history: newHistory };
  if (fiadoAmountToAdd > 0) {
    updates.fiadoOpen = true;
    updates.fiadoAmount = (client.fiadoAmount || 0) + fiadoAmountToAdd;
  }
  await updateDoc(doc(db, "clients", clientId), updates);
  client.history = newHistory;
  if (fiadoAmountToAdd > 0) {
    client.fiadoOpen = true;
    client.fiadoAmount = (client.fiadoAmount || 0) + fiadoAmountToAdd;
  }
}

await loadData();
