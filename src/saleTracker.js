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
