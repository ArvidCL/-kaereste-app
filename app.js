const storageKey = "ida-arvid-home-hub-v2";

const defaultState = {
  shopping: [
    { id: "s1", name: "Mælk", category: "basis", done: false },
    { id: "s2", name: "Rugbrød", category: "basis", done: false },
    { id: "s3", name: "Toiletpapir", category: "basis", done: false },
    { id: "s4", name: "Pasta", category: "other", done: false }
  ],
  chores: [
    { id: "c1", name: "Støvsuge", day: "mon", assignee: "Begge", done: false },
    { id: "c2", name: "Vaske tøj", day: "thu", assignee: "Arvid", done: false },
    { id: "c3", name: "Tømme opvasker", day: "sun", assignee: "Ida", done: false }
  ]
};

const dayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const state = loadState();

const shoppingForm = document.getElementById("shoppingForm");
const choreForm = document.getElementById("choreForm");
const basisList = document.getElementById("basisList");
const otherList = document.getElementById("otherList");
const clearBought = document.getElementById("clearBought");
const resetWeek = document.getElementById("resetWeek");

const basisCount = document.getElementById("basisCount");
const otherCount = document.getElementById("otherCount");
const choreCount = document.getElementById("choreCount");
const doneCount = document.getElementById("doneCount");

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.shopping) || !Array.isArray(parsed.chores)) {
      return structuredClone(defaultState);
    }
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function renderShoppingList(listNode, category) {
  listNode.innerHTML = "";
  const items = state.shopping
    .filter((item) => item.category === category)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name, "da"));

  if (items.length === 0) {
    listNode.innerHTML = '<li class="empty">Ingen varer endnu.</li>';
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = `todo-item${item.done ? " done" : ""}`;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = item.done;
    check.addEventListener("change", () => {
      item.done = check.checked;
      saveState();
      renderAll();
    });

    const label = document.createElement("span");
    label.textContent = item.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn";
    remove.textContent = "Fjern";
    remove.addEventListener("click", () => {
      state.shopping = state.shopping.filter((entry) => entry.id !== item.id);
      saveState();
      renderAll();
    });

    li.append(check, label, remove);
    listNode.appendChild(li);
  });
}

function choreListFor(day) {
  return document.getElementById(`chores-${day}`);
}

function renderChoresDay(day) {
  const listNode = choreListFor(day);
  listNode.innerHTML = "";

  const chores = state.chores
    .filter((chore) => chore.day === day)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name, "da"));

  if (chores.length === 0) {
    listNode.innerHTML = '<li class="empty">Ingen pligter.</li>';
    return;
  }

  chores.forEach((chore) => {
    const li = document.createElement("li");
    li.className = `todo-item${chore.done ? " done" : ""}`;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = chore.done;
    check.addEventListener("change", () => {
      chore.done = check.checked;
      saveState();
      renderAll();
    });

    const label = document.createElement("span");
    label.textContent = `${chore.name} (${chore.assignee})`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn";
    remove.textContent = "Fjern";
    remove.addEventListener("click", () => {
      state.chores = state.chores.filter((entry) => entry.id !== chore.id);
      saveState();
      renderAll();
    });

    li.append(check, label, remove);
    listNode.appendChild(li);
  });
}

function renderStats() {
  const basisActive = state.shopping.filter((item) => item.category === "basis" && !item.done).length;
  const otherActive = state.shopping.filter((item) => item.category === "other" && !item.done).length;
  const choresActive = state.chores.filter((chore) => !chore.done).length;
  const doneTotal = state.shopping.filter((item) => item.done).length + state.chores.filter((chore) => chore.done).length;

  basisCount.textContent = `${basisActive} aktive`;
  otherCount.textContent = `${otherActive} aktive`;
  choreCount.textContent = `${choresActive} aktive`;
  doneCount.textContent = `${doneTotal} total`;
}

function renderAll() {
  renderShoppingList(basisList, "basis");
  renderShoppingList(otherList, "other");
  dayOrder.forEach(renderChoresDay);
  renderStats();
}

shoppingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(shoppingForm);
  const name = String(data.get("itemName") || "").trim();
  const category = String(data.get("category") || "basis");
  if (!name) return;

  state.shopping.push({
    id: uid(),
    name,
    category: category === "other" ? "other" : "basis",
    done: false
  });

  saveState();
  shoppingForm.reset();
  renderAll();
});

choreForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(choreForm);
  const name = String(data.get("choreName") || "").trim();
  const day = String(data.get("weekday") || "mon");
  const assignee = String(data.get("assignee") || "Begge");
  if (!name) return;

  state.chores.push({
    id: uid(),
    name,
    day: dayOrder.includes(day) ? day : "mon",
    assignee,
    done: false
  });

  saveState();
  choreForm.reset();
  renderAll();
});

clearBought.addEventListener("click", () => {
  state.shopping = state.shopping.filter((item) => !item.done);
  saveState();
  renderAll();
});

resetWeek.addEventListener("click", () => {
  state.chores = state.chores.map((chore) => ({ ...chore, done: false }));
  saveState();
  renderAll();
});

renderAll();
