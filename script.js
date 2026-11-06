const STORAGE_KEY = "todo-list.tasks";

const form = document.getElementById("add-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const counter = document.getElementById("counter");
const empty = document.getElementById("empty");

let tasks = loadTasks();

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
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

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = task.done ? "task task--done" : "task";
  item.dataset.id = task.id;

  const label = document.createElement("label");
  label.className = "task__label";

  const checkbox = document.createElement("input");
  checkbox.className = "task__checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = task.done;

  const text = document.createElement("span");
  text.className = "task__text";
  text.textContent = task.text; // textContent, чтобы HTML из ввода не выполнялся

  const deleteButton = document.createElement("button");
  deleteButton.className = "task__delete";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.title = "Удалить";
  deleteButton.setAttribute("aria-label", `Удалить задачу: ${task.text}`);

  label.append(checkbox, text);
  item.append(label, deleteButton);
  return item;
}

function render() {
  list.replaceChildren(...tasks.map(createTaskElement));

  const doneCount = tasks.filter((task) => task.done).length;
  counter.textContent = tasks.length ? `Выполнено ${doneCount} из ${tasks.length}` : "";
  empty.hidden = tasks.length > 0;
}

function update(nextTasks) {
  tasks = nextTasks;
  saveTasks();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) {
    input.value = "";
    input.focus();
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  update([...tasks, { id, text, done: false }]);
  input.value = "";
  input.focus();
});

list.addEventListener("change", (event) => {
  if (!event.target.matches(".task__checkbox")) return;

  const { id } = event.target.closest(".task").dataset;
  update(tasks.map((task) => (task.id === id ? { ...task, done: event.target.checked } : task)));
});

list.addEventListener("click", (event) => {
  if (!event.target.matches(".task__delete")) return;

  const { id } = event.target.closest(".task").dataset;
  update(tasks.filter((task) => task.id !== id));
  input.focus();
});

render();
