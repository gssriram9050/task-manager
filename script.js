// TaskFlow uses only browser storage so it works perfectly on GitHub Pages.
const STORAGE_KEYS = {
  tasks: "taskflow_tasks",
  user: "taskflow_user",
  theme: "taskflow_theme"
};

const elements = {
  authOverlay: document.getElementById("authOverlay"),
  authForm: document.getElementById("authForm"),
  authTitle: document.getElementById("authTitle"),
  authSubmit: document.getElementById("authSubmit"),
  loginTab: document.getElementById("loginTab"),
  signupTab: document.getElementById("signupTab"),
  nameField: document.getElementById("nameField"),
  authName: document.getElementById("authName"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  logoutButton: document.getElementById("logoutButton"),
  themeToggle: document.getElementById("themeToggle"),
  themeIcon: document.getElementById("themeIcon"),
  menuToggle: document.getElementById("menuToggle"),
  sidebar: document.getElementById("sidebar"),
  greetingTitle: document.getElementById("greetingTitle"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileName: document.getElementById("profileName"),
  profileEmail: document.getElementById("profileEmail"),
  taskForm: document.getElementById("taskForm"),
  taskTitle: document.getElementById("taskTitle"),
  taskPriority: document.getElementById("taskPriority"),
  taskDueDate: document.getElementById("taskDueDate"),
  submitTask: document.getElementById("submitTask"),
  taskList: document.getElementById("taskList"),
  searchInput: document.getElementById("searchInput"),
  filterButtons: document.querySelectorAll(".filter-button"),
  totalCount: document.getElementById("totalCount"),
  completedCount: document.getElementById("completedCount"),
  pendingCount: document.getElementById("pendingCount"),
  highCount: document.getElementById("highCount"),
  todayLabel: document.getElementById("todayLabel"),
  toast: document.getElementById("toast")
};

let tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks)) || [];
let currentFilter = "all";
let editingTaskId = null;
let authMode = "login";
let toastTimer;

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function formatDate(dateValue) {
  if (!dateValue) return "No due date";

  return new Date(dateValue + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getVisibleTasks() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();

  return tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm);
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "completed" && task.completed) ||
      (currentFilter === "pending" && !task.completed);

    return matchesSearch && matchesFilter;
  });
}

function renderStats() {
  const completed = tasks.filter((task) => task.completed).length;
  const highPriority = tasks.filter((task) => task.priority === "High").length;

  elements.totalCount.textContent = tasks.length;
  elements.completedCount.textContent = completed;
  elements.pendingCount.textContent = tasks.length - completed;
  elements.highCount.textContent = highPriority;
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  elements.taskList.innerHTML = "";

  if (visibleTasks.length === 0) {
    elements.taskList.innerHTML = `
      <div class="empty-state">
        <div>
          <h3>No tasks found</h3>
          <p>Add a new task or adjust your filters to see your daily workflow here.</p>
        </div>
      </div>
    `;
    renderStats();
    return;
  }

  visibleTasks.forEach((task) => {
    const taskCard = document.createElement("article");
    taskCard.className = `task-card ${task.completed ? "completed" : ""}`;
    taskCard.innerHTML = `
      <input class="complete-check" type="checkbox" ${task.completed ? "checked" : ""} aria-label="Mark task completed">
      <div>
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        <div class="task-meta">
          <span class="badge priority-${task.priority.toLowerCase()}">${task.priority}</span>
          <span class="badge due-badge">${formatDate(task.dueDate)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action edit-action" type="button" aria-label="Edit task">✎</button>
        <button class="task-action delete-action" type="button" aria-label="Delete task">×</button>
      </div>
    `;

    taskCard.querySelector(".complete-check").addEventListener("change", () => toggleComplete(task.id));
    taskCard.querySelector(".edit-action").addEventListener("click", () => startEditing(task.id));
    taskCard.querySelector(".delete-action").addEventListener("click", () => deleteTask(task.id));
    elements.taskList.appendChild(taskCard);
  });

  renderStats();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function resetTaskForm() {
  editingTaskId = null;
  elements.taskForm.reset();
  elements.taskPriority.value = "Medium";
  elements.submitTask.textContent = "Add Task";
}

function createTaskId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function addOrUpdateTask(event) {
  event.preventDefault();

  const title = elements.taskTitle.value.trim();
  if (!title) {
    showToast("Please enter a task title.");
    return;
  }

  if (editingTaskId) {
    tasks = tasks.map((task) =>
      task.id === editingTaskId
        ? {
            ...task,
            title,
            priority: elements.taskPriority.value,
            dueDate: elements.taskDueDate.value
          }
        : task
    );
    showToast("Task updated successfully.");
  } else {
    tasks.unshift({
      id: createTaskId(),
      title,
      priority: elements.taskPriority.value,
      dueDate: elements.taskDueDate.value,
      completed: false,
      createdAt: new Date().toISOString()
    });
    showToast("Task added successfully.");
  }

  saveTasks();
  resetTaskForm();
  renderTasks();
}

function startEditing(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  editingTaskId = task.id;
  elements.taskTitle.value = task.title;
  elements.taskPriority.value = task.priority;
  elements.taskDueDate.value = task.dueDate;
  elements.submitTask.textContent = "Update Task";
  elements.taskTitle.focus();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderTasks();
  showToast("Task deleted.");
}

function toggleComplete(taskId) {
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );
  saveTasks();
  renderTasks();
}

function setFilter(filter) {
  currentFilter = filter;
  elements.filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
  renderTasks();
}

function applyTheme(theme) {
  document.body.classList.toggle("light-theme", theme === "light");
  elements.themeIcon.textContent = theme === "light" ? "☀" : "☾";
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains("light-theme") ? "dark" : "light";
  applyTheme(nextTheme);
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";

  elements.loginTab.classList.toggle("active", !isSignup);
  elements.signupTab.classList.toggle("active", isSignup);
  elements.nameField.style.display = isSignup ? "block" : "none";
  elements.authTitle.textContent = isSignup ? "Create Account" : "TaskFlow";
  elements.authSubmit.textContent = isSignup ? "Signup" : "Login";
  elements.authPassword.autocomplete = isSignup ? "new-password" : "current-password";
}

function getDisplayName(user) {
  if (user.name && user.name.trim()) {
    return user.name.trim();
  }

  return user.email.split("@")[0];
}

function updateUserInterface() {
  const savedUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null");

  if (!savedUser) {
    elements.greetingTitle.textContent = "Stay productive 🚀";
    elements.profileAvatar.textContent = "U";
    elements.profileName.textContent = "TaskFlow User";
    elements.profileEmail.textContent = "user@example.com";
    return;
  }

  const displayName = getDisplayName(savedUser);
  elements.greetingTitle.textContent = `Stay productive, ${displayName} 🚀`;
  elements.profileAvatar.textContent = displayName.charAt(0).toUpperCase();
  elements.profileName.textContent = displayName;
  elements.profileEmail.textContent = savedUser.email;
}

function handleAuth(event) {
  event.preventDefault();

  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value.trim();
  const name = elements.authName.value.trim();

  if (!email.includes("@") || !email.includes(".")) {
    showToast("Please enter a valid email address.");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.");
    return;
  }

  if (authMode === "signup" && name.length < 3) {
    showToast("Please enter your full name.");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ name, email }));
  elements.authOverlay.classList.add("hidden");
  updateUserInterface();
  showToast(authMode === "signup" ? "Signup complete. Welcome!" : "Login successful.");
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.user);
  elements.authOverlay.classList.remove("hidden");
  setAuthMode("login");
  updateUserInterface();
  showToast("Logged out successfully.");
}

function initializeScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));
}

function initializeApp() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
  const savedUser = localStorage.getItem(STORAGE_KEYS.user);

  applyTheme(savedTheme);
  setAuthMode("login");
  elements.authOverlay.classList.toggle("hidden", Boolean(savedUser));
  updateUserInterface();
  elements.todayLabel.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

  renderTasks();
  initializeScrollAnimations();
}

elements.taskForm.addEventListener("submit", addOrUpdateTask);
elements.searchInput.addEventListener("input", renderTasks);
elements.themeToggle.addEventListener("click", toggleTheme);
elements.logoutButton.addEventListener("click", logout);
elements.authForm.addEventListener("submit", handleAuth);
elements.loginTab.addEventListener("click", () => setAuthMode("login"));
elements.signupTab.addEventListener("click", () => setAuthMode("signup"));
elements.menuToggle.addEventListener("click", () => elements.sidebar.classList.toggle("open"));

elements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

document.addEventListener("click", (event) => {
  const clickedInsideSidebar = elements.sidebar.contains(event.target);
  const clickedMenu = elements.menuToggle.contains(event.target);

  if (!clickedInsideSidebar && !clickedMenu) {
    elements.sidebar.classList.remove("open");
  }
});

initializeApp();
