# TaskFlow - Task Management Application

TaskFlow is a modern, responsive task management web application built with only HTML, CSS, and Vanilla JavaScript. It helps users add, edit, complete, delete, search, and filter daily tasks directly in the browser.

This project is fully static and ready for GitHub Pages deployment.

## Live Demo

After deploying with GitHub Pages, add your live link here:

```text
https://gssriram9050.github.io/task-manager/
```

## Project Preview

TaskFlow includes a clean dashboard-style interface with a dark/light theme, task statistics, localStorage persistence, smooth animations, and a responsive layout for mobile and desktop screens.

## Features

- Frontend-only login and signup modal with JavaScript validation
- Dashboard layout after login
- Add new tasks
- Edit existing tasks
- Delete tasks
- Mark tasks as completed
- Set task priority: High, Medium, or Low
- Add optional due dates
- Filter tasks by All, Completed, and Pending
- Search tasks in real time
- Task counters and statistics
- Empty state when no tasks are available
- Dark and light mode toggle
- Theme preference saved in localStorage
- Tasks saved in localStorage
- Toast notification system
- Keyboard Enter support for adding tasks
- Responsive sidebar/navigation
- Smooth transitions, hover effects, and scroll animations

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- localStorage

No React, Node.js, npm, backend, API, database, Firebase, framework, or external hosting is required.

## Folder Structure

```text
taskflow-task-management/
├── index.html
├── style.css
├── script.js
└── README.md
```

## How To Run Locally

Open `index.html` directly in your browser.

No installation is needed.

## GitHub Pages Deployment

1. Create a new GitHub repository.
2. Upload these files:
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
3. Go to the repository `Settings`.
4. Open the `Pages` section.
5. Under `Build and deployment`, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. Save the settings.
7. Wait a few moments for GitHub to publish the site.

Your project will be available at:

```text
https://your-username.github.io/your-repository-name/
```

## Project Description

TaskFlow is a simple frontend-only task manager designed for beginners and project showcases. It demonstrates practical DOM manipulation, event handling, form validation, responsive design, localStorage persistence, filtering, searching, and theme management using only core web technologies.

## Interview Explanation

This project can be explained as a static task management dashboard where all user interactions happen in the browser. Tasks and preferences are stored using localStorage, so the data remains available after refreshing the page without needing a backend.

Key concepts demonstrated:

- DOM selection and manipulation
- JavaScript event listeners
- Form validation
- CRUD operations on task data
- Array methods such as `map`, `filter`, and `find`
- localStorage data persistence
- Responsive CSS grid and flexbox layouts
- Theme switching with CSS variables
- Simple UI state management

## Notes

- The login and signup system is frontend-only and meant for demonstration purposes.
- No real authentication or backend account storage is used.
- Data is stored only in the user's browser through localStorage.
- Clearing browser storage will remove saved tasks and preferences.

## License

This project is open source and free to use for learning, portfolio, and showcase purposes.
