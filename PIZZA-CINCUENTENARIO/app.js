const API_URL = "https://script.google.com/macros/s/AKfycbxuhD3kHu0TRxfBFrqbhJlYG56B24EZtkPGkFAKXh2N-wB5IUo97jnRGBIB011Kl0ox/exec";
const PRICE_PER_PIZZA = 9000;

const pizzas = [
  { nombre: "Margarita", precio: PRICE_PER_PIZZA },
  { nombre: "Pepperoni", precio: PRICE_PER_PIZZA },
  { nombre: "Hawaiana", precio: PRICE_PER_PIZZA },
  { nombre: "4 Quesos", precio: PRICE_PER_PIZZA }
];

let seleccion = pizzas.map((pizza) => ({ ...pizza, cantidad: 0 }));
let isSaving = false;
let pedidosData = [];

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

function formatCOP(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function getSelectedItems() {
  return seleccion.filter((pizza) => pizza.cantidad > 0);
}

function getSelectedCount() {
  return getSelectedItems().reduce((sum, pizza) => sum + pizza.cantidad, 0);
}

function getSelectedTotal() {
  return getSelectedItems().reduce((sum, pizza) => sum + pizza.precio * pizza.cantidad, 0);
}

function buildOrderSummaryString(items = getSelectedItems()) {
  return items.map((pizza) => `${pizza.nombre} x${pizza.cantidad}`).join(", ");
}

function getStatusMeta(status) {
  const normalized = String(status || "Preparacion").trim().toLowerCase();

  if (normalized === "despachada" || normalized === "listo") {
    return { label: "Despachada", className: "status-despachada" };
  }

  if (normalized === "olvidado") {
    return { label: "Olvidado", className: "status-olvidado" };
  }

  return { label: "Preparacion", className: "status-preparacion" };
}

function getRawStatus(status) {
  return getStatusMeta(status).label;
}

function parseTotal(total) {
  const numeric = String(total ?? 0).replace(/[^\d]/g, "");
  return Number(numeric) || 0;
}

function parsePizzasList(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderMenu() {
  const menu = document.getElementById("menu");
  menu.innerHTML = "";

  seleccion.forEach((pizza, index) => {
    const div = document.createElement("div");
    div.className = `card${pizza.cantidad > 0 ? " active" : ""}`;
    div.innerHTML = `
      <span class="card-check">&#10003;</span>
      <span class="card-name">${pizza.nombre}</span>
      <span class="card-price">${formatCOP(pizza.precio)}</span>
      <div class="qty-controls">
        <span>${pizza.cantidad > 0 ? `${pizza.cantidad} seleccionada${pizza.cantidad > 1 ? "s" : ""}` : "Agrega unidades"}</span>
        <div class="qty-stepper">
          <button type="button" onclick="changePizzaQty(${index}, -1)">-</button>
          <span class="qty-value">${pizza.cantidad}</span>
          <button type="button" onclick="changePizzaQty(${index}, 1)">+</button>
        </div>
      </div>
    `;

    menu.appendChild(div);
  });

  actualizarResumen();
}

function changePizzaQty(index, delta) {
  const pizza = seleccion[index];
  pizza.cantidad = Math.max(0, pizza.cantidad + delta);
  renderMenu();
}

function actualizarResumen() {
  const selectedItems = getSelectedItems();
  const total = getSelectedTotal();
  const resumen = document.getElementById("resumenPedido");

  document.getElementById("totalResumen").textContent = formatCOP(total);

  if (!selectedItems.length) {
    resumen.classList.add("hidden");
    resumen.innerHTML = "";
    return;
  }

  resumen.classList.remove("hidden");
  resumen.innerHTML = `
    <h3>Resumen del pedido</h3>
    ${selectedItems
      .map(
        (pizza) => `
          <div class="order-summary-item">
            <span>${pizza.nombre} x${pizza.cantidad}</span>
            <span>${formatCOP(pizza.precio * pizza.cantidad)}</span>
          </div>
        `
      )
      .join("")}
    <div class="order-summary-item">
      <span>Total</span>
      <span>${formatCOP(total)}</span>
    </div>
  `;
}

function finalizarPedido() {
  if (!getSelectedCount()) {
    alert("Selecciona al menos una pizza");
    return;
  }

  document.getElementById("clienteForm").classList.remove("hidden");
  document.getElementById("clienteNombre").focus();
}

function setSaveFeedbackState({ loading, success, title, message }) {
  const overlay = document.getElementById("saveFeedback");
  const loader = document.getElementById("loaderRing");
  const check = document.getElementById("successCheck");
  const feedbackTitle = document.getElementById("feedbackTitle");
  const feedbackMessage = document.getElementById("feedbackMessage");

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  loader.classList.toggle("hidden", !loading);
  check.classList.toggle("hidden", !success);
  feedbackTitle.textContent = title;
  feedbackMessage.textContent = message;
}

function hideSaveFeedback() {
  const overlay = document.getElementById("saveFeedback");
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function guardarPedido() {
  if (isSaving) {
    return;
  }

  const clienteInput = document.getElementById("clienteNombre");
  const guardarBtn = document.getElementById("guardarBtn");
  const cliente = clienteInput.value.trim();
  const selectedItems = getSelectedItems();

  if (!cliente) {
    alert("Escribe el nombre del cliente");
    clienteInput.focus();
    return;
  }

  if (!selectedItems.length) {
    alert("Selecciona al menos una pizza");
    return;
  }

  const total = getSelectedTotal();
  const pizzasResumen = buildOrderSummaryString(selectedItems);

  isSaving = true;
  guardarBtn.disabled = true;
  setSaveFeedbackState({
    loading: true,
    success: false,
    title: "Guardando pedido...",
    message: "Estamos registrando el pedido en cocina."
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "add",
        cliente,
        pizzas: pizzasResumen,
        total,
        estado: "Preparacion"
      })
    });

    await response.json();

    setSaveFeedbackState({
      loading: false,
      success: true,
      title: "Pedido guardado",
      message: "El pedido quedo organizado y listo para seguimiento."
    });

    seleccion = pizzas.map((pizza) => ({ ...pizza, cantidad: 0 }));
    clienteInput.value = "";
    document.getElementById("clienteForm").classList.add("hidden");
    renderMenu();
    await cargarPedidos();
    await wait(1300);
  } catch (error) {
    setSaveFeedbackState({
      loading: false,
      success: false,
      title: "No se pudo guardar",
      message: "Intenta de nuevo en unos segundos."
    });

    await wait(1400);
  } finally {
    hideSaveFeedback();
    guardarBtn.disabled = false;
    isSaving = false;
  }
}

function getFilters() {
  return {
    nombre: document.getElementById("buscadorNombre").value.trim().toLowerCase(),
    estado: document.getElementById("filtroEstado").value
  };
}

function normalizePedido(pedido) {
  const status = getRawStatus(pedido.Estado);

  return {
    ...pedido,
    Estado: status,
    TotalValue: parseTotal(pedido.Total),
    PizzasList: parsePizzasList(pedido.Pizzas)
  };
}

function matchesFilters(pedido, filters) {
  const matchesName = !filters.nombre || String(pedido.Cliente || "").toLowerCase().includes(filters.nombre);
  const matchesStatus = filters.estado === "Todos" || pedido.Estado === filters.estado;
  return matchesName && matchesStatus;
}

function renderPedidoCard(pedido, includeActions) {
  const statusMeta = getStatusMeta(pedido.Estado);
  const pizzasMarkup = pedido.PizzasList.length
    ? pedido.PizzasList.map((item) => `<span>${item}</span>`).join("")
    : "<span>Pedido sin detalle</span>";

  return `
    <div class="pedido">
      <div class="pedido-header">
        <div>
          <strong>${pedido.Cliente || "Sin nombre"}</strong>
          <p>Total: ${formatCOP(pedido.TotalValue)}</p>
        </div>
        <span class="status-pill ${statusMeta.className}">${statusMeta.label}</span>
      </div>
      <div class="pedido-pizzas">${pizzasMarkup}</div>
      ${
        includeActions
          ? `
            <div class="pedido-actions">
              <button class="status-button preparacion" onclick="actualizarEstado(${pedido.row}, 'Preparacion')">Preparacion</button>
              <button class="status-button despachada" onclick="actualizarEstado(${pedido.row}, 'Despachada')">Despachada</button>
              <button class="status-button olvidado" onclick="actualizarEstado(${pedido.row}, 'Olvidado')">Olvidado</button>
              <button class="secondary-button" onclick="eliminar(${pedido.row})">Eliminar</button>
            </div>
          `
          : `
            <div class="pedido-actions">
              <button class="secondary-button" onclick="actualizarEstado(${pedido.row}, 'Preparacion')">Regresar</button>
              <button class="secondary-button" onclick="eliminar(${pedido.row})">Eliminar</button>
            </div>
          `
      }
    </div>
  `;
}

function renderPedidos() {
  const filters = getFilters();
  const pedidosActivos = document.getElementById("pedidos");
  const despachadas = document.getElementById("despachadas");

  const visibles = pedidosData.filter((pedido) => matchesFilters(pedido, filters));
  const activos = visibles.filter((pedido) => pedido.Estado !== "Despachada");
  const despachados = visibles.filter((pedido) => pedido.Estado === "Despachada");

  document.getElementById("pedidosActivosCount").textContent = activos.length;
  document.getElementById("despachadasResumen").textContent = `Total generado: ${formatCOP(
    despachados.reduce((sum, pedido) => sum + pedido.TotalValue, 0)
  )}`;

  pedidosActivos.innerHTML = activos.length
    ? activos.map((pedido) => renderPedidoCard(pedido, true)).join("")
    : '<div class="empty-state">No hay pedidos activos con ese filtro.</div>';

  despachadas.innerHTML = despachados.length
    ? despachados.map((pedido) => renderPedidoCard(pedido, false)).join("")
    : '<div class="empty-state">Todavia no hay pedidos despachados.</div>';
}

async function cargarPedidos() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    pedidosData = Array.isArray(data) ? data.map(normalizePedido) : [];
    renderPedidos();
  } catch (error) {
    document.getElementById("pedidos").innerHTML =
      '<div class="empty-state">No fue posible cargar los pedidos en este momento.</div>';
    document.getElementById("despachadas").innerHTML =
      '<div class="empty-state">No fue posible cargar las despachadas en este momento.</div>';
  }
}

async function eliminar(row) {
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete",
      row
    })
  });

  await cargarPedidos();
}

async function actualizarEstado(row, estado) {
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "estado",
      row,
      estado
    })
  });

  await cargarPedidos();
}

document.getElementById("buscadorNombre").addEventListener("input", renderPedidos);
document.getElementById("filtroEstado").addEventListener("change", renderPedidos);

renderMenu();
cargarPedidos();
