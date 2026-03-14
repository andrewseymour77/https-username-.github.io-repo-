const STORAGE_KEY = "storage_sale_tracker_v1";

const state = loadState();

const saleForm = document.getElementById("sale-form");
const activityForm = document.getElementById("activity-form");
const marketplaceForm = document.getElementById("marketplace-form");
const marketplaceUrlInput = document.getElementById("marketplace-url");
const openMarketplaceBtn = document.getElementById("open-marketplace");
const installAppBtn = document.getElementById("install-app");
const salesBody = document.getElementById("sales-body");
const activityBody = document.getElementById("activity-body");
const resetBtn = document.getElementById("reset-data");
let deferredInstallPrompt = null;

const totals = {
  total: document.getElementById("total-sales"),
  CashApp: document.getElementById("sales-cashapp"),
  Venmo: document.getElementById("sales-venmo"),
  Zelle: document.getElementById("sales-zelle"),
  Cash: document.getElementById("sales-cash"),
};

const counts = {
  Hit: document.getElementById("count-hit"),
  Question: document.getElementById("count-question"),
  Interest: document.getElementById("count-interest"),
};

setDefaultDate(saleForm);
setDefaultDate(activityForm);
marketplaceUrlInput.value = state.marketplaceUrl;

saleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(saleForm);
  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  state.sales.push({
    id: crypto.randomUUID(),
    date: String(formData.get("date")),
    item: cleanText(formData.get("item"), "Item"),
    paymentMethod: String(formData.get("paymentMethod")),
    amount,
    notes: cleanText(formData.get("notes"), ""),
  });

  persistAndRender();
  saleForm.reset();
  setDefaultDate(saleForm);
});

activityForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(activityForm);

  state.activity.push({
    id: crypto.randomUUID(),
    date: String(formData.get("date")),
    type: String(formData.get("type")),
    channel: cleanText(formData.get("channel"), "N/A"),
    details: cleanText(formData.get("details"), ""),
  });

  persistAndRender();
  activityForm.reset();
  setDefaultDate(activityForm);
});

marketplaceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(marketplaceForm);
  const url = cleanText(formData.get("url"), "");

  if (url.length === 0) {
    state.marketplaceUrl = "";
    persistAndRender();
    return;
  }

  if (!isValidHttpUrl(url)) {
    window.alert("Please enter a valid URL (https://...)");
    return;
  }

  state.marketplaceUrl = url;
  persistAndRender();
});

openMarketplaceBtn.addEventListener("click", () => {
  const url = cleanText(state.marketplaceUrl, "");
  if (!isValidHttpUrl(url)) {
    window.alert("Add your Facebook Marketplace listing URL first.");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
});

if (installAppBtn) {
  installAppBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      window.alert(
        "Install is not available yet. On iPhone, use Share > Add to Home Screen.",
      );
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installAppBtn.disabled = true;
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installAppBtn) {
    installAppBtn.disabled = false;
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installAppBtn) {
    installAppBtn.disabled = true;
  }
});

resetBtn.addEventListener("click", () => {
  const ok = window.confirm("Delete all sales and activity data?");
  if (!ok) {
    return;
  }

  state.sales = [];
  state.activity = [];
  state.marketplaceUrl = "";
  persistAndRender();
});

render();
registerServiceWorker();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { sales: [], activity: [], marketplaceUrl: "" };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      marketplaceUrl:
        typeof parsed.marketplaceUrl === "string" ? parsed.marketplaceUrl : "",
    };
  } catch {
    return { sales: [], activity: [], marketplaceUrl: "" };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persistAndRender() {
  sortNewestFirst(state.sales);
  sortNewestFirst(state.activity);
  saveState();
  render();
}

function sortNewestFirst(list) {
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function render() {
  marketplaceUrlInput.value = state.marketplaceUrl;
  openMarketplaceBtn.disabled = !isValidHttpUrl(state.marketplaceUrl);
  renderTotals();
  renderCounts();
  renderSalesTable();
  renderActivityTable();
}

function renderTotals() {
  const byMethod = {
    CashApp: 0,
    Venmo: 0,
    Zelle: 0,
    Cash: 0,
  };

  for (const sale of state.sales) {
    if (Object.hasOwn(byMethod, sale.paymentMethod)) {
      byMethod[sale.paymentMethod] += Number(sale.amount) || 0;
    }
  }

  const totalSales =
    byMethod.CashApp + byMethod.Venmo + byMethod.Zelle + byMethod.Cash;

  totals.total.textContent = formatMoney(totalSales);
  totals.CashApp.textContent = formatMoney(byMethod.CashApp);
  totals.Venmo.textContent = formatMoney(byMethod.Venmo);
  totals.Zelle.textContent = formatMoney(byMethod.Zelle);
  totals.Cash.textContent = formatMoney(byMethod.Cash);
}

function renderCounts() {
  const nextCounts = {
    Hit: 0,
    Question: 0,
    Interest: 0,
  };

  for (const row of state.activity) {
    if (Object.hasOwn(nextCounts, row.type)) {
      nextCounts[row.type] += 1;
    }
  }

  counts.Hit.textContent = String(nextCounts.Hit);
  counts.Question.textContent = String(nextCounts.Question);
  counts.Interest.textContent = String(nextCounts.Interest);
}

function renderSalesTable() {
  if (state.sales.length === 0) {
    salesBody.innerHTML = "<tr><td colspan=\"4\">No sales yet.</td></tr>";
    return;
  }

  salesBody.innerHTML = state.sales
    .map(
      (sale) => `<tr>
        <td>${escapeHtml(sale.date)}</td>
        <td>${escapeHtml(sale.item)}</td>
        <td>${escapeHtml(sale.paymentMethod)}</td>
        <td>${formatMoney(Number(sale.amount) || 0)}</td>
      </tr>`,
    )
    .join("");
}

function renderActivityTable() {
  if (state.activity.length === 0) {
    activityBody.innerHTML = "<tr><td colspan=\"4\">No activity yet.</td></tr>";
    return;
  }

  activityBody.innerHTML = state.activity
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.channel || "N/A")}</td>
        <td>${escapeHtml(row.details || "")}</td>
      </tr>`,
    )
    .join("");
}

function setDefaultDate(form) {
  const input = form.querySelector('input[name="date"]');
  if (!input) {
    return;
  }
  input.value = getTodayDate();
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanText(value, fallback) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Keep app functional even if service worker registration fails.
    });
  });
}
