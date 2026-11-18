const STORE_KEY = "tick.workspace.v1";
const THEME_KEY = "tick.theme";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => globalThis.crypto?.randomUUID?.() || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
const pad = value => String(value).padStart(2, "0");
const dateString = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = () => dateString(new Date());
const fromDateString = value => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};
const shiftDate = (value, days) => {
  const date = fromDateString(value);
  date.setDate(date.getDate() + days);
  return dateString(date);
};
const addMonths = (date, count) => {
  const result = new Date(date.getFullYear(), date.getMonth() + count, 1, 12);
  result.setDate(Math.min(date.getDate(), new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  return result;
};
const durationEnd = habit => {
  const start = fromDateString(habit.startDate);
  if (habit.durationUnit === "months") {
    const inclusive = addMonths(start, Number(habit.duration));
    inclusive.setDate(inclusive.getDate() - 1);
    return dateString(inclusive);
  }
  return shiftDate(habit.startDate, Number(habit.duration) * 7 - 1);
};
const parseLocal = value => fromDateString(value);
const fmtDate = (value, options = { month: "short", day: "numeric" }) => parseLocal(value).toLocaleDateString(undefined, options);
const sameDateValid = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseLocal(value).getTime()) && dateString(parseLocal(value)) === value;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const weekStart = value => {
  const date = parseLocal(value);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return dateString(date);
};
const weekDates = value => Array.from({ length: 7 }, (_, index) => shiftDate(weekStart(value), index));
const dateDiff = (a, b) => Math.round((parseLocal(b) - parseLocal(a)) / 86400000);
const formatLongDate = value => parseLocal(value).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function emptyData() {
  return { goals: [], habits: [], completions: {} };
}
function stripSampleEntries(data) {
  const sampleHabitIds = new Set(data.habits.filter(habit => habit.sample === true).map(habit => habit.id));
  const goals = data.goals.filter(goal => goal.sample !== true);
  const habits = data.habits.filter(habit => habit.sample !== true);
  const changed = goals.length !== data.goals.length || habits.length !== data.habits.length;
  if (!changed) return { data, changed: false };
  const completions = { ...data.completions };
  for (const id of sampleHabitIds) delete completions[id];
  return { data: { goals, habits, completions }, changed: true };
}
function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidData(parsed)) {
        const cleaned = stripSampleEntries(parsed);
        if (cleaned.changed) {
          try { localStorage.setItem(STORE_KEY, JSON.stringify(cleaned.data)); }
          catch (error) { console.warn("Tick could not update saved sample entries.", error); }
        }
        return cleaned.data;
      }
    }
  } catch (error) { console.warn("Tick could not read saved workspace.", error); }
  return emptyData();
}
let state = loadData();
let selectedDate = today();
let activeSection = "goals";
let editorMode = "";
let editingId = "";
let draftSubtasks = [];
let storageWarning = false;
function saveData() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    storageWarning = false;
  } catch (error) {
    storageWarning = true;
    console.warn("Tick could not save to this browser.", error);
  }
}
function announce(message) {
  const live = $("#live-message");
  live.textContent = "";
  window.setTimeout(() => { live.textContent = message; }, 20);
}
function emptyMarkup(title, copy, buttonLabel, buttonId) {
  return `<div class="empty-state"><span class="empty-mark" aria-hidden="true">+</span><h3>${title}</h3><p>${copy}</p>${buttonLabel ? `<button class="button button-primary" type="button" id="${buttonId}">${buttonLabel}</button>` : ""}</div>`;
}
function icon(name) {
  if (name === "edit") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.3-.9L19 8.4a2.1 2.1 0 0 0-3-3L5.3 16.1 4 20Z"/></svg>';
  if (name === "delete") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
}
function actionButton(action, id, label, iconName) {
  return `<button type="button" class="small-action" data-action="${action}" data-id="${escapeHTML(id)}" aria-label="${label}">${icon(iconName)}</button>`;
}
function ringSVG(percent, numerator, denominator, className = "goal-progress", label = "") {
  const radius = className === "daily-ring" ? 27 : 34;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, percent));
  return `<svg class="${className}" viewBox="0 0 100 100" role="img" aria-label="${escapeHTML(label || `${value}% complete, ${numerator} of ${denominator}`)}">
    <circle class="ring-track" cx="50" cy="50" r="${radius}"></circle>
    <circle class="ring-value" cx="50" cy="50" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - value / 100)}"></circle>
    <text class="ring-percent" x="50" y="48">${value}%</text><text class="ring-caption" x="50" y="62">${numerator} of ${denominator}</text>
  </svg>`;
}
function renderGoal(goal) {
  const total = goal.subtasks.length;
  const done = goal.subtasks.filter(item => item.done).length;
  const percent = total ? Math.round(done / total * 100) : 0;
  const allDone = total > 0 && done === total;
  const targetDistance = goal.targetDate ? dateDiff(today(), goal.targetDate) : null;
  let targetText = "No target date";
  if (targetDistance !== null) {
    targetText = targetDistance < 0 ? `Overdue by ${Math.abs(targetDistance)} ${Math.abs(targetDistance) === 1 ? "day" : "days"}` :
      targetDistance === 0 ? "Target is today" : `${fmtDate(goal.targetDate)} · ${targetDistance} ${targetDistance === 1 ? "day" : "days"} left`;
  }
  const subtasks = total ? goal.subtasks.map(item => `<div class="subtask-row ${item.done ? "done" : ""}">
    <button type="button" class="check-control" role="checkbox" aria-checked="${item.done}" aria-label="${item.done ? "Mark incomplete" : "Complete"}: ${escapeHTML(item.title)}" data-action="goal-check" data-goal-id="${escapeHTML(goal.id)}" data-id="${escapeHTML(item.id)}"></button>
    <span class="subtask-label">${escapeHTML(item.title)}</span>
    <button type="button" class="small-action subtask-remove" data-action="goal-subtask-delete" data-goal-id="${escapeHTML(goal.id)}" data-id="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.title)}">${icon("delete")}</button>
  </div>`).join("") : '<div class="subtask-empty">No steps yet. Add a few in edit.</div>';
  return `<article class="goal-card ${allDone ? "is-complete" : ""}" id="goal-${escapeHTML(goal.id)}" aria-label="Goal: ${escapeHTML(goal.title)}">
    <div class="goal-card-head"><div><h3 class="goal-title">${escapeHTML(goal.title)}</h3><p class="goal-target ${targetDistance !== null && targetDistance < 0 ? "overdue" : ""}">${escapeHTML(targetText)}</p></div>
      <div class="goal-actions">${actionButton("goal-edit", goal.id, "Edit goal", "edit")}${actionButton("goal-delete", goal.id, "Delete goal", "delete")}</div>
    </div>
    <div class="goal-card-content"><div class="subtask-list">${subtasks}</div>${ringSVG(percent, done, total, "goal-progress", `${percent}% complete; ${done} of ${total} subtasks`)}</div>
    <div class="goal-foot"><span>${total} ${total === 1 ? "step" : "steps"} · ${done} complete</span><strong>${allDone ? "Complete" : `${total - done} left`}</strong></div>
  </article>`;
}
function completionsFor(id) { return Array.isArray(state.completions[id]) ? state.completions[id] : []; }
function isCompleted(id, date) { return completionsFor(id).includes(date); }
function eligibleOn(habit, date) {
  const end = durationEnd(habit);
  return date >= habit.startDate && date <= end;
}
function weekCount(habit, week, before = "9999-12-31") {
  const start = weekStart(week);
  const end = shiftDate(start, 6);
  return completionsFor(habit.id).filter(day => day >= start && day <= end && day < before && day >= habit.startDate && day <= durationEnd(habit)).length;
}
function eligibleForCheckin(habit, date) {
  if (!eligibleOn(habit, date)) return false;
  if (habit.frequency === "weekly" && weekCount(habit, date, date) >= habit.quota) return false;
  return true;
}
function sessionsDone(habit) {
  const end = durationEnd(habit);
  return completionsFor(habit.id).filter(day => day >= habit.startDate && day <= end).length;
}
function targetSessions(habit) {
  if (habit.frequency === "weekly") {
    const weeks = habit.durationUnit === "weeks" ? Number(habit.duration) : Math.ceil((dateDiff(habit.startDate, durationEnd(habit)) + 1) / 7);
    return Number(habit.quota) * weeks;
  }
  return dateDiff(habit.startDate, durationEnd(habit)) + 1;
}
function streakStats(habit) {
  const weeks = habit.frequency === "weekly";
  const allDates = [...new Set(completionsFor(habit.id))].sort();
  const periods = [];
  if (weeks) {
    const weekKeys = [...new Set(allDates.filter(d => d >= habit.startDate && d <= durationEnd(habit)).map(weekStart))].sort();
    for (const week of weekKeys) if (weekCount(habit, week) >= habit.quota) periods.push(week);
  } else {
    periods.push(...allDates.filter(d => d >= habit.startDate && d <= durationEnd(habit)));
  }
  let best = 0, run = 0, prior = "";
  for (const value of periods) {
    const consecutive = prior && dateDiff(weeks ? prior : prior, value) === (weeks ? 7 : 1);
    run = consecutive ? run + 1 : 1;
    best = Math.max(best, run);
    prior = value;
  }
  const anchor = weeks ? weekStart(today()) : (isCompleted(habit.id, today()) ? today() : shiftDate(today(), -1));
  let current = 0;
  let cursor = anchor;
  const hasPeriod = value => periods.includes(value);
  if (weeks && !hasPeriod(cursor)) cursor = shiftDate(cursor, -7);
  else if (!weeks && !hasPeriod(cursor)) return { current: 0, best };
  while (hasPeriod(cursor)) {
    current++;
    cursor = shiftDate(cursor, weeks ? -7 : -1);
  }
  return { current, best };
}
function chartSVG(habit) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(selectedDate, i - 6));
  const end = durationEnd(habit);
  const groups = days.map((day, index) => {
    const within = day >= habit.startDate && day <= end;
    const complete = within && isCompleted(habit.id, day);
    const label = `${fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}: ${within ? (complete ? "completed" : "not completed") : "outside habit dates"}`;
    const height = within ? (complete ? 23 : 5) : 2;
    const x = 13 + index * 29;
    return `<g class="chart-day-group" data-action="chart-day" data-date="${day}" tabindex="0" role="button" aria-label="${escapeHTML(label)}"><title>${escapeHTML(label)}</title>
      <rect class="chart-hit" x="${x - 8}" y="0" width="25" height="45" rx="4"></rect>
      <rect class="chart-bar ${complete ? "completed" : ""} ${day === selectedDate ? "selected" : ""}" x="${x}" y="${34 - height}" width="9" height="${height}" rx="3"></rect>
      <text x="${x + 4.5}" y="44" text-anchor="middle">${fmtDate(day, { weekday: "narrow" })}</text></g>`;
  }).join("");
  return `<svg class="week-chart" viewBox="0 0 208 48" role="group" aria-label="Seven day completion chart for ${escapeHTML(habit.name)}">${groups}</svg>`;
}
function renderHabit(habit) {
  const end = durationEnd(habit);
  const finished = end < today();
  const target = targetSessions(habit);
  const done = sessionsDone(habit);
  const percent = target ? Math.min(100, Math.round(done / target * 100)) : 0;
  const daysLeft = dateDiff(today(), end);
  const streak = streakStats(habit);
  const frequency = habit.frequency === "daily" ? "Every day" : `${habit.quota} days / week`;
  const streakUnit = habit.frequency === "daily" ? "days" : "weeks";
  const weeklyNow = weekCount(habit, today());
  const meta = `${frequency} · ${habit.duration} ${habit.durationUnit === "months" ? (habit.duration === 1 ? "month" : "months") : (habit.duration === 1 ? "week" : "weeks")} · through ${fmtDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
  return `<article class="habit-card ${finished ? "finished" : ""}" aria-label="${escapeHTML(habit.name)} habit">
    <div class="habit-card-top"><div><h3 class="habit-name">${escapeHTML(habit.name)}${finished ? '<span class="finished-label">Finished</span>' : ""}</h3><p class="habit-subline">${escapeHTML(meta)}</p></div>
      <div class="habit-actions">${actionButton("habit-edit", habit.id, `Edit ${habit.name}`, "edit")}${actionButton("habit-delete", habit.id, `Delete ${habit.name}`, "delete")}</div></div>
    <div class="habit-statline"><span class="sessions-text">${done} <span class="progress-text">/ ${target} sessions</span></span><span class="progress-text">${percent}%</span></div>
    <div class="progress-track" role="progressbar" aria-label="${escapeHTML(habit.name)} overall progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="progress-fill" style="width:${percent}%"></div></div>
    <div class="habit-metrics"><span>Current streak <strong>${streak.current} ${streakUnit}</strong></span><span>Best streak <strong>${streak.best} ${streakUnit}</strong></span>
      ${habit.frequency === "weekly" ? `<span>This week <strong>${Math.min(weeklyNow, habit.quota)} / ${habit.quota}</strong></span>` : ""}
      ${finished ? `<span>Ended <strong>${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} ago</strong></span>` : `<span><strong>${daysLeft === 0 ? "Ends today" : `${daysLeft} days left`}</strong></span>`}
    </div>
    <div class="habit-bottom">${chartSVG(habit)}<span class="week-chart-label">7 days</span></div>
  </article>`;
}
function renderGoalsProgressChart() {
  const panel = $("#goal-progress-panel");
  const chart = $("#goals-progress-chart");
  panel.hidden = state.goals.length === 0;
  if (!state.goals.length) {
    chart.innerHTML = "";
    return;
  }
  const rowHeight = 72;
  const height = state.goals.length * rowHeight + 8;
  const rows = state.goals.map((goal, index) => {
    const total = goal.subtasks.length;
    const done = goal.subtasks.filter(step => step.done).length;
    const percent = total ? Math.round(done / total * 100) : 0;
    const y = 4 + index * rowHeight;
    const accessibleName = `${goal.title}: ${percent}% complete, ${done} of ${total} steps. Select to view goal.`;
    return `<g class="goal-chart-row" data-goal-chart-target="${escapeHTML(goal.id)}" transform="translate(0 ${y})" tabindex="0" role="button" aria-label="${escapeHTML(accessibleName)}">
      <title>${escapeHTML(accessibleName)}</title>
      <rect class="goal-chart-hit" x="0" y="0" width="700" height="64" rx="12"></rect>
      <text class="goal-chart-name" x="16" y="20">${escapeHTML(goal.title)}</text>
      <text class="goal-chart-percent" x="684" y="20" text-anchor="end">${percent}%</text>
      <rect class="goal-chart-track" x="16" y="29" width="668" height="7" rx="4"></rect>
      <rect class="goal-chart-fill" x="16" y="29" width="${668 * percent / 100}" height="7" rx="4"></rect>
      <text class="goal-chart-detail" x="16" y="54">${done} of ${total} ${total === 1 ? "step" : "steps"} complete</text>
      <text class="goal-chart-detail" x="684" y="54" text-anchor="end">${percent === 100 && total > 0 ? "Completed" : `${total - done} left`}</text>
    </g>`;
  }).join("");
  chart.innerHTML = `<svg class="goal-chart-svg" viewBox="0 0 700 ${height}" role="group" aria-label="Progress chart for all goals. Select a row to jump to that goal.">${rows}</svg>`;
}
function render() {
  $("#header-date").textContent = matchMedia("(max-width: 520px)").matches ? fmtDate(today(), { month: "short", day: "numeric", year: "numeric" }) : formatLongDate(today());
  $("#goal-count").textContent = String(state.goals.length);
  const allSteps = state.goals.flatMap(goal => goal.subtasks);
  const doneSteps = allSteps.filter(step => step.done).length;
  $("#goal-summary").textContent = state.goals.length ? `${state.goals.length} ${state.goals.length === 1 ? "goal" : "goals"} · ${doneSteps} of ${allSteps.length} steps complete.` : "A clear space for what matters.";
  $("#goals-list").innerHTML = state.goals.length ? state.goals.map(renderGoal).join("") :
    emptyMarkup("A space for a goal.", "Start with something you'd like to see through.", "Add a goal", "add-goal-empty");
  renderGoalsProgressChart();
  const inDateRange = state.habits.filter(habit => eligibleOn(habit, selectedDate));
  const available = inDateRange.filter(habit => eligibleForCheckin(habit, selectedDate));
  const checked = available.filter(habit => isCompleted(habit.id, selectedDate)).length;
  const percent = available.length ? Math.round(checked / available.length * 100) : 0;
  $("#today-ring-wrap").innerHTML = `${ringSVG(percent, checked, available.length, "daily-ring", `Selected day completion: ${checked} of ${available.length} eligible habits, ${percent}%`)}<span><strong>${checked} of ${available.length}</strong>${selectedDate === today() ? " checked in today" : " on this day"}</span>`;
  $("#selected-date").textContent = selectedDate === today() ? "Today" : formatLongDate(selectedDate).replace(/, \d{4}$/, "");
  $("#daily-count").textContent = available.length ? `${checked} / ${available.length} done` : "";
  $("#daily-checklist").innerHTML = inDateRange.length ? inDateRange.map(habit => {
    const done = isCompleted(habit.id, selectedDate);
    const weeklyCount = habit.frequency === "weekly" ? weekCount(habit, selectedDate) : null;
    const quotaMetEarlier = habit.frequency === "weekly" && weekCount(habit, selectedDate, selectedDate) >= habit.quota;
    const quotaReached = habit.frequency === "weekly" && weeklyCount >= habit.quota;
    const detail = habit.frequency === "weekly" ? `${weeklyCount} of ${habit.quota} this week` : "Every day";
    return `<div class="daily-check-row ${done ? "checked" : ""} ${quotaReached ? "quota-met" : ""}">
      <button type="button" class="check-control" role="checkbox" aria-checked="${done}" ${quotaMetEarlier && !done ? "disabled" : ""} aria-label="${done ? "Mark incomplete" : "Complete"} ${escapeHTML(habit.name)} for ${fmtDate(selectedDate, { month: "long", day: "numeric" })}" data-action="habit-check" data-id="${escapeHTML(habit.id)}"></button>
      <span class="check-row-copy"><span class="check-row-title">${escapeHTML(habit.name)}</span><span class="check-row-meta">${detail}</span></span>
      ${quotaMetEarlier || quotaReached ? '<span class="quota-label">Weekly quota met</span>' : ""}
    </div>`;
  }).join("") : `<div class="daily-empty">${state.habits.length ? "No habits to check in on this day." : "A little room for a new rhythm."}</div>`;
  $("#habit-total").textContent = `${state.habits.length} ${state.habits.length === 1 ? "habit" : "habits"}`;
  $("#habits-list").innerHTML = state.habits.length ? state.habits.map(renderHabit).join("") :
    emptyMarkup("Nothing on the list yet.", "Choose a small practice to keep close.", "Add a habit", "add-habit-empty");
  $$(".nav-tab").forEach(tab => {
    const active = tab.dataset.section === activeSection;
    tab.classList.toggle("active", active);
    if (active) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
  });
  $("#goals-section").hidden = activeSection !== "goals";
  $("#daily-section").hidden = activeSection !== "daily";
  if (storageWarning) announce("Changes could not be saved. Browser storage may be unavailable.");
}
function setTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  $("#theme-toggle").setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  $("#theme-toggle").title = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
}
try {
  const storedTheme = localStorage.getItem(THEME_KEY);
  setTheme(storedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
} catch { setTheme("light"); }
function openEditor(kind, id = "") {
  editorMode = kind;
  editingId = id;
  const item = id ? (kind === "goal" ? state.goals.find(entry => entry.id === id) : state.habits.find(entry => entry.id === id)) : null;
  if (id && !item) return;
  $("#form-error").textContent = "";
  $("#dialog-kicker").textContent = item ? `EDIT ${kind.toUpperCase()}` : `NEW ${kind.toUpperCase()}`;
  $("#dialog-title").textContent = item ? `Edit ${kind}` : `Add ${kind === "goal" ? "a goal" : "a habit"}`;
  $("#save-entry").textContent = item ? "Save changes" : `Save ${kind}`;
  if (kind === "goal") {
    draftSubtasks = item ? item.subtasks.map(subtask => ({ ...subtask })) : [];
    $("#form-fields").innerHTML = `<div class="field"><label for="entry-title">Goal title</label><input id="entry-title" name="title" maxlength="120" required placeholder="What would you like to see through?" value="${escapeHTML(item?.title || "")}"></div>
      <div class="field"><label for="entry-date">Target date <span class="field-hint">(optional)</span></label><input id="entry-date" name="targetDate" type="date" value="${escapeHTML(item?.targetDate || "")}"></div>
      <fieldset class="subtask-editor"><legend>Steps <span class="field-hint">(optional)</span></legend><div class="subtask-add-row"><input id="subtask-input" maxlength="100" placeholder="Add a step"><button type="button" id="add-subtask-draft" aria-label="Add step">+</button></div><div class="edit-subtask-list" id="draft-subtasks"></div></fieldset>`;
    renderDraftSubtasks();
  } else {
    const current = item || { name: "", frequency: "daily", quota: 4, duration: 1, durationUnit: "months", startDate: today() };
    $("#form-fields").innerHTML = `<div class="field"><label for="entry-title">Habit name</label><input id="entry-title" name="name" maxlength="80" required placeholder="What would you like to return to?" value="${escapeHTML(current.name)}"></div>
      <div class="field"><label for="frequency">Rhythm</label><select id="frequency" name="frequency"><option value="daily" ${current.frequency === "daily" ? "selected" : ""}>Every day</option><option value="weekly" ${current.frequency === "weekly" ? "selected" : ""}>Days per week</option></select></div>
      <div class="field" id="quota-field" ${current.frequency === "daily" ? "hidden" : ""}><label for="quota">Days each week</label><select id="quota" name="quota">${[1,2,3,4,5,6,7].map(value => `<option value="${value}" ${Number(current.quota) === value ? "selected" : ""}>${value} ${value === 1 ? "day" : "days"} / week</option>`).join("")}</select></div>
      <div class="field"><label for="duration">For how long?</label><div class="duration-row"><input id="duration" name="duration" type="number" min="1" step="1" required value="${Number(current.duration)}"><select id="duration-unit" name="durationUnit" aria-label="Duration unit"><option value="weeks" ${current.durationUnit === "weeks" ? "selected" : ""}>weeks</option><option value="months" ${current.durationUnit === "months" ? "selected" : ""}>months</option></select></div><span class="field-hint" id="duration-preview"></span></div>
      <div class="field"><label for="start-date">Start date</label><input id="start-date" name="startDate" type="date" required value="${escapeHTML(current.startDate)}"></div>`;
    updateDurationPreview();
  }
  $("#editor-dialog").showModal();
  $("#entry-title").focus();
}
function renderDraftSubtasks() {
  const container = $("#draft-subtasks");
  if (!container) return;
  container.innerHTML = draftSubtasks.map((step, index) => `<div class="edit-subtask"><input class="draft-subtask-title" data-draft-index="${index}" maxlength="100" aria-label="Step name" value="${escapeHTML(step.title)}"><button type="button" class="small-action" data-action="draft-subtask-remove" data-index="${index}" aria-label="Remove ${escapeHTML(step.title)}">${icon("delete")}</button></div>`).join("");
}
function updateDurationPreview() {
  const hint = $("#duration-preview");
  if (!hint) return;
  const duration = Number($("#duration")?.value);
  const unit = $("#duration-unit")?.value;
  const start = $("#start-date")?.value;
  if (!duration || duration < 1 || !sameDateValid(start)) { hint.textContent = ""; return; }
  const sample = { duration, durationUnit: unit, startDate: start };
  const end = durationEnd(sample);
    const weeks = unit === "weeks" ? duration : Math.ceil((dateDiff(start, end) + 1) / 7);
    const target = $("#frequency")?.value === "weekly" ? Number($("#quota")?.value || 1) * weeks : dateDiff(start, end) + 1;
  hint.textContent = `Through ${fmtDate(end, { month: "long", day: "numeric", year: "numeric" })} · ${target} target sessions`;
}
function addDraftSubtask() {
  const input = $("#subtask-input");
  if (!input) return;
  const title = input.value.trim();
  if (!title) { input.focus(); return; }
  draftSubtasks.push({ id: uid(), title, done: false });
  input.value = "";
  renderDraftSubtasks();
  input.focus();
}
function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const title = String(data.get(editorMode === "goal" ? "title" : "name") || "").trim();
  if (!title) { $("#form-error").textContent = "Add a name before saving."; $("#entry-title").focus(); return; }
  if (editorMode === "goal") {
    const targetDate = String(data.get("targetDate") || "");
    if (targetDate && !sameDateValid(targetDate)) { $("#form-error").textContent = "Choose a valid target date."; return; }
    if (draftSubtasks.some(step => !step.title.trim())) { $("#form-error").textContent = "Give each step a name, or remove the empty one."; $(".draft-subtask-title")?.focus(); return; }
    if (editingId) {
      const goal = state.goals.find(entry => entry.id === editingId);
      goal.title = title; goal.targetDate = targetDate; goal.subtasks = draftSubtasks;
    } else state.goals.push({ id: uid(), title, targetDate, subtasks: draftSubtasks, sample: false });
  } else {
    const duration = Number(data.get("duration"));
    const startDate = String(data.get("startDate") || "");
    if (!Number.isSafeInteger(duration) || duration < 1) { $("#form-error").textContent = "Duration must be a whole number of at least 1."; $("#duration").focus(); return; }
    if (!sameDateValid(startDate)) { $("#form-error").textContent = "Choose a valid start date."; $("#start-date").focus(); return; }
    const frequency = String(data.get("frequency"));
    const habit = {
      id: editingId || uid(), name: title, frequency,
      quota: frequency === "daily" ? 1 : Math.min(7, Math.max(1, Number(data.get("quota")))),
      duration, durationUnit: String(data.get("durationUnit")), startDate,
      sample: editingId ? Boolean(state.habits.find(entry => entry.id === editingId)?.sample) : false
    };
    if (editingId) state.habits = state.habits.map(entry => entry.id === editingId ? habit : entry);
    else state.habits.push(habit);
  }
  saveData();
  $("#editor-dialog").close();
  render();
  announce(`${editorMode === "goal" ? "Goal" : "Habit"} saved.`);
}
function toggleCompletion(id, date) {
  const habit = state.habits.find(item => item.id === id);
  if (!habit || !eligibleOn(habit, date)) return;
  const dates = completionsFor(id);
  const next = dates.includes(date) ? dates.filter(value => value !== date) : [...dates, date];
  if (next.length) state.completions[id] = next; else delete state.completions[id];
  saveData(); render();
  announce(`${habit.name} ${next.includes(date) ? "checked off" : "unchecked"} for ${fmtDate(date)}.`);
}
function removeGoal(goal) {
  if (!window.confirm(`Delete “${goal.title}” and its steps? This cannot be undone.`)) return;
  state.goals = state.goals.filter(item => item.id !== goal.id);
  saveData(); render(); announce("Goal deleted.");
}
function removeHabit(habit) {
  if (!window.confirm(`Delete “${habit.name}” and its completion history? This cannot be undone.`)) return;
  state.habits = state.habits.filter(item => item.id !== habit.id);
  delete state.completions[habit.id];
  saveData(); render(); announce("Habit deleted.");
}
function isValidData(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.goals) || !Array.isArray(value.habits) || !value.completions || typeof value.completions !== "object" || Array.isArray(value.completions)) return false;
  const ids = new Set();
  const habitIds = new Set();
  const subtaskIds = new Set();
  for (const goal of value.goals) {
    if (!goal || typeof goal.id !== "string" || !goal.id || ids.has(goal.id) || typeof goal.title !== "string" || !goal.title.trim() || typeof goal.targetDate !== "string" || (goal.targetDate && !sameDateValid(goal.targetDate)) || !Array.isArray(goal.subtasks)) return false;
    ids.add(goal.id);
    if (!goal.subtasks.every(step => {
      if (!step || typeof step.id !== "string" || !step.id || subtaskIds.has(step.id) || typeof step.title !== "string" || !step.title.trim() || typeof step.done !== "boolean") return false;
      subtaskIds.add(step.id); return true;
    })) return false;
  }
  for (const habit of value.habits) {
    if (!habit || typeof habit.id !== "string" || !habit.id || ids.has(habit.id) || typeof habit.name !== "string" || !habit.name.trim() || !["daily", "weekly"].includes(habit.frequency) || !Number.isInteger(Number(habit.duration)) || Number(habit.duration) < 1 || !["weeks", "months"].includes(habit.durationUnit) || !sameDateValid(habit.startDate)) return false;
    if (habit.frequency === "weekly" && (!Number.isInteger(Number(habit.quota)) || Number(habit.quota) < 1 || Number(habit.quota) > 7)) return false;
    ids.add(habit.id);
    habitIds.add(habit.id);
  }
  for (const [id, dates] of Object.entries(value.completions)) {
    if (!habitIds.has(id) || !Array.isArray(dates) || !dates.every(sameDateValid)) return false;
  }
  return true;
}
function exportData() {
  const file = new Blob([JSON.stringify({ version: 1, ...state }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = `tick-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  announce("Your data export is ready.");
}
async function importData(file) {
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("This file is larger than 5 MB.");
    const parsed = JSON.parse(await file.text());
    if (!parsed || parsed.version !== 1 || !isValidData(parsed)) throw new Error("This file does not look like a Tick backup.");
    if (!window.confirm("Replace all current goals, habits, and completion history with this backup?")) return;
    state = stripSampleEntries({ goals: parsed.goals, habits: parsed.habits, completions: parsed.completions }).data;
    saveData(); render(); announce("Backup imported.");
  } catch (error) {
    window.alert(error instanceof SyntaxError ? "That file is not valid JSON." : error.message || "Could not import this file.");
  } finally { $("#import-file").value = ""; }
}

document.addEventListener("click", event => {
  const target = event.target.closest("button, [data-action], .chart-day-group, .goal-chart-row");
  if (!target) return;
  if (target.matches(".nav-tab")) {
    activeSection = target.dataset.section;
    render();
    return;
  }
  if (target.matches(".goal-chart-row")) {
    const goalCard = document.getElementById(`goal-${target.dataset.goalChartTarget}`);
    goalCard?.scrollIntoView({ behavior: "smooth", block: "center" });
    goalCard?.classList.add("goal-highlight");
    window.setTimeout(() => goalCard?.classList.remove("goal-highlight"), 900);
    return;
  }
  if (target.id === "theme-toggle") {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    return;
  }
  if (target.id === "add-goal" || target.id === "add-goal-empty") { openEditor("goal"); return; }
  if (target.id === "add-habit" || target.id === "add-habit-empty") { openEditor("habit"); return; }
  if (target.matches(".close-dialog")) { $("#editor-dialog").close(); return; }
  if (target.id === "add-subtask-draft") { addDraftSubtask(); return; }
  if (target.id === "export-data") { exportData(); return; }
  if (target.id === "import-trigger") { $("#import-file").click(); return; }
  if (target.hasAttribute("data-date-step")) {
    selectedDate = shiftDate(selectedDate, Number(target.dataset.dateStep)); render(); return;
  }
  if (target.id === "today-button") { selectedDate = today(); render(); return; }
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (action === "goal-edit") openEditor("goal", id);
  else if (action === "goal-delete") { const goal = state.goals.find(item => item.id === id); if (goal) removeGoal(goal); }
  else if (action === "goal-check") {
    const goal = state.goals.find(item => item.id === target.dataset.goalId);
    const subtask = goal?.subtasks.find(item => item.id === id);
    if (subtask) { subtask.done = !subtask.done; saveData(); render(); announce(`${subtask.title} ${subtask.done ? "completed" : "marked incomplete"}.`); }
  } else if (action === "goal-subtask-delete") {
    const goal = state.goals.find(item => item.id === target.dataset.goalId);
    if (goal) { goal.subtasks = goal.subtasks.filter(item => item.id !== id); saveData(); render(); announce("Step removed."); }
  } else if (action === "habit-edit") openEditor("habit", id);
  else if (action === "habit-delete") { const habit = state.habits.find(item => item.id === id); if (habit) removeHabit(habit); }
  else if (action === "habit-check") toggleCompletion(id, selectedDate);
  else if (action === "draft-subtask-remove") {
    draftSubtasks.splice(Number(target.dataset.index), 1); renderDraftSubtasks();
  } else if (action === "chart-day") {
    selectedDate = target.dataset.date; activeSection = "daily"; render();
  }
});
document.addEventListener("keydown", event => {
  const goalChartRow = event.target.closest?.(".goal-chart-row");
  if (goalChartRow && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    goalChartRow.click();
    return;
  }
  const chart = event.target.closest?.(".chart-day-group");
  if (chart && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectedDate = chart.dataset.date; activeSection = "daily"; render(); }
  if (event.target.id === "subtask-input" && event.key === "Enter") { event.preventDefault(); addDraftSubtask(); }
});
$("#editor-form").addEventListener("submit", handleSubmit);
$("#editor-form").addEventListener("input", event => {
  if (event.target.id === "duration" || event.target.id === "start-date") updateDurationPreview();
  if (event.target.matches("[data-draft-index]")) draftSubtasks[Number(event.target.dataset.draftIndex)].title = event.target.value.trim();
});
$("#editor-form").addEventListener("change", event => {
  if (event.target.id === "frequency") {
    $("#quota-field").hidden = event.target.value !== "weekly";
    updateDurationPreview();
  }
  if (event.target.id === "quota" || event.target.id === "duration-unit") updateDurationPreview();
});
$("#import-file").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) importData(file);
});
$("#editor-dialog").addEventListener("click", event => {
  if (event.target === $("#editor-dialog")) $("#editor-dialog").close();
});
render();
