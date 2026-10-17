
// StudyFlow AI - application logic
// Demo recommendations use JavaScript rules, not a connected AI model.

"use strict";

const STORAGE_KEYS = {
  subjects: "studyflow_subjects_v1",
  tasks: "studyflow_tasks_v1",
  timetable: "studyflow_timetable_v1"
};

let subjects = loadData(STORAGE_KEYS.subjects, []);
let tasks = loadData(STORAGE_KEYS.tasks, []);
let timetable = loadData(STORAGE_KEYS.timetable, null);

let editingSubjectId = null;
let editingTaskId = null;
let messageTimer = null;

const $ = (id) => document.getElementById(id);

// Read saved information from the browser.
function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.warn("Could not read saved data:", error);
    return fallback;
  }
}

// Save information to localStorage.
function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showMessage("Could not save data in this browser. Check your storage settings.", "error");
    return false;
  }
}

function saveSubjects() {
  saveData(STORAGE_KEYS.subjects, subjects);
}

function saveTasks() {
  saveData(STORAGE_KEYS.tasks, tasks);
}

function saveTimetable() {
  saveData(STORAGE_KEYS.timetable, timetable);
}

// Create a unique ID for each subject or task.
function makeId() {
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Return a date in YYYY-MM-DD format using local time.
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Validate a date without accepting impossible dates.
function parseDate(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDate(dateString) {
  const date = parseDate(dateString);

  return date
    ? date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : "No date";
}

function formatShortDate(dateString) {
  const date = parseDate(dateString);

  return date
    ? date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      })
    : "No date";
}

// Escape user-entered text before inserting it into HTML.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

// Display success, information, and error messages.
function showMessage(text, type = "success") {
  const area = $("messageArea");
  const message = document.createElement("div");

  message.className = `message ${type}`;
  message.textContent = text;
  area.appendChild(message);

  window.clearTimeout(messageTimer);

  messageTimer = window.setTimeout(() => {
    message.remove();
  }, 3600);
}

// A task is overdue only when it is pending and its deadline has passed.
function isOverdue(task) {
  return (
    !task.completed &&
    Boolean(task.deadline) &&
    task.deadline < localDateString()
  );
}

function getSubject(subjectId) {
  return subjects.find((subject) => subject.id === subjectId);
}

function getSubjectTasks(subjectId) {
  return tasks.filter((task) => task.subjectId === subjectId);
}

// Calculate the completion percentage for one subject.
function getSubjectProgress(subjectId) {
  const subjectTasks = getSubjectTasks(subjectId);

  if (!subjectTasks.length) return 0;

  const completed = subjectTasks.filter((task) => task.completed).length;

  return Math.round((completed / subjectTasks.length) * 100);
}

// Calculate the overall task statistics.
function getProgress() {
  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;
  const overdue = tasks.filter(isOverdue).length;

  const percentage = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  return { completed, pending, overdue, percentage };
}

// Switch between the five application sections.
function showSection(sectionName) {
  const validSections = [
    "dashboard",
    "subjects",
    "tasks",
    "timetable",
    "progress"
  ];

  if (!validSections.includes(sectionName)) return;

  document.querySelectorAll(".page-section").forEach((section) => {
    section.classList.remove("active");
  });

  $(`section-${sectionName}`).classList.add("active");

  document.querySelectorAll("[data-section-link]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.sectionLink === sectionName
    );
  });

  const names = {
    dashboard: "Dashboard",
    subjects: "Subjects",
    tasks: "Study Tasks",
    timetable: "Timetable",
    progress: "Progress Tracker"
  };

  $("currentPageName").textContent = names[sectionName];

  document.body.classList.remove("sidebar-open");
  $("menuToggle").setAttribute("aria-expanded", "false");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Update the subject dropdowns whenever subjects change.
function refreshSubjectOptions() {
  const taskSubjectSelect = $("taskSubject");
  const filterSelect = $("taskSubjectFilter");

  const selectedSubject = taskSubjectSelect.value;
  const selectedFilter = filterSelect.value;

  taskSubjectSelect.innerHTML =
    '<option value="">Choose a subject</option>' +
    subjects.map((subject) =>
      `<option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`
    ).join("");

  filterSelect.innerHTML =
    '<option value="all">All subjects</option>' +
    subjects.map((subject) =>
      `<option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`
    ).join("");

  if (subjects.some((subject) => subject.id === selectedSubject)) {
    taskSubjectSelect.value = selectedSubject;
  }

  if (subjects.some((subject) => subject.id === selectedFilter)) {
    filterSelect.value = selectedFilter;
  }
}

// Render the dashboard summary, upcoming tasks, and subject progress.
function renderDashboard() {
  const progress = getProgress();

  $("statSubjects").textContent = subjects.length;
  $("statPending").textContent = progress.pending;
  $("statCompleted").textContent = progress.completed;
  $("statProgress").textContent = `${progress.percentage}%`;

  $("statProgressBar").style.width = `${progress.percentage}%`;

  const pendingTasks = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5);

  const list = $("dashboardTaskList");

  if (!pendingTasks.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">✓</span>
        <h3>No pending tasks</h3>
        <p>Add a study task and it will appear here.</p>
      </div>`;
  } else {
    list.innerHTML = pendingTasks.map((task) => {
      const subject = getSubject(task.subjectId);
      const overdue = isOverdue(task);

      return `
        <div class="compact-task">
          <input
            class="task-check"
            type="checkbox"
            aria-label="Complete ${escapeHTML(task.name)}"
            data-complete-task="${escapeHTML(task.id)}"
          >
          <div class="compact-task-main">
            <span class="compact-task-title">${escapeHTML(task.name)}</span>
            <div class="compact-task-meta">
              <span>${escapeHTML(subject ? subject.name : "Unknown subject")}</span>
              <span>·</span>
              <span>${task.duration} min</span>
              ${overdue ? '<span class="badge badge-overdue">Overdue</span>' : ""}
            </div>
          </div>
          <span class="compact-task-date">${escapeHTML(formatShortDate(task.deadline))}</span>
        </div>`;
    }).join("");
  }

  const subjectProgress = $("dashboardSubjectProgress");

  if (!subjects.length) {
    subjectProgress.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">▤</span>
        <h3>No subjects yet</h3>
        <p>Add subjects to start tracking progress.</p>
      </div>`;
  } else {
    subjectProgress.innerHTML = subjects.slice(0, 5).map((subject) => {
      const count = getSubjectTasks(subject.id).length;
      const percentage = getSubjectProgress(subject.id);

      return `
        <div class="subject-progress-row">
          <div class="progress-row-top">
            <strong>${escapeHTML(subject.name)}</strong>
            <span>${percentage}% · ${count} task${count === 1 ? "" : "s"}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${percentage}%"></div>
          </div>
        </div>`;
    }).join("");
  }

  renderRecommendations();
}

// Display subject cards and support subject searching.
function renderSubjects() {
  const search = $("subjectSearch").value.trim().toLowerCase();

  const filtered = subjects.filter((subject) =>
    subject.name.toLowerCase().includes(search)
  );

  $("subjectCountLabel").textContent =
    `${subjects.length} subject${subjects.length === 1 ? "" : "s"}`;

  const grid = $("subjectsGrid");

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-icon">▤</span>
        <h3>${subjects.length ? "No matching subjects" : "No subjects added yet"}</h3>
        <p>${subjects.length
          ? "Try a different search."
          : "Use the form above to add your first subject."}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((subject) => {
    const count = getSubjectTasks(subject.id).length;
    const difficultyClass = subject.difficulty.toLowerCase();
    const percentage = getSubjectProgress(subject.id);

    return `
      <article class="subject-card">
        <div class="subject-card-top">
          <span class="subject-avatar">${escapeHTML(subject.name.trim().charAt(0).toUpperCase())}</span>
          <span class="badge badge-${difficultyClass}">${escapeHTML(subject.difficulty)}</span>
        </div>

        <h3>${escapeHTML(subject.name)}</h3>

        <div class="subject-meta">
          <span>${subject.examDate
            ? `Exam: ${escapeHTML(formatDate(subject.examDate))}`
            : "No exam date set"}</span>
        </div>

        <div class="subject-progress-row" style="margin-top:15px">
          <div class="progress-row-top">
            <span>Task progress</span>
            <span>${percentage}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${percentage}%"></div>
          </div>
        </div>

        <div class="subject-card-footer">
          <span class="subject-task-count">${count} task${count === 1 ? "" : "s"}</span>
          <div class="row-actions">
            <button
              class="button button-secondary button-small"
              data-view-subject-tasks="${escapeHTML(subject.id)}"
            >View tasks</button>
            <button
              class="icon-action delete"
              data-delete-subject="${escapeHTML(subject.id)}"
              aria-label="Delete ${escapeHTML(subject.name)}"
              title="Delete subject"
            >⌫</button>
          </div>
        </div>
      </article>`;
  }).join("");
}

// Search, filter, sort, and display study tasks.
function renderTasks() {
  refreshSubjectOptions();

  const query = $("taskSearch").value.trim().toLowerCase();
  const subjectFilter = $("taskSubjectFilter").value;
  const statusFilter = $("taskStatusFilter").value;
  const sortBy = $("taskSort").value;

  let filtered = tasks.filter((task) => {
    const subject = getSubject(task.subjectId);

    const matchesQuery =
      task.name.toLowerCase().includes(query) ||
      (task.description || "").toLowerCase().includes(query) ||
      (subject && subject.name.toLowerCase().includes(query));

    const matchesSubject =
      subjectFilter === "all" || task.subjectId === subjectFilter;

    const status = task.completed
      ? "completed"
      : isOverdue(task)
        ? "overdue"
        : "pending";

    const matchesStatus =
      statusFilter === "all" || status === statusFilter;

    return matchesQuery && matchesSubject && matchesStatus;
  });

  if (sortBy === "deadline") {
    filtered.sort((a, b) => a.deadline.localeCompare(b.deadline));
  }

  if (sortBy === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (sortBy === "priority") {
    const rank = { High: 0, Medium: 1, Low: 2 };

    filtered.sort((a, b) =>
      rank[a.priority] - rank[b.priority] ||
      a.deadline.localeCompare(b.deadline)
    );
  }

  $("taskCountLabel").textContent =
    `${filtered.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

  $("tasksEmpty").classList.toggle("hidden", filtered.length > 0);

  $("tasksTableBody").innerHTML = filtered.map((task) => {
    const subject = getSubject(task.subjectId);

    const status = task.completed
      ? "Completed"
      : isOverdue(task)
        ? "Overdue"
        : "Pending";

    const statusClass = status.toLowerCase();

    const priorityClass = task.priority.toLowerCase() === "medium"
      ? "priority-medium"
      : task.priority.toLowerCase();

    return `
      <tr>
        <td>
          <strong>${escapeHTML(task.name)}</strong>
          ${task.description
            ? `<span class="table-subtext">${escapeHTML(task.description)}</span>`
            : ""}
        </td>
        <td>${escapeHTML(subject ? subject.name : "Unknown subject")}</td>
        <td>${escapeHTML(formatDate(task.deadline))}</td>
        <td>${task.duration} min</td>
        <td><span class="badge badge-${priorityClass}">${escapeHTML(task.priority)}</span></td>
        <td><span class="badge badge-${statusClass}">${status}</span></td>
        <td>
          <div class="row-actions">
            <button
              class="icon-action"
              data-toggle-task="${escapeHTML(task.id)}"
              aria-label="${task.completed ? "Mark pending" : "Mark completed"}"
              title="${task.completed ? "Mark pending" : "Mark completed"}"
            >${task.completed ? "↶" : "✓"}</button>
            <button
              class="icon-action"
              data-edit-task="${escapeHTML(task.id)}"
              aria-label="Edit task"
              title="Edit task"
            >✎</button>
            <button
              class="icon-action delete"
              data-delete-task="${escapeHTML(task.id)}"
              aria-label="Delete task"
              title="Delete task"
            >⌫</button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

// Display overall progress, subject progress, and overdue tasks.
function renderProgress() {
  const progress = getProgress();

  $("progressOverall").textContent = `${progress.percentage}%`;
  $("progressOverallBar").style.width = `${progress.percentage}%`;
  $("progressCompleted").textContent = progress.completed;
  $("progressPending").textContent = progress.pending;
  $("progressOverdue").textContent = progress.overdue;

  if (!subjects.length) {
    $("progressSubjects").innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">◔</span>
        <h3>No subject progress yet</h3>
        <p>Add subjects and tasks to see progress here.</p>
      </div>`;
  } else {
    $("progressSubjects").innerHTML = subjects.map((subject) => {
      const subjectTasks = getSubjectTasks(subject.id);
      const completed = subjectTasks.filter((task) => task.completed).length;
      const percentage = getSubjectProgress(subject.id);

      return `
        <div class="subject-progress-row">
          <div class="progress-row-top">
            <strong>${escapeHTML(subject.name)}</strong>
            <span>${percentage}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${percentage}%"></div>
          </div>
          <div class="subject-progress-note">
            ${completed} of ${subjectTasks.length} task${subjectTasks.length === 1 ? "" : "s"} completed${subjectTasks.length === 0 ? " · Add tasks to start tracking" : ""}
          </div>
        </div>`;
    }).join("");
  }

  const overdueTasks = tasks
    .filter(isOverdue)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  $("overdueCountBadge").textContent = `${overdueTasks.length} overdue`;

  if (!overdueTasks.length) {
    $("overdueTasksList").innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">✓</span>
        <h3>You are caught up!</h3>
        <p>No overdue tasks at the moment.</p>
      </div>`;
  } else {
    $("overdueTasksList").innerHTML = overdueTasks.map((task) => {
      const subject = getSubject(task.subjectId);
      const deadlineDate = parseDate(task.deadline);

      const daysLate = deadlineDate
        ? Math.max(
            1,
            Math.floor(
              (parseDate(localDateString()) - deadlineDate) / 86400000
            )
          )
        : 0;

      return `
        <div class="overdue-item">
          <div>
            <h3>
              ${escapeHTML(task.name)}
              <span class="badge badge-overdue">${daysLate} day${daysLate === 1 ? "" : "s"} overdue</span>
            </h3>
            <p>
              ${escapeHTML(subject ? subject.name : "Unknown subject")}
              · Deadline: ${escapeHTML(formatDate(task.deadline))}
            </p>
          </div>
          <div class="overdue-actions">
            <button
              class="button button-secondary button-small"
              data-reschedule-task="${escapeHTML(task.id)}"
            >Change deadline</button>
            <button
              class="button button-primary button-small"
              data-toggle-task="${escapeHTML(task.id)}"
            >Mark completed</button>
          </div>
        </div>`;
    }).join("");
  }
}

// Generate transparent, rule-based demo recommendations.
function buildDemoRecommendations() {
  const suggestions = [];

  const pending = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const overdue = pending.filter(isOverdue);
  const today = localDateString();

  if (!subjects.length) {
    suggestions.push({
      icon: "＋",
      title: "Start with your subjects",
      text: "Add your current semester subjects so tasks and progress can be organized by subject."
    });
  }

  if (!tasks.length) {
    suggestions.push({
      icon: "☷",
      title: "Create your first study task",
      text: "Break a subject into one small topic, add an estimated duration, and set a realistic deadline."
    });
  }

  if (overdue.length) {
    suggestions.push({
      icon: "!",
      title: "Review overdue work",
      text: `${overdue.length} pending task${overdue.length === 1 ? "" : "s"} past the deadline. Consider changing the deadline or completing a short task first.`
    });
  }

  const upcomingExams = subjects
    .filter((subject) => subject.examDate && subject.examDate >= today)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));

  if (upcomingExams.length) {
    const exam = upcomingExams[0];

    suggestions.push({
      icon: "⚑",
      title: "Plan around your next exam",
      text: `${exam.name} has an exam on ${formatDate(exam.examDate)}. Check its pending topics and reserve revision time.`
    });
  }

  if (pending.length) {
    const next = pending[0];
    const subject = getSubject(next.subjectId);

    suggestions.push({
      icon: "◷",
      title: "Consider your next task",
      text: `"${next.name}"${subject ? ` (${subject.name})` : ""} is due ${formatDate(next.deadline)}. Estimated study time: ${next.duration} minutes.`
    });
  }

  if (tasks.length && !pending.length) {
    suggestions.push({
      icon: "✓",
      title: "All tasks are completed",
      text: "Nice work. Add your next topics or reserve a short session for revision."
    });
  }

  if (pending.length > 3) {
    suggestions.push({
      icon: "↗",
      title: "Keep sessions manageable",
      text: "Choose one or two focused tasks per session and regenerate your timetable as your task list changes."
    });
  }

  return suggestions.slice(0, 4);
}

function renderRecommendations() {
  const suggestions = buildDemoRecommendations();

  const html = suggestions.map((item) => `
    <div class="recommendation-item">
      <span class="recommendation-icon">${escapeHTML(item.icon)}</span>
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.text)}</p>
      </div>
    </div>
  `).join("");

  $("aiRecommendations").innerHTML = html ||
    '<p class="muted">No recommendations available right now.</p>';

  $("timetableRecommendations").innerHTML = html ||
    '<p class="muted">No recommendations available right now.</p>';
}

// Display the saved timetable.
function renderTimetable() {
  const summary = $("scheduleSummary");
  const output = $("timetableOutput");

  if (!timetable || !Array.isArray(timetable.sessions)) {
    summary.innerHTML = "";
    output.innerHTML = `
      <div class="schedule-empty">
        No timetable generated yet. Set your study hours above and select “Generate Timetable”.
      </div>`;
    $("scheduleSavedLabel").textContent = "No schedule yet";
    return;
  }

  const sessions = timetable.sessions;

  const totalMinutes = sessions.reduce(
    (sum, session) => sum + session.duration,
    0
  );

  summary.innerHTML = `
    <div class="schedule-summary-card">
      <span>Scheduled sessions</span>
      <strong>${sessions.length}</strong>
    </div>
    <div class="schedule-summary-card">
      <span>Total planned study time</span>
      <strong>${formatDuration(totalMinutes)}</strong>
    </div>
    <div class="schedule-summary-card">
      <span>Tasks not scheduled</span>
      <strong>${timetable.unscheduled.length}</strong>
    </div>`;

  $("scheduleSavedLabel").textContent =
    `Saved · ${formatDate(timetable.generatedAt)}`;

  if (!sessions.length) {
    output.innerHTML = `
      <div class="schedule-empty">
        There are no pending tasks to schedule, or no tasks fit the selected planning period.
      </div>`;
    return;
  }

  const grouped = {};

  sessions.forEach((session) => {
    if (!grouped[session.date]) grouped[session.date] = [];
    grouped[session.date].push(session);
  });

  output.innerHTML = Object.keys(grouped).sort().map((date) => {
    const daySessions = grouped[date];

    const dayMinutes = daySessions.reduce(
      (sum, session) => sum + session.duration,
      0
    );

    return `
      <div class="schedule-day">
        <div class="schedule-day-heading">
          <strong>${escapeHTML(formatShortDate(date))}</strong>
          <span>${formatDuration(dayMinutes)} planned</span>
        </div>

        ${daySessions.map((session) => {
          const subject = getSubject(session.subjectId);

          return `
            <div class="schedule-session">
              <span class="session-time">
                ${escapeHTML(session.startTime)} – ${escapeHTML(session.endTime)}
              </span>
              <div>
                <div class="session-title">${escapeHTML(session.taskName)}</div>
                <div class="session-subject">${escapeHTML(subject ? subject.name : "Unknown subject")}</div>
              </div>
              <span class="session-duration">${session.duration} min</span>
            </div>`;
        }).join("")}
      </div>`;
  }).join("");

  if (timetable.unscheduled.length) {
    output.innerHTML += `
      <div class="helper-note">
        <span>ⓘ</span>
        <p>
          <strong>${timetable.unscheduled.length} task${timetable.unscheduled.length === 1 ? "" : "s"} not scheduled:</strong>
          ${timetable.unscheduled.map((task) => escapeHTML(task.name)).join(", ")}.
          Try a longer planning period or more daily study time.
        </p>
      </div>`;
  }
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours && remaining) return `${hours}h ${remaining}m`;
  if (hours) return `${hours}h`;

  return `${remaining}m`;
}

function minutesToTime(minutes) {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

// Generate a timetable without exceeding the daily study-time limit.
function generateTimetable(event) {
  event.preventDefault();

  const dailyHours = Number($("dailyHours").value);
  const planningDays = Number($("planningDays").value);
  const startDate = $("planningStart").value;

  if (
    !Number.isFinite(dailyHours) ||
    dailyHours < 0.25 ||
    dailyHours > 16
  ) {
    showMessage("Enter daily study time between 0.25 and 16 hours.", "error");
    return;
  }

  if (![7, 14, 30].includes(planningDays)) {
    showMessage("Choose a planning period of 7, 14, or 30 days.", "error");
    return;
  }

  if (!parseDate(startDate)) {
    showMessage("Choose a valid timetable start date.", "error");
    return;
  }

  const dayLimit = Math.floor(dailyHours * 60);

  if (dayLimit < 1) {
    showMessage("Available study time must be at least one minute.", "error");
    return;
  }

  // Work on copies so the original task durations never change.
  const pending = tasks
    .filter((task) => !task.completed)
    .map((task) => ({ ...task }));

  const priorityRank = { High: 0, Medium: 1, Low: 2 };

  pending.sort((a, b) => {
    const deadlineDifference = a.deadline.localeCompare(b.deadline);

    return deadlineDifference ||
      priorityRank[a.priority] - priorityRank[b.priority];
  });

  const sessions = [];
  const start = parseDate(startDate);

  // Track the unfinished minutes for each task across all planning days.
  const remainingMinutes = new Map(
    pending.map((task) => [task.id, task.duration])
  );

  for (let dayIndex = 0; dayIndex < planningDays; dayIndex++) {
    const day = new Date(start);
    day.setDate(start.getDate() + dayIndex);

    const dateString = localDateString(day);

    let usedMinutes = 0;
    let clock = 9 * 60; // Suggested starting time: 9:00 AM

    for (const task of pending) {
      const remainingForTask = remainingMinutes.get(task.id) || 0;

      if (remainingForTask <= 0) continue;

      // Do not schedule a task after its deadline.
      if (task.deadline < dateString) continue;

      const remainingToday = dayLimit - usedMinutes;

      if (remainingToday <= 0) break;

      // Split long tasks across different days when necessary.
      const sessionDuration = Math.min(
        remainingForTask,
        remainingToday
      );

      if (sessionDuration < 1) continue;

      const startTime = minutesToTime(clock);

      clock += sessionDuration;

      const endTime = minutesToTime(clock);

      sessions.push({
        taskId: task.id,
        taskName: task.name,
        subjectId: task.subjectId,
        date: dateString,
        startTime,
        endTime,
        duration: sessionDuration
      });

      usedMinutes += sessionDuration;

      remainingMinutes.set(
        task.id,
        remainingForTask - sessionDuration
      );
    }
  }

  // Identify tasks that could not be completely scheduled.
  const unscheduled = pending
    .filter((task) => {
      const remaining = remainingMinutes.get(task.id) || 0;

      return remaining > 0 || task.deadline < startDate;
    })
    .map((task) => ({ id: task.id, name: task.name }));

  // Safety check: no day may exceed the configured limit.
  const totalsByDate = {};

  sessions.forEach((session) => {
    totalsByDate[session.date] =
      (totalsByDate[session.date] || 0) + session.duration;
  });

  const exceeded = Object.values(totalsByDate).some(
    (total) => total > dayLimit
  );

  if (exceeded) {
    showMessage(
      "Could not safely fit sessions into the daily limit. Please try again.",
      "error"
    );
    return;
  }

  timetable = {
    generatedAt: localDateString(),
    dailyHours,
    planningDays,
    startDate,
    sessions,
    unscheduled: uniqueById(unscheduled)
  };

  saveTimetable();
  renderTimetable();

  showMessage(
    `Timetable generated with ${sessions.length} session${sessions.length === 1 ? "" : "s"}.`,
    "success"
  );
}

function uniqueById(items) {
  const seen = new Set();

  return items.filter((item) => {
    if (seen.has(item.id)) return false;

    seen.add(item.id);
    return true;
  });
}

// Return the subject form to Add mode after clearing or submitting.
function resetSubjectForm() {
  editingSubjectId = null;
  $("subjectFormTitle").textContent = "Add a subject";
  $("subjectSubmit").textContent = "＋ Add Subject";
}

function resetTaskForm() {
  editingTaskId = null;
  $("taskFormTitle").textContent = "Add a study task";
  $("taskSubmit").textContent = "＋ Add Task";
}

// Add or update a subject.
function handleSubjectSubmit(event) {
  event.preventDefault();

  const name = $("subjectName").value.trim();
  const difficulty = $("subjectDifficulty").value;
  const examDate = $("subjectExamDate").value;

  if (!name) {
    return showMessage("Please enter a subject name.", "error");
  }

  if (!["Easy", "Medium", "Hard"].includes(difficulty)) {
    return showMessage("Choose a subject difficulty.", "error");
  }

  if (examDate && !parseDate(examDate)) {
    return showMessage("Enter a valid exam date.", "error");
  }

  const duplicate = subjects.some(
    (subject) =>
      subject.name.toLowerCase() === name.toLowerCase() &&
      subject.id !== editingSubjectId
  );

  if (duplicate) {
    return showMessage("A subject with that name already exists.", "error");
  }

  if (editingSubjectId) {
    const subject = getSubject(editingSubjectId);

    if (!subject) return resetSubjectForm();

    Object.assign(subject, { name, difficulty, examDate });

    showMessage("Subject updated.", "success");
  } else {
    subjects.push({
      id: makeId(),
      name,
      difficulty,
      examDate
    });

    showMessage("Subject added successfully.", "success");
  }

  saveSubjects();

  $("subjectForm").reset();
  resetSubjectForm();

  renderAll();
}

// Add or update a study task.
function handleTaskSubmit(event) {
  event.preventDefault();

  const name = $("taskName").value.trim();
  const subjectId = $("taskSubject").value;
  const deadline = $("taskDeadline").value;
  const duration = Number($("taskDuration").value);
  const priority = $("taskPriority").value;
  const description = $("taskDescription").value.trim();

  if (!name) {
    return showMessage("Please enter a task name.", "error");
  }

  if (!getSubject(subjectId)) {
    return showMessage("Please add and select a valid subject.", "error");
  }

  if (!parseDate(deadline)) {
    return showMessage("Choose a valid task deadline.", "error");
  }

  if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 1440
  ) {
    return showMessage(
      "Duration must be a whole number between 1 and 1440 minutes.",
      "error"
    );
  }

  if (!["Low", "Medium", "High"].includes(priority)) {
    return showMessage("Choose a valid priority.", "error");
  }

  if (editingTaskId) {
    const task = tasks.find((item) => item.id === editingTaskId);

    if (!task) return resetTaskForm();

    Object.assign(task, {
      name,
      subjectId,
      deadline,
      duration,
      priority,
      description
    });

    showMessage("Task updated.", "success");
  } else {
    tasks.push({
      id: makeId(),
      name,
      subjectId,
      deadline,
      duration,
      priority,
      description,
      completed: false,
      createdAt: localDateString()
    });

    showMessage("Study task added.", "success");
  }

  saveTasks();

  $("taskForm").reset();
  resetTaskForm();

  // Clear an old schedule so it cannot mislead the student.
  if (timetable) {
    timetable = null;
    saveTimetable();
  }

  renderAll();
}

// Mark a task completed or pending.
function toggleTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);

  if (!task) return;

  task.completed = !task.completed;

  saveTasks();

  if (timetable) {
    timetable = null;
    saveTimetable();
  }

  renderAll();

  showMessage(
    task.completed ? "Task marked completed." : "Task marked pending.",
    "success"
  );
}

// Delete a task after confirmation.
function deleteTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);

  if (!task) return;

  if (!window.confirm(`Delete the task "${task.name}"? This cannot be undone.`)) {
    return;
  }

  tasks = tasks.filter((item) => item.id !== taskId);

  saveTasks();

  if (timetable) {
    timetable = null;
    saveTimetable();
  }

  renderAll();
  showMessage("Task deleted.", "success");
}

// Delete a subject and its associated tasks after confirmation.
function deleteSubject(subjectId) {
  const subject = getSubject(subjectId);

  if (!subject) return;

  const associatedTasks = getSubjectTasks(subjectId);

  const message = associatedTasks.length
    ? `Delete "${subject.name}" and its ${associatedTasks.length} associated task(s)? This cannot be undone.`
    : `Delete "${subject.name}"? This cannot be undone.`;

  if (!window.confirm(message)) return;

  subjects = subjects.filter((item) => item.id !== subjectId);

  tasks = tasks.filter((task) => task.subjectId !== subjectId);

  saveSubjects();
  saveTasks();

  if (timetable) {
    timetable = null;
    saveTimetable();
  }

  renderAll();

  showMessage(
    associatedTasks.length
      ? "Subject and associated tasks deleted."
      : "Subject deleted.",
    "success"
  );
}

// Load an existing task into the form for editing.
function editTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);

  if (!task) return;

  editingTaskId = taskId;

  $("taskFormTitle").textContent = "Edit study task";
  $("taskSubmit").textContent = "Save Changes";

  $("taskName").value = task.name;
  $("taskSubject").value = task.subjectId;
  $("taskDeadline").value = task.deadline;
  $("taskDuration").value = task.duration;
  $("taskPriority").value = task.priority;
  $("taskDescription").value = task.description || "";

  showSection("tasks");
  $("taskName").focus();

  showMessage("Edit the task fields and save your changes.", "info");
}

// Change an overdue task's deadline.
function rescheduleTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);

  if (!task) return;

  const newDeadline = window.prompt(
    `Enter a new deadline for "${task.name}" in YYYY-MM-DD format:`,
    task.deadline
  );

  if (newDeadline === null) return;

  if (!parseDate(newDeadline.trim())) {
    showMessage(
      "Deadline unchanged. Please use a valid date in YYYY-MM-DD format.",
      "error"
    );
    return;
  }

  task.deadline = newDeadline.trim();

  saveTasks();

  if (timetable) {
    timetable = null;
    saveTimetable();
  }

  renderAll();
  showMessage("Deadline updated.", "success");
}

// Open the tasks section filtered to a selected subject.
function viewSubjectTasks(subjectId) {
  $("taskSubjectFilter").value = subjectId;
  $("taskSearch").value = "";
  $("taskStatusFilter").value = "all";

  showSection("tasks");
  renderTasks();
}

// Clear the timetable without deleting subjects or tasks.
function clearTimetable() {
  if (!timetable) {
    showMessage("There is no saved timetable to clear.", "info");
    return;
  }

  if (!window.confirm(
    "Clear the saved timetable? Your subjects and tasks will not be deleted."
  )) {
    return;
  }

  timetable = null;

  saveTimetable();
  renderTimetable();

  showMessage("Timetable cleared.", "success");
}

// Refresh all sections after data changes.
function renderAll() {
  refreshSubjectOptions();
  renderDashboard();
  renderSubjects();
  renderTasks();
  renderProgress();
  renderTimetable();
}

// Configure navigation and the mobile sidebar.
function setupNavigation() {
  document.querySelectorAll("[data-section-link]").forEach((button) => {
    button.addEventListener("click", () => {
      showSection(button.dataset.sectionLink);
    });
  });

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      showSection(button.dataset.go);
    });
  });

  $("menuToggle").addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("sidebar-open");

    $("menuToggle").setAttribute("aria-expanded", String(isOpen));
  });

  $("sidebarBackdrop").addEventListener("click", () => {
    document.body.classList.remove("sidebar-open");
    $("menuToggle").setAttribute("aria-expanded", "false");
  });
}

// Connect forms, filters, and action buttons.
function setupEvents() {
  $("subjectForm").addEventListener("submit", handleSubjectSubmit);
  $("taskForm").addEventListener("submit", handleTaskSubmit);
  $("timetableForm").addEventListener("submit", generateTimetable);

  $("subjectForm").addEventListener("reset", () => {
    window.setTimeout(resetSubjectForm, 0);
  });

  $("taskForm").addEventListener("reset", () => {
    window.setTimeout(resetTaskForm, 0);
  });

  $("subjectSearch").addEventListener("input", renderSubjects);

  ["taskSearch", "taskSubjectFilter", "taskStatusFilter", "taskSort"].forEach((id) => {
    $(id).addEventListener(
      id === "taskSearch" ? "input" : "change",
      renderTasks
    );
  });

  $("refreshRecommendations").addEventListener("click", () => {
    renderRecommendations();

    showMessage(
      "Demo recommendations refreshed from your current tasks.",
      "info"
    );
  });

  $("clearTimetable").addEventListener("click", clearTimetable);

  // Event delegation handles buttons created dynamically by render functions.
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, input");

    if (!target) return;

    if (target.dataset.completeTask) {
      toggleTask(target.dataset.completeTask);
    }

    if (target.dataset.toggleTask) {
      toggleTask(target.dataset.toggleTask);
    }

    if (target.dataset.deleteTask) {
      deleteTask(target.dataset.deleteTask);
    }

    if (target.dataset.deleteSubject) {
      deleteSubject(target.dataset.deleteSubject);
    }

    if (target.dataset.editTask) {
      editTask(target.dataset.editTask);
    }

    if (target.dataset.rescheduleTask) {
      rescheduleTask(target.dataset.rescheduleTask);
    }

    if (target.dataset.viewSubjectTasks) {
      viewSubjectTasks(target.dataset.viewSubjectTasks);
    }
  });
}

// Start the application.
function initializeApp() {
  $("headerDate").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  $("welcomeTitle").textContent = "Welcome back!";
  $("planningStart").value = localDateString();

  setupNavigation();
  setupEvents();
  renderAll();
}

initializeApp();
