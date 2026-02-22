const storageKey = "cute-synk-app-data";

const defaultData = {
  calendar: [],
  shopping: [],
  bucket: [],
  chores: []
};

const state = {
  data: loadData(),
  ui: {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    selectedDate: todayString()
  }
};

function loadData() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    if (!isValidData(parsed)) return structuredClone(defaultData);
    return parsed;
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(state.data));
}

function isValidData(data) {
  return data &&
    Array.isArray(data.calendar) &&
    Array.isArray(data.shopping) &&
    Array.isArray(data.bucket) &&
    Array.isArray(data.chores);
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayString() {
  return formatLocalDate(new Date());
}

function byDateTime(a, b) {
  const aKey = `${a.date || ""} ${a.time || ""}`.trim();
  const bKey = `${b.date || ""} ${b.time || ""}`.trim();
  return aKey.localeCompare(bKey);
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

const calendarForm = document.getElementById("calendarForm");
const shoppingForm = document.getElementById("shoppingForm");
const bucketForm = document.getElementById("bucketForm");
const choresForm = document.getElementById("choresForm");
const calendarDayTitle = document.getElementById("calendarDayTitle");
const calendarGrid = document.getElementById("calendarGrid");
const calTitle = document.getElementById("calTitle");

calendarForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(calendarForm);
  const title = formData.get("title").trim();
  const date = formData.get("date");
  if (!title || !date) return;
  state.data.calendar.push({
    id: uid(),
    title,
    date,
    time: formData.get("time") || "",
    person: formData.get("person") || "begge",
    notes: formData.get("notes").trim()
  });
  saveData();
  resetForm(calendarForm);
  state.ui.selectedDate = date;
  const [y, m] = date.split("-").map(Number);
  if (!Number.isNaN(y) && !Number.isNaN(m)) {
    state.ui.year = y;
    state.ui.month = m - 1;
  }
  renderAll();
});

shoppingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(shoppingForm);
  const label = formData.get("label").trim();
  if (!label) return;
  state.data.shopping.push({
    id: uid(),
    label,
    quantity: formData.get("quantity").trim(),
    category: formData.get("category").trim(),
    done: false
  });
  saveData();
  resetForm(shoppingForm);
  renderAll();
});

bucketForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(bucketForm);
  const label = formData.get("label").trim();
  if (!label) return;
  state.data.bucket.push({
    id: uid(),
    label,
    priority: formData.get("priority") || "medium",
    done: false
  });
  saveData();
  resetForm(bucketForm);
  renderAll();
});

choresForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(choresForm);
  const label = formData.get("label").trim();
  if (!label) return;
  state.data.chores.push({
    id: uid(),
    label,
    assignedTo: formData.get("assignedTo") || "begge",
    dueDate: formData.get("dueDate"),
    done: false
  });
  saveData();
  resetForm(choresForm);
  renderAll();
});

function renderAll() {
  renderCalendar();
  renderShopping();
  renderBucket();
  renderChores();
}

function createListItem({ title, meta, done, onToggle, onEdit, onDelete }) {
  const template = document.getElementById("listItemTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  const checkbox = node.querySelector("input[type=checkbox]");
  const titleEl = node.querySelector(".item-title");
  const metaEl = node.querySelector(".item-meta");
  const editBtn = node.querySelector(".edit");
  const deleteBtn = node.querySelector(".delete");

  titleEl.textContent = title;
  meta.forEach((entry) => metaEl.appendChild(entry));
  checkbox.checked = Boolean(done);

  checkbox.addEventListener("change", onToggle);
  editBtn.addEventListener("click", onEdit);
  deleteBtn.addEventListener("click", onDelete);

  return node;
}

function makeBadge(text, className) {
  const span = document.createElement("span");
  span.className = `badge ${className || ""}`.trim();
  span.textContent = text;
  return span;
}

function renderCalendar() {
  renderCalendarGrid();
  renderCalendarDayList();
}

function renderShopping() {
  const list = document.getElementById("shoppingList");
  list.innerHTML = "";
  const items = [...state.data.shopping].sort(byDoneFirst);
  if (items.length === 0) {
    list.appendChild(emptyItem("Ingen varer endnu."));
    return;
  }
  items.forEach((item) => {
    const meta = [];
    if (item.quantity) meta.push(makeBadge(item.quantity));
    if (item.category) meta.push(makeBadge(item.category));
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
    const meta = [makeBadge(priorityLabel(item.priority), `priority-${item.priority}`)];
    const node = createListItem({
      title: item.label,
      meta,
      done: item.done,
      onToggle: () => toggleDone("bucket", item.id),
      onEdit: () => editBucket(item.id),
      onDelete: () => deleteItem("bucket", item.id)
    });
    list.appendChild(node);
  });
}

function renderChores() {
  const list = document.getElementById("choresList");
  list.innerHTML = "";
  const items = [...state.data.chores].sort(byDoneFirst);
  if (items.length === 0) {
    list.appendChild(emptyItem("Ingen pligter endnu."));
    return;
  }
  items.forEach((item) => {
    const meta = [makeBadge(item.assignedTo, "person")];
    if (item.dueDate) meta.push(makeBadge(item.dueDate, "due"));
    const node = createListItem({
      title: item.label,
      meta,
      done: item.done,
      onToggle: () => toggleDone("chores", item.id),
      onEdit: () => editChore(item.id),
      onDelete: () => deleteItem("chores", item.id)
    });
    list.appendChild(node);
  });
}

function emptyItem(text) {
  const li = document.createElement("li");
  li.className = "list-item";
  li.textContent = text;
  return li;
}

function renderCalendarGrid() {
  const { year, month } = state.ui;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const startWeekday = (monthStart.getDay() + 6) % 7; // monday=0
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const monthName = monthStart.toLocaleDateString("da-DK", { month: "long", year: "numeric" });
  calTitle.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  calendarGrid.innerHTML = "";

  for (let i = 0; i < totalCells; i += 1) {
    const dayNum = i - startWeekday + 1;
    const cellDate = new Date(year, month, dayNum);
    const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const iso = formatLocalDate(cellDate);
    const dayEvents = state.data.calendar.filter((item) => item.date === iso);

    const cell = document.createElement("div");
    cell.className = `cal-day ${isCurrentMonth ? "" : "muted"} ${iso === state.ui.selectedDate ? "selected" : ""}`.trim();
    cell.dataset.date = iso;

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = String(cellDate.getDate());

    const dots = document.createElement("div");
    dots.className = "dots";
    dayEvents.slice(0, 3).forEach((_, idx) => {
      const dot = document.createElement("span");
      dot.className = `dot ${idx % 2 === 0 ? "" : "alt"}`.trim();
      dots.appendChild(dot);
    });

    cell.appendChild(num);
    cell.appendChild(dots);
    cell.addEventListener("click", () => selectDate(iso));
    calendarGrid.appendChild(cell);
  }
}

function renderCalendarDayList() {
  const list = document.getElementById("calendarDayList");
  list.innerHTML = "";
  const selected = state.ui.selectedDate;
  calendarDayTitle.textContent = `Planer for ${selected}`;
  const items = state.data.calendar.filter((item) => item.date === selected).sort(byDateTime);
  if (items.length === 0) {
    list.appendChild(emptyItem("Ingen planer for denne dag."));
    return;
  }
  items.forEach((item) => {
    const meta = [];
    if (item.time) meta.push(makeBadge(item.time));
    meta.push(makeBadge(item.person, "person"));
    if (item.notes) meta.push(makeBadge(item.notes));
    const node = createListItem({
      title: item.title,
      meta,
      done: false,
      onToggle: () => {},
      onEdit: () => editCalendar(item.id),
      onDelete: () => deleteItem("calendar", item.id)
    });
    node.querySelector(".checkbox").style.visibility = "hidden";
    list.appendChild(node);
  });
}

function selectDate(iso) {
  state.ui.selectedDate = iso;
  const [y, m] = iso.split("-").map(Number);
  if (!Number.isNaN(y) && !Number.isNaN(m)) {
    state.ui.year = y;
    state.ui.month = m - 1;
  }
  const dateInput = calendarForm.querySelector("input[name=date]");
  dateInput.value = iso;
  renderCalendar();
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

function editCalendar(id) {
  const item = state.data.calendar.find((entry) => entry.id === id);
  if (!item) return;
  const title = prompt("Titel", item.title) ?? item.title;
  const date = prompt("Dato (YYYY-MM-DD)", item.date) ?? item.date;
  const time = prompt("Tid (HH:MM)", item.time || "") ?? item.time;
  const person = prompt("Hvem? (arvid/ida/begge)", item.person) ?? item.person;
  const notes = prompt("Noter", item.notes || "") ?? item.notes;
  item.title = title.trim() || item.title;
  item.date = date || item.date;
  item.time = time || "";
  item.person = normalizePerson(person);
  item.notes = notes.trim();
  saveData();
  renderAll();
}

function editShopping(id) {
  const item = state.data.shopping.find((entry) => entry.id === id);
  if (!item) return;
  const label = prompt("Vare", item.label) ?? item.label;
  const quantity = prompt("Mængde", item.quantity || "") ?? item.quantity;
  const category = prompt("Kategori", item.category || "") ?? item.category;
  item.label = label.trim() || item.label;
  item.quantity = quantity.trim();
  item.category = category.trim();
  saveData();
  renderAll();
}

function editBucket(id) {
  const item = state.data.bucket.find((entry) => entry.id === id);
  if (!item) return;
  const label = prompt("Idé", item.label) ?? item.label;
  const priority = prompt("Prioritet (low/medium/high)", item.priority) ?? item.priority;
  item.label = label.trim() || item.label;
  item.priority = normalizePriority(priority);
  saveData();
  renderAll();
}

function editChore(id) {
  const item = state.data.chores.find((entry) => entry.id === id);
  if (!item) return;
  const label = prompt("Opgave", item.label) ?? item.label;
  const assignedTo = prompt("Hvem? (arvid/ida/begge)", item.assignedTo) ?? item.assignedTo;
  const dueDate = prompt("Forfaldsdato (YYYY-MM-DD)", item.dueDate || "") ?? item.dueDate;
  item.label = label.trim() || item.label;
  item.assignedTo = normalizePerson(assignedTo);
  item.dueDate = dueDate || "";
  saveData();
  renderAll();
}

function normalizePerson(value) {
  const normalized = (value || "").toLowerCase();
  if (normalized === "arvid" || normalized === "ida" || normalized === "begge") {
    return normalized;
  }
  return "begge";
}

function normalizePriority(value) {
  const normalized = (value || "").toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "medium";
}

function priorityLabel(priority) {
  if (priority === "low") return "Lav";
  if (priority === "high") return "Høj";
  return "Medium";
}

const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const calPrev = document.getElementById("calPrev");
const calNext = document.getElementById("calNext");

calPrev.addEventListener("click", () => {
  state.ui.month -= 1;
  if (state.ui.month < 0) {
    state.ui.month = 11;
    state.ui.year -= 1;
  }
  renderCalendar();
});

calNext.addEventListener("click", () => {
  state.ui.month += 1;
  if (state.ui.month > 11) {
    state.ui.month = 0;
    state.ui.year += 1;
  }
  renderCalendar();
});

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
    if (!isValidData(parsed)) {
      alert("Dataformatet er forkert.");
      return;
    }
    state.data = parsed;
    saveData();
    renderAll();
    alert("Data importeret!");
  } catch {
    alert("Kunne ikke importere filen.");
  } finally {
    importInput.value = "";
  }
});

const dateInput = calendarForm.querySelector("input[name=date]");
dateInput.value = state.ui.selectedDate;

renderAll();
