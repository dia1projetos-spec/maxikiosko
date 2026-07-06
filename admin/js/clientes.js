// ============================================================
// MÓDULO DE CLIENTES
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
import { formatCurrency, showToast, escapeHtml, generateClientNumber } from "../../js/utils.js";

await initAdminLayout("clientes", "Clientes");

setContent(`
  <div class="panel">
    <div class="panel__header">
      <h2>Clientes registrados</h2>
      <button id="new-client-btn" class="btn btn-primary">+ Nuevo cliente</button>
    </div>
    <div class="form-group" style="max-width: 320px;">
      <input type="text" id="client-search" placeholder="Buscar por nombre o número...">
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Nombre</th>
            <th>Contacto</th>
            <th>Tipo</th>
            <th>Fiado</th>
            <th style="width:150px;">Acciones</th>
          </tr>
        </thead>
        <tbody id="clients-tbody">
          <tr><td colspan="6"><div class="spinner"></div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
`);

let allClients = [];

const tbody = document.getElementById("clients-tbody");
const searchInput = document.getElementById("client-search");
const newClientBtn = document.getElementById("new-client-btn");

const clientModal = document.getElementById("client-modal");
const clientForm = document.getElementById("client-form");
const clientModalTitle = document.getElementById("client-modal-title");
const clientIdInput = document.getElementById("client-id");
const nameInput = document.getElementById("client-name");
const contactInput = document.getElementById("client-contact");
const retentionInput = document.getElementById("client-retention");
const saveBtn = document.getElementById("client-save-btn");

const historyModal = document.getElementById("history-modal");
const historyModalTitle = document.getElementById("history-modal-title");
const historyTbody = document.getElementById("history-tbody");
const fiadoBanner = document.getElementById("fiado-banner");
const fiadoAmountEl = document.getElementById("fiado-amount");
const markFiadoPaidBtn = document.getElementById("mark-fiado-paid-btn");

let currentHistoryClientId = null;

// ------------------------------------------------------------
// Cargar / limpiar historial vencido / renderizar
// ------------------------------------------------------------
async function loadClients() {
  const q = query(collection(db, "clients"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  allClients = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  await cleanExpiredHistory();
  renderClients();
}

async function cleanExpiredHistory() {
  const now = Date.now();
  for (const client of allClients) {
    if (!client.historyRetentionDays || !Array.isArray(client.history) || !client.history.length) continue;
    const cutoff = now - client.historyRetentionDays * 24 * 60 * 60 * 1000;
    const filtered = client.history.filter((h) => {
      const date = h.date?.toMillis ? h.date.toMillis() : h.date;
      return date >= cutoff;
    });
    if (filtered.length !== client.history.length) {
      client.history = filtered;
      await updateDoc(doc(db, "clients", client.id), { history: filtered });
    }
  }
}

function renderClients() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = allClients.filter(
    (c) => !term || c.name.toLowerCase().includes(term) || (c.clientNumber || "").toLowerCase().includes(term)
  );

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay clientes que coincidan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((c) => {
      const typeLabel =
        c.type === "family"
          ? `<span class="badge badge-mustard">Familiar</span>`
          : `<span class="badge badge-teal">Común</span>`;
      const fiadoLabel = c.fiadoOpen
        ? `<span class="badge badge-brick">${formatCurrency(c.fiadoAmount || 0)}</span>`
        : `<span class="badge badge-teal">Sin deuda</span>`;
      return `
      <tr data-id="${c.id}">
        <td>${escapeHtml(c.clientNumber || "—")}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.contact)}</td>
        <td>${typeLabel}</td>
        <td>${fiadoLabel}</td>
        <td>
          <div class="action-icons">
            <button class="icon-btn history-btn" title="Ver historial">📜</button>
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
  tbody.querySelectorAll(".history-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => showHistory(e.target.closest("tr").dataset.id))
  );
}
searchInput.addEventListener("input", renderClients);

// ------------------------------------------------------------
// Crear / editar cliente
// ------------------------------------------------------------
function resetForm() {
  clientForm.reset();
  clientIdInput.value = "";
  document.querySelector('input[name="clientType"][value="common"]').checked = true;
}

newClientBtn.addEventListener("click", () => {
  resetForm();
  clientModalTitle.textContent = "Nuevo cliente";
  clientModal.classList.add("is-open");
});
document.getElementById("client-modal-close").addEventListener("click", () => clientModal.classList.remove("is-open"));

function openEditModal(id) {
  const client = allClients.find((c) => c.id === id);
  if (!client) return;
  resetForm();
  clientModalTitle.textContent = "Editar cliente";
  clientIdInput.value = id;
  nameInput.value = client.name;
  contactInput.value = client.contact;
  retentionInput.value = client.historyRetentionDays ?? "";
  document.querySelector(`input[name="clientType"][value="${client.type || "common"}"]`).checked = true;
  clientModal.classList.add("is-open");
}

clientForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando...";
  try {
    const id = clientIdInput.value;
    const type = document.querySelector('input[name="clientType"]:checked').value;
    const data = {
      name: nameInput.value.trim(),
      contact: contactInput.value.trim(),
      type,
      historyRetentionDays: retentionInput.value ? Number(retentionInput.value) : null,
    };

    if (id) {
      await updateDoc(doc(db, "clients", id), data);
    } else {
      data.clientNumber = generateClientNumber(allClients.length);
      data.fiadoOpen = false;
      data.fiadoAmount = 0;
      data.history = [];
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "clients"), data);
    }

    clientModal.classList.remove("is-open");
    showToast("Cliente guardado correctamente.", "success");
    await loadClients();
  } catch (err) {
    console.error(err);
    showToast("No se pudo guardar el cliente.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar cliente";
  }
});

async function handleDelete(id) {
  const client = allClients.find((c) => c.id === id);
  if (!confirm(`¿Eliminar a "${client?.name}"? Se perderá su historial.`)) return;
  try {
    await deleteDoc(doc(db, "clients", id));
    showToast("Cliente eliminado.", "success");
    loadClients();
  } catch (err) {
    console.error(err);
    showToast("No se pudo eliminar el cliente.", "error");
  }
}

// ------------------------------------------------------------
// Historial y fiado
// ------------------------------------------------------------
function showHistory(id) {
  const client = allClients.find((c) => c.id === id);
  if (!client) return;
  currentHistoryClientId = id;
  historyModalTitle.textContent = `Historial de ${client.name}`;

  if (client.fiadoOpen) {
    fiadoBanner.style.display = "flex";
    fiadoAmountEl.textContent = formatCurrency(client.fiadoAmount || 0);
  } else {
    fiadoBanner.style.display = "none";
  }

  const history = [...(client.history || [])].sort((a, b) => {
    const da = a.date?.toMillis ? a.date.toMillis() : a.date;
    const db_ = b.date?.toMillis ? b.date.toMillis() : b.date;
    return db_ - da;
  });

  if (!history.length) {
    historyTbody.innerHTML = `<tr><td colspan="4" class="empty-state">Todavía no hay compras registradas.</td></tr>`;
  } else {
    historyTbody.innerHTML = history
      .map((h) => {
        const date = h.date?.toDate ? h.date.toDate() : new Date(h.date);
        const dateLabel = date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const tags = [];
        if (h.isJoint) tags.push('<span class="badge badge-teal">Compra conjunta</span>');
        if (h.isFamilyWithdrawal) tags.push('<span class="badge badge-mustard">Retiro familiar</span>');
        if (h.paymentMethod === "fiado" && h.paidAt) tags.push('<span class="badge badge-teal">Fiado saldado</span>');
        return `
        <tr>
          <td>${dateLabel}</td>
          <td>${formatCurrency(h.total)}</td>
          <td style="text-transform:capitalize;">${h.paymentMethod}</td>
          <td>${tags.join(" ") || "—"}</td>
        </tr>`;
      })
      .join("");
  }

  historyModal.classList.add("is-open");
}
document.getElementById("history-modal-close").addEventListener("click", () => historyModal.classList.remove("is-open"));

markFiadoPaidBtn.addEventListener("click", async () => {
  if (!currentHistoryClientId) return;
  if (!confirm("¿Confirmás que este cliente saldó su fiado?")) return;
  try {
    const client = allClients.find((c) => c.id === currentHistoryClientId);
    const updatedHistory = (client.history || []).map((h) =>
      h.paymentMethod === "fiado" && !h.paidAt ? { ...h, paidAt: new Date() } : h
    );
    await updateDoc(doc(db, "clients", currentHistoryClientId), {
      fiadoOpen: false,
      fiadoAmount: 0,
      history: updatedHistory,
    });
    showToast("Fiado marcado como pagado.", "success");
    historyModal.classList.remove("is-open");
    await loadClients();
  } catch (err) {
    console.error(err);
    showToast("No se pudo actualizar el fiado.", "error");
  }
});

await loadClients();
