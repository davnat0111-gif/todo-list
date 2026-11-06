const STORAGE_KEY = "todo-list.tasks";
const THEME_KEY = "todo-list.theme";
const TOAST_MS = 6000;

const form = document.getElementById("add-form");
const composerInput = document.getElementById("task-input");
const list = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty");
const footer = document.getElementById("footer");
const summary = document.getElementById("summary");
const ring = document.getElementById("ring");
const ringValue = document.getElementById("ring-value");
const ringLabel = document.getElementById("ring-label");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toast-text");
const filterButtons = document.querySelectorAll(".filters__item");

const EMPTY_TEXT = {
  all: "Чистый лист. С чего начнём?",
  active: "Активных задач нет",
  done: "Пока ничего не выполнено",
};

const FILTERS = {
  all: () => true,
  active: (task) => !task.done,
  done: (task) => task.done,
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let tasks = loadTasks();
let filter = "all";
let undoSnapshot = null;
let toastTimer = null;
let wasComplete = false;

/* Хранилище */

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter((task) => task && task.id && typeof task.text === "string");
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Хранилище недоступно (например, приватный режим): список работает до закрытия страницы.
  }
}

/* Склонение: 1 задача, 2 задачи, 5 задач */
function pluralTasks(count) {
  const tens = count % 100;
  const ones = count % 10;
  if (tens >= 11 && tens <= 14) return `${count} задач`;
  if (ones === 1) return `${count} задача`;
  if (ones >= 2 && ones <= 4) return `${count} задачи`;
  return `${count} задач`;
}

/* Анимация появления и удаления строки */
function animateRow(row, direction) {
  if (reduceMotion.matches) return null;

  const height = `${row.offsetHeight}px`;
  const shown = { height, opacity: 1, transform: "none" };
  const hidden = { height: "0px", opacity: 0, transform: "translateY(-6px)" };
  return row.animate(direction === "in" ? [hidden, shown] : [shown, hidden], {
    duration: 280,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  });
}

function removeRow(row) {
  row.dataset.leaving = "true";
  const animation = animateRow(row, "out");
  if (animation) {
    animation.onfinish = () => row.remove();
  } else {
    row.remove();
  }
}

function createRow(task) {
  const row = document.createElement("li");
  row.className = "task";
  row.dataset.id = task.id;

  const label = document.createElement("label");
  label.className = "task__label";

  const checkbox = document.createElement("input");
  checkbox.className = "task__checkbox";
  checkbox.type = "checkbox";

  const box = document.createElement("span");
  box.className = "task__box";
  box.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.6"/></svg>';

  const text = document.createElement("span");
  text.className = "task__text";
  text.textContent = task.text; // textContent, чтобы HTML из ввода не выполнялся

  const deleteButton = document.createElement("button");
  deleteButton.className = "task__delete";
  deleteButton.type = "button";
  deleteButton.title = "Удалить";
  deleteButton.setAttribute("aria-label", `Удалить задачу: ${task.text}`);
  deleteButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

  label.append(checkbox, box, text);
  row.append(label, deleteButton);
  return row;
}

/* Отрисовка: меняем только то, что изменилось, чтобы работали анимации */
function renderList(animate) {
  const visible = tasks.filter(FILTERS[filter]);
  const visibleIds = new Set(visible.map((task) => task.id));
  const rows = new Map();

  for (const row of [...list.children]) {
    if (row.dataset.leaving) continue;
    if (visibleIds.has(row.dataset.id)) {
      rows.set(row.dataset.id, row);
    } else if (animate) {
      removeRow(row);
    } else {
      row.remove();
    }
  }

  let cursor = list.firstElementChild;
  for (const task of visible) {
    while (cursor && cursor.dataset.leaving) cursor = cursor.nextElementSibling;

    const isNew = !rows.has(task.id);
    const row = isNew ? createRow(task) : rows.get(task.id);

    row.classList.toggle("task--done", task.done);
    row.querySelector(".task__checkbox").checked = task.done;

    if (row === cursor) {
      cursor = cursor.nextElementSibling;
    } else {
      list.insertBefore(row, cursor);
    }

    if (isNew && animate) animateRow(row, "in");
  }
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  const left = total - done;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && left === 0;

  if (!total) summary.textContent = "Задач пока нет";
  else if (complete) summary.textContent = "Всё сделано. Отличная работа!";
  else if (left === 1) summary.textContent = "Осталась 1 задача";
  else summary.textContent = `Осталось ${pluralTasks(left)}`;

  ringValue.style.strokeDashoffset = 100 - percent;
  ringValue.style.opacity = percent ? 1 : 0;
  ringLabel.textContent = `${percent}%`;
  ring.setAttribute("aria-label", `Выполнено ${percent}%`);

  if (complete && !wasComplete) {
    ring.classList.remove("ring--complete");
    void ring.offsetWidth; // перезапуск анимации
    ring.classList.add("ring--complete");
  }
  wasComplete = complete;

  document.getElementById("count-all").textContent = total;
  document.getElementById("count-active").textContent = left;
  document.getElementById("count-done").textContent = done;

  const hasVisible = tasks.some(FILTERS[filter]);
  emptyMessage.hidden = hasVisible;
  emptyMessage.textContent = EMPTY_TEXT[filter];
  footer.hidden = done === 0;
}

function render(animate = true) {
  renderList(animate);
  renderStats();
}

function update(nextTasks) {
  tasks = nextTasks;
  saveTasks();
  render();
}

/* Отмена удаления */

function showUndo(message, snapshot) {
  undoSnapshot = snapshot;
  toastText.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideUndo, TOAST_MS);
}

function hideUndo() {
  clearTimeout(toastTimer);
  toast.hidden = true;
  undoSnapshot = null;
}

document.getElementById("toast-undo").addEventListener("click", () => {
  const snapshot = undoSnapshot;
  hideUndo();
  if (snapshot) update(snapshot);
  composerInput.focus();
});

/* Действия */

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = composerInput.value.trim();
  composerInput.value = "";
  composerInput.focus();

  if (!text) {
    form.classList.remove("composer--shake");
    void form.offsetWidth; // перезапуск анимации
    form.classList.add("composer--shake");
    return;
  }

  hideUndo();
  // Новую задачу должно быть видно, даже если открыт фильтр «Готовые».
  if (filter === "done") setFilter("all");

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  update([{ id, text, done: false }, ...tasks]);
});

list.addEventListener("change", (event) => {
  if (!event.target.matches(".task__checkbox")) return;

  hideUndo();
  const { id } = event.target.closest(".task").dataset;
  update(tasks.map((task) => (task.id === id ? { ...task, done: event.target.checked } : task)));
});

list.addEventListener("click", (event) => {
  const button = event.target.closest(".task__delete");
  if (!button) return;

  const { id } = button.closest(".task").dataset;
  const snapshot = tasks;
  update(tasks.filter((task) => task.id !== id));
  showUndo("Задача удалена", snapshot);
  composerInput.focus();
});

document.getElementById("clear-done").addEventListener("click", () => {
  const snapshot = tasks;
  const removed = tasks.filter((task) => task.done).length;
  update(tasks.filter((task) => !task.done));
  showUndo(removed === 1 ? "Задача удалена" : `Удалено: ${pluralTasks(removed)}`, snapshot);
  composerInput.focus();
});

/* Фильтры */

function setFilter(next) {
  filter = next;
  filterButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === next));
  });
  render();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

/* Тема */

document.getElementById("theme-toggle").addEventListener("click", () => {
  const current =
    document.documentElement.dataset.theme ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";

  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Без хранилища тема просто действует до закрытия страницы.
  }
});

/* Дата */

const today = new Date();
document.getElementById("weekday").textContent = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(today);
document.getElementById("date").textContent = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(today);

wasComplete = tasks.length > 0 && tasks.every((task) => task.done);
render(false);
