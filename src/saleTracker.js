const STORAGE_KEY = "storage_sale_tracker_v1";
const CLOUD_CONFIG_KEY = "storage_sale_tracker_cloud_v1";
const DEFAULT_RECORD_ID = "unit-6103";

const state = loadState();
const cloudConfig = loadCloudConfig();

const saleForm = document.getElementById("sale-form");
const activityForm = document.getElementById("activity-form");
const marketplaceForm = document.getElementById("marketplace-form");
const cloudForm = document.getElementById("cloud-form");
const marketplaceUrlInput = document.getElementById("marketplace-url");
const openMarketplaceBtn = document.getElementById("open-marketplace");
const installAppBtn = document.getElementById("install-app");
const saleFeedbackEl = document.getElementById("sale-feedback");
const cloudStatusEl = document.getElementById("cloud-status");
const cloudUrlInput = document.getElementById("cloud-url");
const cloudAnonKeyInput = document.getElementById("cloud-anon-key");
const cloudRecordIdInput = document.getElementById("cloud-record-id");
const cloudSyncBtn = document.getElementById("cloud-sync-now");
const cloudLoadBtn = document.getElementById("cloud-load-now");
const salesBody = document.getElementById("sales-body");
const activityBody = document.getElementById("activity-body");
const resetBtn = document.getElementById("reset-data");
let deferredInstallPrompt = null;
let cloudSyncTimeout = null;
let cloudSyncPromise = null;

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
populateCloudForm();

saleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(saleForm);
  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    setSaleFeedback("Enter an amount greater than 0.");
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
  setSaleFeedback("Sale entered.");
});

saleForm.addEventListener("input", () => {
  setSaleFeedback("");
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

if (cloudForm) {
  cloudForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(cloudForm);
    const url = cleanText(formData.get("url"), "");
    const anonKey = cleanText(formData.get("anonKey"), "");
    const recordId = cleanText(formData.get("recordId"), DEFAULT_RECORD_ID);

    if (url.length === 0 && anonKey.length === 0) {
      cloudConfig.url = "";
      cloudConfig.anonKey = "";
      cloudConfig.recordId = DEFAULT_RECORD_ID;
      saveCloudConfig();
      populateCloudForm();
      setCloudStatus("Cloud sync disabled.", "success");
      return;
    }

    if (!isValidHttpUrl(url)) {
      setCloudStatus("Enter a valid Supabase project URL.", "error");
      return;
    }

    if (anonKey.length === 0) {
      setCloudStatus("Paste your Supabase anon key.", "error");
      return;
    }

    cloudConfig.url = url.replace(/\/+$/, "");
    cloudConfig.anonKey = anonKey;
    cloudConfig.recordId = recordId;
    saveCloudConfig();
    setCloudStatus("Cloud settings saved.", "success");

    if (!hasLocalData()) {
      await loadFromCloud();
    }
  });
}

if (cloudSyncBtn) {
  cloudSyncBtn.addEventListener("click", async () => {
    await syncToCloudNow();
  });
}

if (cloudLoadBtn) {
  cloudLoadBtn.addEventListener("click", async () => {
    await loadFromCloud();
  });
}

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
  setSaleFeedback("");
});

render();
registerServiceWorker();
void bootstrapCloudSync();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyState();
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

function emptyState() {
  return {
    sales: [],
    activity: [],
    marketplaceUrl: "",
    lastModifiedAt: "",
  };
}

function normalizeState(parsed) {
  return {
    sales: Array.isArray(parsed.sales) ? parsed.sales : [],
    activity: Array.isArray(parsed.activity) ? parsed.activity : [],
    marketplaceUrl:
      typeof parsed.marketplaceUrl === "string" ? parsed.marketplaceUrl : "",
    lastModifiedAt:
      typeof parsed.lastModifiedAt === "string" ? parsed.lastModifiedAt : "",
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persistAndRender() {
  sortNewestFirst(state.sales);
  sortNewestFirst(state.activity);
  state.lastModifiedAt = new Date().toISOString();
  saveState();
  render();
  scheduleCloudSync();
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

function setSaleFeedback(message) {
  if (!saleFeedbackEl) {
    return;
  }

  saleFeedbackEl.textContent = message;
}

function loadCloudConfig() {
  const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
  if (!raw) {
    return {
      url: "",
      anonKey: "",
      recordId: DEFAULT_RECORD_ID,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      url: typeof parsed.url === "string" ? parsed.url : "",
      anonKey: typeof parsed.anonKey === "string" ? parsed.anonKey : "",
      recordId:
        typeof parsed.recordId === "string" && parsed.recordId.trim().length > 0
          ? parsed.recordId.trim()
          : DEFAULT_RECORD_ID,
    };
  } catch {
    return {
      url: "",
      anonKey: "",
      recordId: DEFAULT_RECORD_ID,
    };
  }
}

function saveCloudConfig() {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
}

function populateCloudForm() {
  if (cloudUrlInput) {
    cloudUrlInput.value = cloudConfig.url;
  }

  if (cloudAnonKeyInput) {
    cloudAnonKeyInput.value = cloudConfig.anonKey;
  }

  if (cloudRecordIdInput) {
    cloudRecordIdInput.value = cloudConfig.recordId;
  }
}

async function bootstrapCloudSync() {
  if (!isCloudConfigured()) {
    setCloudStatus("Using local-only storage on this device.");
    return;
  }

  setCloudStatus("Cloud sync ready.");

  if (!hasLocalData()) {
    await loadFromCloud(true);
  }
}

function isCloudConfigured() {
  return (
    cloudConfig.url.length > 0 &&
    cloudConfig.anonKey.length > 0 &&
    cloudConfig.recordId.length > 0
  );
}

function hasLocalData() {
  return (
    state.sales.length > 0 ||
    state.activity.length > 0 ||
    state.marketplaceUrl.length > 0
  );
}

function setCloudStatus(message, tone = "info") {
  if (!cloudStatusEl) {
    return;
  }

  cloudStatusEl.textContent = message;
  cloudStatusEl.dataset.tone = tone;
}

function scheduleCloudSync() {
  if (!isCloudConfigured()) {
    return;
  }

  setCloudStatus("Saving to cloud...");

  if (cloudSyncTimeout !== null) {
    window.clearTimeout(cloudSyncTimeout);
  }

  cloudSyncTimeout = window.setTimeout(() => {
    cloudSyncTimeout = null;
    void syncToCloudNow(true);
  }, 500);
}

async function syncToCloudNow(isAutoSync = false) {
  if (!isCloudConfigured()) {
    setCloudStatus("Save cloud settings before syncing.", "error");
    return;
  }

  if (cloudSyncPromise) {
    await cloudSyncPromise;
    return;
  }

  const snapshot = snapshotState();
  const payload = {
    id: cloudConfig.recordId,
    payload: snapshot,
    updated_at: snapshot.lastModifiedAt || new Date().toISOString(),
  };

  cloudSyncPromise = fetchCloudJson("/rest/v1/app_state", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });

  try {
    await cloudSyncPromise;
    setCloudStatus(
      isAutoSync ? "Cloud backup saved." : "Cloud sync complete.",
      "success",
    );
  } catch (error) {
    setCloudStatus(error.message, "error");
  } finally {
    cloudSyncPromise = null;
  }
}

async function loadFromCloud(isStartup = false) {
  if (!isCloudConfigured()) {
    setCloudStatus("Save cloud settings before loading data.", "error");
    return;
  }

  setCloudStatus("Loading cloud data...");

  const params = new URLSearchParams({
    select: "payload,updated_at",
    id: `eq.${cloudConfig.recordId}`,
  });

  try {
    const rows = await fetchCloudJson(`/rest/v1/app_state?${params.toString()}`);
    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row || !row.payload) {
      setCloudStatus(
        isStartup ? "Cloud sync ready. No remote data found yet." : "No cloud data found yet.",
      );
      return;
    }

    const nextState = normalizeState(row.payload);
    state.sales = nextState.sales;
    state.activity = nextState.activity;
    state.marketplaceUrl = nextState.marketplaceUrl;
    state.lastModifiedAt = nextState.lastModifiedAt || row.updated_at || "";
    saveState();
    render();
    setCloudStatus("Loaded data from cloud.", "success");
  } catch (error) {
    setCloudStatus(error.message, "error");
  }
}

async function fetchCloudJson(path, options = {}) {
  const response = await fetch(`${cloudConfig.url}${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: cloudConfig.anonKey,
      Authorization: `Bearer ${cloudConfig.anonKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Cloud sync failed: ${detail || response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

function snapshotState() {
  return {
    sales: state.sales,
    activity: state.activity,
    marketplaceUrl: state.marketplaceUrl,
    lastModifiedAt: state.lastModifiedAt || new Date().toISOString(),
  };
}
