# TaskFlow - Full-Stack Task Management Application

## Overview
TaskFlow is a modern, full-stack, database-driven task management application designed to organize daily workflows, track task completion, set priorities, and maintain productivity with ease. Built with a 3-tier web architecture (**Frontend HTML/CSS/JS → Node.js/Express REST API → PostgreSQL/SQLite Database**), TaskFlow provides persistent multi-user task management and user authentication.

## Thiranex Internship Context
This project was developed and deployed as part of the **Full Stack Development Internship** at **Thiranex Education LLP**. It demonstrates practical competency in building end-to-end full-stack software applications, server-side REST API development, database schema management with relational engines, and production deployment on **Cloudflare Workers**.

---

## Core Features
- **User Authentication & Authorization**: Secure signup, login, and user session management.
- **Task CRUD Operations**: Create, view, edit, toggle completion, and delete tasks.
- **Priority & Due Date Tracking**: Assign High, Medium, or Low priority tags and due dates to tasks.
- **Search & Filtering**: Instant client-side search by title and filter by All, Pending, or Completed tasks.
- **Persistent Data Storage**: All users, credentials, and task records are persisted in a relational SQL database (**PostgreSQL** in production / **SQLite** for local development).
- **Responsive Dark/Light UI**: Glassmorphic dashboard interface optimized for mobile, tablet, and desktop viewports.
- **Cloudflare Worker Deployment**: Serverless backend execution with global edge asset hosting.

---

## Architecture & Tech Stack

```text
[ Client / Web UI ] <--- HTTP REST API ---> [ Express.js Backend ] <---> [ Relational Database ]
 (HTML, CSS, JS)                             (Node.js / Worker)         (PostgreSQL / SQLite)
```

- **Frontend**: HTML5, CSS3 (Custom Glassmorphism design system), Vanilla JavaScript (ES6+ async/await API client).
- **Backend / API**: Node.js, Express.js REST API with V8 Cloudflare Worker fetch adapter (`worker.js`).
- **Database**: PostgreSQL (Cloud / Production) with lazy connection pooling, fallback to SQLite (`taskmanager.db`) for local Node.js runs.
- **Deployment & Hosting**: Cloudflare Workers (`task-manager`), GitHub Pages (Redirect entry point).

---

## API Documentation

The backend exposes the following RESTful endpoints:

### Health Check
- `GET /api/health` - System status and timestamp.

### Authentication Endpoints
- `POST /api/auth/register` - Creates a new user account (`{ name, email, password }`).
- `POST /api/auth/login` - Authenticates user credentials (`{ email, password }`).
- `GET /api/auth/me` - Retrieves current authenticated user profile (`Header: Authorization: Bearer <token>`).

### Task Management Endpoints (Requires `Authorization: Bearer <token>`)
- `GET /api/tasks` - Fetches all tasks for the logged-in user.
- `POST /api/tasks` - Creates a new task (`{ title, priority, dueDate, completed }`).
- `PUT /api/tasks/:id` - Updates task details (`{ title, priority, dueDate }`).
- `PATCH /api/tasks/:id/toggle` - Toggles task completion status (`{ completed }`).
- `DELETE /api/tasks/:id` - Deletes a task by ID.

---

## Project Structure

```text
.
├── public/
│   ├── index.html        # TaskFlow application user interface
│   ├── script.js         # Frontend JavaScript & REST API client handlers
│   └── style.css         # Glassmorphic responsive styling & theme variables
├── server.js             # Express.js application & REST API routes
├── db.js                 # PostgreSQL / SQLite connection pool & table migration
├── worker.js             # Cloudflare Worker fetch adapter
├── wrangler.json         # Cloudflare Worker configuration manifest
├── package.json          # Node.js dependencies & scripts
├── index.html            # GitHub Pages redirect entry point
├── .env.example          # Environment variable template
├── .gitignore            # Git exclusion rules
└── README.md             # Project documentation
```

---

## Local Setup & Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gssriram9050/task-manager.git
   cd task-manager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run locally:**
   ```bash
   npm start
   ```
   The backend will automatically initialize the local `taskmanager.db` SQLite database, seed demo data, and listen at `http://localhost:5000`.

4. **Production Deployment (Cloudflare Workers):**
   ```bash
   npx wrangler deploy
   ```

---

## Live Links & Repositories

- **Live Application (Cloudflare Worker):** [https://task-manager.gssriram.workers.dev/](https://task-manager.gssriram.workers.dev/)
- **GitHub Pages:** [https://gssriram9050.github.io/task-manager/](https://gssriram9050.github.io/task-manager/)
- **GitHub Repository:** [https://github.com/gssriram9050/task-manager](https://github.com/gssriram9050/task-manager)

---

## Internship Attribution
This project was developed as part of the **Full Stack Development Internship** at **Thiranex Education LLP**.
