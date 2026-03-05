
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAiWPzEintJjv9X6nWSxs05U0giP3IXQ30",
  authDomain: "kaereste-app.firebaseapp.com",
  projectId: "kaereste-app",
  storageBucket: "kaereste-app.firebasestorage.app",
  messagingSenderId: "193077277457",
  appId: "1:193077277457:web:7a74712428f26a20fa92b0",
  measurementId: "G-PCJEPHYFM8"
};

const roomId = "ida-arvid";
const storageKey = "cute-synk-app-data";
const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const defaultData = {
  calendar: [],
  shopping: [],
  bucket: [],
  chores: []
};

const state = {
  data: loadData(),
  ui: {
    choresFilter: "alle"
  },
  sync: {
    clientId: getClientId(),
    lastRemoteUpdatedAt: 0,
    suppressRemoteWrite: false,
    ready: false
  }
};

function loadData() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return normalizeData(parsed);
  } catch {
    return structuredClone(defaultData);
  }
}

function normalizeData(data) {
  const source = data && typeof data === "object" ? data : defaultData;
  return {
    calendar: Array.isArray(source.calendar) ? source.calendar : [],
    shopping: (Array.isArray(source.shopping) ? source.shopping : []).map((item) => ({
      id: item.id || uid(),
      label: String(item.label || "").trim(),
      quantity: String(item.quantity || "").trim(),
      kind: normalizeKind(item.kind || item.category),
      done: Boolean(item.done)
    })).filter((item) => item.label),
    bucket: (Array.isArray(source.bucket) ? source.bucket : []).map((item) => ({
      id: item.id || uid(),
      label: String(item.label || "").trim(),
      priority: normalizePriority(item.priority),
      done: Boolean(item.done)
    })).filter((item) => item.label),
    chores: (Array.isArray(source.chores) ? source.chores : []).map((item) => ({
      id: item.id || uid(),
      label: String(item.label || "").trim(),
      assignedTo: normalizePerson(item.assignedTo),
      weekday: normalizeWeekday(item.weekday || weekdayFromDate(item.dueDate)),
      done: Boolean(item.done)
    })).filter((item) => item.label)
  };
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(state.data));
  scheduleRemoteSave();
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function getClientId() {
  const key = "cute-synk-client-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = uid();
    localStorage.setItem(key, id);
  }
  return id;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const roomRef = doc(db, "rooms", roomId);
let remoteSaveTimer = null;

function scheduleRemoteSave() {
  if (!state.sync.ready || state.sync.suppressRemoteWrite) return;
  if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(pushRemote, 600);
}

async function pushRemote() {
  if (!state.sync.ready || state.sync.suppressRemoteWrite) return;
  const payload = { data: state.data, updatedAt: Date.now(), updatedBy: state.sync.clientId };
  try {
    await setDoc(roomRef, payload);
    state.sync.lastRemoteUpdatedAt = payload.updatedAt;
  } catch (err) {
    console.error("Kunne ikke synkronisere til Firebase.", err);
  }
}

async function initRemoteSync() {
  try {
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      const remote = snap.data();
      if (remote && remote.data) {
        state.sync.lastRemoteUpdatedAt = remote.updatedAt || 0;
        state.data = normalizeData(remote.data);
        state.sync.suppressRemoteWrite = true;
        saveData();
        state.sync.suppressRemoteWrite = false;
        renderAll();
      }
    } else {
      await setDoc(roomRef, { data: state.data, updatedAt: Date.now(), updatedBy: state.sync.clientId });
    }

    state.sync.ready = true;
    onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const remote = snapshot.data();
      if (!remote || !remote.data) return;
      const updatedAt = remote.updatedAt || 0;
      if (updatedAt <= state.sync.lastRemoteUpdatedAt) return;
      state.sync.lastRemoteUpdatedAt = updatedAt;
      if (remote.updatedBy === state.sync.clientId) return;

      state.sync.suppressRemoteWrite = true;
      state.data = normalizeData(remote.data);
      saveData();
      state.sync.suppressRemoteWrite = false;
      renderAll();
    });
  } catch (err) {
    console.error("Firebase synk deaktiveret.", err);
  }
}

function byDoneFirst(a, b) {
  return Number(a.done) - Number(b.done);
}

function resetForm(form) {
  form.reset();
  const selects = form.querySelectorAll("select");
  selects.forEach((select) => {
    const option = select.querySelector("option[selected]");
    if (option) select.value = option.value;
  });
}
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

const shoppingForm = document.getElementById("shoppingForm");
const bucketForm = document.getElementById("bucketForm");
const choresForm = document.getElementById("choresForm");
const choresFilter = document.getElementById("choresFilter");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");

choresFilter.addEventListener("change", () => {
  state.ui.choresFilter = choresFilter.value;
  renderChores();
});

shoppingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(shoppingForm);
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  state.data.shopping.push({
    id: uid(),
    label,
    quantity: String(formData.get("quantity") || "").trim(),
    kind: normalizeKind(formData.get("kind")),
    done: false
  });
  saveData();
  resetForm(shoppingForm);
  renderAll();
});

bucketForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(bucketForm);
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  state.data.bucket.push({ id: uid(), label, priority: normalizePriority(formData.get("priority")), done: false });
  saveData();
  resetForm(bucketForm);
  renderAll();
});

choresForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(choresForm);
  const label = String(formData.get("label") || "").trim();
  if (!label) return;
  state.data.chores.push({
    id: uid(),
    label,
    assignedTo: normalizePerson(formData.get("assignedTo")),
    weekday: normalizeWeekday(formData.get("weekday")),
    done: false
  });
  saveData();
  resetForm(choresForm);
  renderAll();
});

function renderAll() {
  renderShopping();
  renderBucket();
  renderChores();
}

function createListItem({ title, meta, done, onToggle, onEdit, onDelete }) {
  const template = document.getElementById("listItemTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".item-title").textContent = title;
  const metaEl = node.querySelector(".item-meta");
  meta.forEach((entry) => metaEl.appendChild(entry));
  const checkbox = node.querySelector("input[type=checkbox]");
  checkbox.checked = Boolean(done);
  checkbox.addEventListener("change", onToggle);
  node.querySelector(".edit").addEventListener("click", onEdit);
  node.querySelector(".delete").addEventListener("click", onDelete);
  return node;
}

function makeBadge(text, className) {
  const span = document.createElement("span");
  span.className = `badge ${className || ""}`.trim();
  span.textContent = text;
  return span;
}

function emptyItem(text) {
  const li = document.createElement("li");
  li.className = "list-item";
  li.textContent = text;
  return li;
}
function renderShopping() {
  renderShoppingList("basis", "shoppingListBasis", "Ingen basisvarer endnu.");
  renderShoppingList("other", "shoppingListOther", "Ingen andre ting endnu.");
}

function renderShoppingList(kind, listId, emptyText) {
  const list = document.getElementById(listId);
  list.innerHTML = "";
  const items = state.data.shopping.filter((item) => normalizeKind(item.kind) === kind).sort(byDoneFirst);
  if (items.length === 0) {
    list.appendChild(emptyItem(emptyText));
    return;
  }
  items.forEach((item) => {
    const meta = [];
    if (item.quantity) meta.push(makeBadge(item.quantity));
    const node = createListItem({
      title: item.label,
      meta,
      done: item.done,
      onToggle: () => toggleDone("shopping", item.id),
      onEdit: () => editShopping(item.id),
      onDelete: () => deleteItem("shopping", item.id)
    });
    list.appendChild(node);
  });
}

function renderBucket() {
  const list = document.getElementById("bucketList");
  list.innerHTML = "";
  const items = [...state.data.bucket].sort(byDoneFirst);
  if (items.length === 0) {
    list.appendChild(emptyItem("Ingen idéer endnu."));
    return;
  }
  items.forEach((item) => {
    const node = createListItem({
      title: item.label,
      meta: [makeBadge(priorityLabel(item.priority), `priority-${item.priority}`)],
      done: item.done,
      onToggle: () => toggleDone("bucket", item.id),
      onEdit: () => editBucket(item.id),
      onDelete: () => deleteItem("bucket", item.id)
    });
    list.appendChild(node);
  });
}

function renderChores() {
  weekdays.forEach((day) => {
    const list = document.getElementById(`chores-${day}`);
    list.innerHTML = "";
    const items = state.data.chores
      .filter((item) => normalizeWeekday(item.weekday) === day)
      .filter((item) => state.ui.choresFilter === "alle" || item.assignedTo === state.ui.choresFilter)
      .sort(byDoneFirst);

    if (items.length === 0) {
      list.appendChild(emptyItem("Ingen pligter."));
      return;
    }

    items.forEach((item) => {
      const node = createListItem({
        title: item.label,
        meta: [makeBadge(personLabel(item.assignedTo), "person")],
        done: item.done,
        onToggle: () => toggleDone("chores", item.id),
        onEdit: () => editChore(item.id),
        onDelete: () => deleteItem("chores", item.id)
      });
      list.appendChild(node);
    });
  });
}

function toggleDone(type, id) {
  const item = state.data[type].find((entry) => entry.id === id);
  if (!item) return;
  item.done = !item.done;
  saveData();
  renderAll();
}

function deleteItem(type, id) {
  state.data[type] = state.data[type].filter((entry) => entry.id !== id);
  saveData();
  renderAll();
}

function editShopping(id) {
  const item = state.data.shopping.find((entry) => entry.id === id);
  if (!item) return;
  const label = prompt("Vare", item.label) ?? item.label;
  const quantity = prompt("Mængde", item.quantity || "") ?? item.quantity;
  const kind = prompt("Liste (basis/other)", item.kind || "basis") ?? item.kind;
  item.label = String(label).trim() || item.label;
  item.quantity = String(quantity).trim();
  item.kind = normalizeKind(kind);
  saveData();
  renderAll();
}

function editBucket(id) {
  const item = state.data.bucket.find((entry) => entry.id === id);
  if (!item) return;
  const label = prompt("Idé", item.label) ?? item.label;
  const priority = prompt("Prioritet (low/medium/high)", item.priority) ?? item.priority;
  item.label = String(label).trim() || item.label;
  item.priority = normalizePriority(priority);
  saveData();
  renderAll();
}
function editChore(id) {
  const item = state.data.chores.find((entry) => entry.id === id);
  if (!item) return;
  const label = prompt("Opgave", item.label) ?? item.label;
  const assignedTo = prompt("Hvem? (arvid/ida/begge)", item.assignedTo) ?? item.assignedTo;
  const weekday = prompt("Ugedag (mon/tue/wed/thu/fri/sat/sun)", item.weekday || "mon") ?? item.weekday;
  item.label = String(label).trim() || item.label;
  item.assignedTo = normalizePerson(assignedTo);
  item.weekday = normalizeWeekday(weekday);
  saveData();
  renderAll();
}

function normalizePerson(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "arvid" || normalized === "ida" || normalized === "begge") return normalized;
  return "begge";
}

function normalizePriority(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  return "medium";
}

function normalizeKind(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "other" || normalized === "andre") return "other";
  return "basis";
}

function normalizeWeekday(value) {
  const normalized = String(value || "").toLowerCase();
  if (weekdays.includes(normalized)) return normalized;
  return "mon";
}

function weekdayFromDate(value) {
  if (!value) return "mon";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "mon";
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()] || "mon";
}

function personLabel(value) {
  if (value === "ida") return "Ida";
  if (value === "arvid") return "Arvid";
  return "Begge";
}

function priorityLabel(priority) {
  if (priority === "low") return "Lav";
  if (priority === "high") return "Høj";
  return "Medium";
}

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cute-synk-data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    state.data = normalizeData(parsed);
    saveData();
    renderAll();
    alert("Data importeret!");
  } catch {
    alert("Kunne ikke importere filen.");
  } finally {
    importInput.value = "";
  }
});

choresFilter.value = state.ui.choresFilter;
renderAll();
initRemoteSync();
