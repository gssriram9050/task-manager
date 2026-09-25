const STORAGE_KEYS = {
  token: "taskflow_token",
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

let tasks = [];
let currentFilter = "all";
let editingTaskId = null;
let authMode = "login";
let toastTimer;

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

async function apiFetch(endpoint, method = "GET", body = null) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(endpoint, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || "API Request Failed");
    }
    return data;
  } catch (err) {
    console.error("API Error:", err.message);
    throw err;
  }
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
    const titleMatch = task.title ? task.title.toLowerCase().includes(searchTerm) : false;
    const isCompleted = Boolean(task.completed);
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "completed" && isCompleted) ||
      (currentFilter === "pending" && !isCompleted);

    return titleMatch && matchesFilter;
  });
}

function renderStats() {
  const completed = tasks.filter((task) => Boolean(task.completed)).length;
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
    const isCompleted = Boolean(task.completed);
    const taskCard = document.createElement("article");
    taskCard.className = `task-card ${isCompleted ? "completed" : ""}`;
    taskCard.innerHTML = `
      <input class="complete-check" type="checkbox" ${isCompleted ? "checked" : ""} aria-label="Mark task completed">
      <div>
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        <div class="task-meta">
          <span class="badge priority-${(task.priority || "Medium").toLowerCase()}">${task.priority || "Medium"}</span>
          <span class="badge due-badge">${formatDate(task.due_date || task.dueDate)}</span>
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
  div.textContent = text || "";
  return div.innerHTML;
}

function resetTaskForm() {
  editingTaskId = null;
  elements.taskForm.reset();
  elements.taskPriority.value = "Medium";
  elements.submitTask.textContent = "Add Task";
}

async function fetchTasksFromBackend() {
  try {
    const data = await apiFetch("/api/tasks");
    tasks = Array.isArray(data) ? data : (data.tasks || []);
    renderTasks();
  } catch (err) {
    showToast(err.message || "Failed to load tasks from server.");
  }
}

async function addOrUpdateTask(event) {
  event.preventDefault();

  const title = elements.taskTitle.value.trim();
  const priority = elements.taskPriority.value;
  const dueDate = elements.taskDueDate.value;

  if (!title) {
    showToast("Please enter a task title.");
    return;
  }

  elements.submitTask.disabled = true;

  try {
    if (editingTaskId) {
      const updated = await apiFetch(`/api/tasks/${editingTaskId}`, "PUT", {
        title,
        priority,
        dueDate
      });
      tasks = tasks.map((t) => (t.id === editingTaskId ? updated : t));
      showToast("Task updated successfully.");
    } else {
      const created = await apiFetch("/api/tasks", "POST", {
        title,
        priority,
        dueDate,
        completed: false
      });
      tasks.unshift(created);
      showToast("Task added successfully.");
    }
    resetTaskForm();
    await fetchTasksFromBackend();
  } catch (err) {
    showToast(err.message || "Operation failed.");
  } finally {
    elements.submitTask.disabled = false;
  }
}

function startEditing(taskId) {
  const task = tasks.find((item) => String(item.id) === String(taskId));
  if (!task) return;

  editingTaskId = task.id;
  elements.taskTitle.value = task.title;
  elements.taskPriority.value = task.priority || "Medium";
  elements.taskDueDate.value = task.due_date || task.dueDate || "";
  elements.submitTask.textContent = "Update Task";
  elements.taskTitle.focus();
}

async function deleteTask(taskId) {
  try {
    await apiFetch(`/api/tasks/${taskId}`, "DELETE");
    tasks = tasks.filter((task) => String(task.id) !== String(taskId));
    renderTasks();
    showToast("Task deleted.");
  } catch (err) {
    showToast(err.message || "Failed to delete task.");
  }
}

async function toggleComplete(taskId) {
  const task = tasks.find((t) => String(t.id) === String(taskId));
  if (!task) return;

  const nextCompleted = !Boolean(task.completed);
  try {
    const updated = await apiFetch(`/api/tasks/${taskId}/toggle`, "PATCH", {
      completed: nextCompleted
    });
    tasks = tasks.map((t) => (String(t.id) === String(taskId) ? updated : t));
    renderTasks();
  } catch (err) {
    showToast(err.message || "Failed to update task.");
  }
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
  if (user && user.name && user.name.trim()) {
    return user.name.trim();
  }
  if (user && user.email) {
    return user.email.split("@")[0];
  }
  return "User";
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

async function handleAuth(event) {
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

  elements.authSubmit.disabled = true;

  try {
    const endpoint = authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
    const body = authMode === "signup" ? { name, email, password } : { email, password };
    const data = await apiFetch(endpoint, "POST", body);

    localStorage.setItem(STORAGE_KEYS.token, data.token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));

    elements.authOverlay.classList.add("hidden");
    updateUserInterface();
    showToast(authMode === "signup" ? "Account created. Welcome!" : "Login successful.");
    await fetchTasksFromBackend();
  } catch (err) {
    showToast(err.message || "Authentication failed.");
  } finally {
    elements.authSubmit.disabled = false;
  }
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  tasks = [];
  elements.authOverlay.classList.remove("hidden");
  setAuthMode("login");
  updateUserInterface();
  renderTasks();
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

async function initializeApp() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
  const savedToken = getToken();

  applyTheme(savedTheme);
  setAuthMode("login");
  elements.todayLabel.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

  if (savedToken) {
    try {
      const data = await apiFetch("/api/auth/me");
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
      elements.authOverlay.classList.add("hidden");
      updateUserInterface();
      await fetchTasksFromBackend();
    } catch (err) {
      logout();
    }
  } else {
    elements.authOverlay.classList.remove("hidden");
    updateUserInterface();
  }

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
