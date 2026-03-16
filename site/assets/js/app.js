(() => {
  const API_STATE_URL = "/api/state";
  const API_CALENDAR_EVENTS_URL = "/api/calendar-events";
  const API_CALENDAR_FEED_URL = "/api/calendar-feed";
  const POLL_INTERVAL_MS = 4000;
  const currentView = document.body.dataset.view || "board";

  const DEFAULT_TEAMS = [
    "BUH",
    "Process Improvement",
    "Sales",
    "OKR",
    "Product",
    "Projects",
  ];

  const TEAM_COLORS = {
    BUH: ["#3b82f6", "rgba(59,130,246,.18)"],
    "Process Improvement": ["#10b981", "rgba(16,185,129,.18)"],
    Sales: ["#f59e0b", "rgba(245,158,11,.18)"],
    OKR: ["#ef4444", "rgba(239,68,68,.18)"],
    Product: ["#8b5cf6", "rgba(139,92,246,.18)"],
    Projects: ["#06b6d4", "rgba(6,182,212,.18)"],
  };

  const STATUS_SORT = { "Not started": 0, "In development": 1, Done: 2 };
  const MODE_SORT = { Change: 0, Run: 1, "": 2 };
  const OWNER_SORT = { Me: 0, Delegate: 1, "": 2 };
  const PRIORITY_SORT = { Must: 0, Should: 1, Could: 2, "Needs refinement": 3, "": 4 };
  const TIME_SORT = { "<5m": 0, "15m": 1, "30m": 2, "1h": 3, "2h+": 4, "": 5 };
  const WEEK_HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

  const state = {
    dragId: null,
    dragTeam: null,
    weekDragTaskId: null,
    weekDraftSlot: null,
    delegatableMode: false,
    focusMode: false,
    isReloading: false,
    lastModified: "",
    loadingWeekEvents: false,
    saveChain: Promise.resolve(),
    showDone: false,
    smartSort: false,
    sortCol: "",
    sortDir: 1,
    calendarFeedUrl: "",
    goals: [],
    tasks: [],
    teams: [...DEFAULT_TEAMS],
    weekEvents: [],
    weekEventsKey: "",
    weekStart: "",
  };

  const els = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.btnAddGoal = byId("btnAddGoal");
    els.btnAddTask = byId("btnAddTask");
    els.btnAddTeam = byId("btnAddTeam");
    els.btnCancelGoal = byId("btnCancelGoal");
    els.btnCancelTeam = byId("btnCancelTeam");
    els.btnConfirmGoal = byId("btnConfirmGoal");
    els.btnConfirmTeam = byId("btnConfirmTeam");
    els.btnConfirmWeekTask = byId("btnConfirmWeekTask");
    els.btnDelegatable = byId("btnDelegatable");
    els.btnDone = byId("btnDone");
    els.btnFocus = byId("btnFocus");
    els.btnSmart = byId("btnSmart");
    els.btnExport = byId("btnExport");
    els.btnImport = byId("btnImport");
    els.csvIn = byId("csvIn");
    els.fMode = byId("fMode");
    els.fOwner = byId("fOwner");
    els.fTime = byId("fTime");
    els.fSearch = byId("fSearch");
    els.fStatus = byId("fStatus");
    els.fTeam = byId("fTeam");
    els.goalOverlay = byId("goalOverlay");
    els.goalList = byId("goalList");
    els.insertRail = byId("insertRail");
    els.newGoalInput = byId("newGoalInput");
    els.newTeamInput = byId("newTeamInput");
    els.weekTaskInput = byId("weekTaskInput");
    els.weekTaskOverlay = byId("weekTaskOverlay");
    els.weekTaskSlotLabel = byId("weekTaskSlotLabel");
    els.btnCancelWeekTask = byId("btnCancelWeekTask");
    els.statsLine = byId("statsLine");
    els.tbody = byId("tbody");
    els.teamOverlay = byId("teamOverlay");
    els.toast = byId("toast");
    els.btnWeekNext = byId("btnWeekNext");
    els.btnWeekPrev = byId("btnWeekPrev");
    els.btnWeekToday = byId("btnWeekToday");
    els.btnSaveCalendarFeed = byId("btnSaveCalendarFeed");
    els.calendarFeedInput = byId("calendarFeedInput");
    els.calendarFeedStatus = byId("calendarFeedStatus");
    els.weekBacklog = byId("weekBacklog");
    els.weekBacklogCount = byId("weekBacklogCount");
    els.weekCalendar = byId("weekCalendar");
    els.weekLabel = byId("weekLabel");
  }

  function bind(element, eventName, handler) {
    if (element) {
      element.addEventListener(eventName, handler);
    }
  }

  function wireUi() {
    bind(els.btnAddGoal, "click", openGoalDialog);
    bind(els.btnAddTask, "click", addRow);
    bind(els.btnAddTeam, "click", openTeamDialog);
    bind(els.btnCancelGoal, "click", closeGoalDialog);
    bind(els.btnCancelTeam, "click", closeTeamDialog);
    bind(els.btnCancelWeekTask, "click", closeWeekTaskDialog);
    bind(els.btnConfirmGoal, "click", confirmGoal);
    bind(els.btnConfirmTeam, "click", confirmTeam);
    bind(els.btnConfirmWeekTask, "click", confirmWeekTask);
    bind(els.btnDelegatable, "click", toggleDelegatableMode);
    bind(els.btnDone, "click", toggleDone);
    bind(els.btnFocus, "click", toggleFocusMode);
    bind(els.btnSmart, "click", toggleSmartSort);
    bind(els.btnWeekPrev, "click", () => shiftWeek(-7));
    bind(els.btnWeekToday, "click", resetWeekToToday);
    bind(els.btnWeekNext, "click", () => shiftWeek(7));
    bind(els.btnSaveCalendarFeed, "click", saveCalendarFeed);
    bind(els.btnExport, "click", exportCSV);
    bind(els.btnImport, "click", () => els.csvIn?.click());
    bind(els.csvIn, "change", importCSV);
    bind(els.fMode, "change", renderCurrentView);
    bind(els.fOwner, "change", renderCurrentView);
    bind(els.fTime, "change", renderCurrentView);
    bind(els.fSearch, "input", renderCurrentView);
    bind(els.fStatus, "change", renderCurrentView);
    bind(els.fTeam, "change", renderCurrentView);
    bind(els.teamOverlay, "click", (event) => {
      if (event.target === els.teamOverlay) {
        closeTeamDialog();
      }
    });
    bind(els.goalOverlay, "click", (event) => {
      if (event.target === els.goalOverlay) {
        closeGoalDialog();
      }
    });
    bind(els.weekTaskOverlay, "click", (event) => {
      if (event.target === els.weekTaskOverlay) {
        closeWeekTaskDialog();
      }
    });
    bind(els.newGoalInput, "keydown", (event) => {
      if (event.key === "Enter") {
        confirmGoal();
      }
    });
    bind(els.newTeamInput, "keydown", (event) => {
      if (event.key === "Enter") {
        confirmTeam();
      }
    });
    bind(els.weekTaskInput, "keydown", (event) => {
      if (event.key === "Enter") {
        confirmWeekTask();
      }
    });
    window.addEventListener("resize", () => {
      if (currentView === "board") {
        renderInsertRail();
      }
    });

    document.querySelectorAll("th[data-sort]").forEach((header) => {
      header.addEventListener("click", () => sortBy(header.dataset.sort));
    });
  }

  function teamColor(team) {
    return TEAM_COLORS[team] || ["#a78bfa", "rgba(167,139,250,.18)"];
  }

  async function requestState(method, body) {
    const response = await fetch(API_STATE_URL, {
      method,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const lastModified = response.headers.get("Last-Modified");
    if (lastModified) {
      state.lastModified = lastModified;
    }

    return response;
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  async function loadData({ showReloadToast = false } = {}) {
    state.isReloading = true;

    try {
      const response = await requestState("GET");
      const payload = await response.json();
      state.tasks = normalizeTasks(payload.tasks || []);
      state.teams = normalizeTeams(payload.teams || [], state.tasks);
      state.goals = normalizeGoals(payload.goals || [], state.tasks);
      state.calendarFeedUrl = String(payload.settings?.calendar_feed_url || "").trim();
      syncTeamsFromTasks();
      if (els.fTeam) {
        rebuildTeamFilter();
      }
      if (els.calendarFeedInput) {
        els.calendarFeedInput.value = state.calendarFeedUrl;
      }
      updateCalendarFeedStatus();

      if (showReloadToast) {
        toast("Reloaded tasks from database");
      }
    } catch (error) {
      console.error(error);
      toast("Could not load tasks");
    } finally {
      state.isReloading = false;
    }
  }

  function normalizeTasks(tasks) {
    return tasks
      .map((task, index) => ({
        id: Number(task.id) || index + 1,
        name: String(task.name || "").trim(),
        status: String(task.status || "Not started").trim() || "Not started",
        team: String(task.team || "").trim(),
        mode: normalizeMode(task.mode),
        owner: normalizeOwner(task.owner),
        priority: normalizePriority(task.priority),
        time_estimate: normalizeTimeEstimate(task.time_estimate),
        goal: String(task.goal || "").trim(),
        deadline: String(task.deadline || "").trim(),
        scheduled_date: normalizeIsoDate(task.scheduled_date),
        scheduled_hour: normalizeScheduledHour(task.scheduled_hour),
        created_at: normalizeCreatedAt(task.created_at, task.id),
        completed_at: normalizeCompletedAt(task.completed_at, task.status),
        notes: String(task.notes || "").trim(),
      }))
      .filter((task) => task.name);
  }

  function syncTeamsFromTasks() {
    state.teams = normalizeTeams(state.teams, state.tasks);
    state.goals = normalizeGoals(state.goals, state.tasks);
  }

  function normalizeTeams(teams, tasks) {
    const ordered = [];
    const seen = new Set();

    (teams || []).forEach((team) => {
      const name = String(team || "").trim();
      if (!name || seen.has(name)) {
        return;
      }
      seen.add(name);
      ordered.push(name);
    });

    (tasks || []).forEach((task) => {
      const name = String(task.team || "").trim();
      if (!name || seen.has(name)) {
        return;
      }
      seen.add(name);
      ordered.push(name);
    });

    DEFAULT_TEAMS.forEach((team) => {
      if (seen.has(team)) {
        return;
      }
      seen.add(team);
      ordered.push(team);
    });

    return ordered;
  }

  function normalizeGoals(goals, tasks) {
    const ordered = [];
    const seen = new Set();

    (goals || []).forEach((goal) => {
      const name = String(goal || "").trim();
      if (!name || seen.has(name)) {
        return;
      }
      seen.add(name);
      ordered.push(name);
    });

    (tasks || []).forEach((task) => {
      const name = String(task.goal || "").trim();
      if (!name || seen.has(name)) {
        return;
      }
      seen.add(name);
      ordered.push(name);
    });

    return ordered;
  }

  function normalizeMode(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "run") {
      return "Run";
    }
    if (raw === "change") {
      return "Change";
    }
    return "";
  }

  function normalizeOwner(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (["me", "self"].includes(raw)) {
      return "Me";
    }
    if (["delegate", "delegated"].includes(raw)) {
      return "Delegate";
    }
    return "";
  }

  function normalizeTimeEstimate(value) {
    const raw = String(value || "").trim();
    return ["<5m", "15m", "30m", "1h", "2h+"].includes(raw) ? raw : "";
  }

  function normalizePriority(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (["must", "p1", "critical"].includes(raw)) {
      return "Must";
    }
    if (["should", "p2"].includes(raw)) {
      return "Should";
    }
    if (["could", "p3"].includes(raw)) {
      return "Could";
    }
    if (["needs refinement", "refine", "thought", "idea", "draft", "clarify"].includes(raw)) {
      return "Needs refinement";
    }
    return "";
  }

  function toLocalIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeCreatedAt(value, taskId = null) {
    const raw = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    const numericId = Number(taskId);
    if (Number.isFinite(numericId) && numericId >= 10 ** 11) {
      const date = new Date(numericId);
      if (!Number.isNaN(date.getTime())) {
        return toLocalIsoDate(date);
      }
    }

    return toLocalIsoDate(new Date());
  }

  function normalizeIsoDate(value) {
    const raw = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  }

  function normalizeScheduledHour(value) {
    const raw = String(value || "").trim();
    return WEEK_HOURS.includes(raw) ? raw : "";
  }

  function normalizeCompletedAt(value, status) {
    if (status !== "Done") {
      return "";
    }

    const raw = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  }

  function nextCompletedAt(currentValue, previousStatus, nextStatus) {
    if (nextStatus !== "Done") {
      return "";
    }

    const normalized = normalizeCompletedAt(currentValue, nextStatus);
    if (normalized) {
      return normalized;
    }

    return previousStatus === "Done" ? "" : toLocalIsoDate(new Date());
  }

  function parseCSVToTasks(csv) {
    const lines = csv.trim().split(/\r?\n/);
    if (!lines.length) {
      return [];
    }

    const header = parseCSVLine(lines[0].replace(/^\uFEFF/, ""));
    return lines
      .slice(1)
      .map((line, index) => {
        const values = parseCSVLine(line);
        const task = { id: Date.now() + index };

        header.forEach((column, headerIndex) => {
          task[column.toLowerCase().trim()] = (values[headerIndex] || "").trim();
        });

        task.name = task.name || task.title || "";
        task.status = task.status || "Not started";
        task.team = task.area || task.team || "";
        task.mode = normalizeMode(task.mode);
        task.owner = normalizeOwner(task.owner);
        task.priority = normalizePriority(task.priority);
        task.time_estimate = normalizeTimeEstimate(
          task.effort || task.time || task.time_estimate || task.estimate,
        );
        task.goal = task.goal || "";
        task.deadline = task.deadline || "";
        task.scheduled_date = normalizeIsoDate(task.scheduled_date);
        task.scheduled_hour = normalizeScheduledHour(task.scheduled_hour);
        task.created_at = normalizeCreatedAt(task.created || task.created_at, task.id);
        task.completed_at = normalizeCompletedAt(
          task.completed || task.completed_at,
          task.status,
        );
        task.notes = task.notes || task.description || "";
        return task;
      })
      .filter((task) => task.name);
  }

  function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const nextCharacter = line[index + 1];

      if (character === '"') {
        if (inQuotes && nextCharacter === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (character === "," && !inQuotes) {
        result.push(current);
        current = "";
        continue;
      }

      current += character;
    }

    result.push(current);
    return result;
  }

  function tasksToCSV(tasks) {
    const header = [
      "Name",
      "Status",
      "Area",
      "Mode",
      "Owner",
      "Priority",
      "Effort",
      "Goal",
      "Due",
      "Scheduled Date",
      "Scheduled Hour",
      "Created",
      "Completed",
      "Notes",
    ];
    const rows = tasks.map((task) =>
      [
        csvCell(task.name),
        csvCell(task.status),
        csvCell(task.team),
        csvCell(task.mode),
        csvCell(task.owner),
        csvCell(task.priority),
        csvCell(task.time_estimate),
        csvCell(task.goal),
        csvCell(task.deadline),
        csvCell(task.scheduled_date),
        csvCell(task.scheduled_hour),
        csvCell(task.created_at),
        csvCell(task.completed_at),
        csvCell(task.notes),
      ].join(","),
    );

    return `${header.join(",")}\n${rows.join("\n")}`;
  }

  function csvCell(value) {
    const stringValue = String(value || "");
    if (/[,"\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  function saveTasks({ message } = {}) {
    const payload = {
      teams: [...state.teams],
      goals: [...state.goals],
      tasks: state.tasks.map((task) => ({
        id: Number(task.id) || null,
        name: task.name,
        status: task.status,
        team: task.team,
        mode: task.mode,
        owner: task.owner,
        priority: task.priority,
        time_estimate: task.time_estimate,
        goal: task.goal,
        deadline: task.deadline,
        scheduled_date: task.scheduled_date,
        scheduled_hour: task.scheduled_hour,
        created_at: task.created_at,
        completed_at: task.completed_at,
        notes: task.notes,
      })),
    };

    const performSave = async () => {
      await requestState("PUT", payload);
      if (message) {
        toast(message);
      }
    };

    const nextSave = state.saveChain.then(performSave, performSave);
    state.saveChain = nextSave.catch((error) => {
      console.error(error);
      toast("Save failed");
    });
    return nextSave;
  }

  function exportCSV() {
    const blob = new Blob([tasksToCSV(state.tasks)], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tasks.csv";
    link.click();
    toast("CSV exported");
  }

  function importCSV(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      state.tasks = normalizeTasks(parseCSVToTasks(loadEvent.target.result));
      syncTeamsFromTasks();
      rebuildTeamFilter();
      renderCurrentView();
      await saveTasks({ message: `Imported ${state.tasks.length} tasks` });
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function rebuildTeamFilter() {
    if (!els.fTeam) {
      return;
    }

    const selectedTeam = els.fTeam.value;
    els.fTeam.innerHTML = '<option value="">All areas</option>';

    state.teams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team;
      option.textContent = team;
      els.fTeam.appendChild(option);
    });

    if (selectedTeam) {
      els.fTeam.value = selectedTeam;
    }
  }

  function toggleTeamFilter(team) {
    if (!team || !els.fTeam) {
      return;
    }

    els.fTeam.value = els.fTeam.value === team ? "" : team;
    renderCurrentView();
  }

  function openTeamDialog() {
    if (!els.teamOverlay || !els.newTeamInput) {
      return;
    }

    els.teamOverlay.classList.add("open");
    els.newTeamInput.focus();
  }

  function openGoalDialog() {
    if (!els.goalOverlay || !els.newGoalInput) {
      return;
    }

    els.goalOverlay.classList.add("open");
    els.newGoalInput.focus();
  }

  function closeTeamDialog() {
    if (!els.teamOverlay || !els.newTeamInput) {
      return;
    }

    els.teamOverlay.classList.remove("open");
    els.newTeamInput.value = "";
  }

  function closeGoalDialog() {
    if (!els.goalOverlay || !els.newGoalInput) {
      return;
    }

    els.goalOverlay.classList.remove("open");
    els.newGoalInput.value = "";
  }

  function openWeekTaskDialog(isoDate, hour) {
    if (!els.weekTaskOverlay || !els.weekTaskInput) {
      return;
    }

    state.weekDraftSlot = { isoDate, hour };
    if (els.weekTaskSlotLabel) {
      els.weekTaskSlotLabel.textContent = `${formatWeekday(isoDate)}, ${formatDayShort(isoDate)} at ${hour}`;
    }
    els.weekTaskOverlay.classList.add("open");
    els.weekTaskInput.value = "";
    els.weekTaskInput.focus();
  }

  function closeWeekTaskDialog() {
    if (!els.weekTaskOverlay || !els.weekTaskInput) {
      return;
    }

    els.weekTaskOverlay.classList.remove("open");
    els.weekTaskInput.value = "";
    state.weekDraftSlot = null;
  }

  function confirmTeam() {
    const value = els.newTeamInput.value.trim();
    if (!value) {
      return;
    }

    if (!state.teams.includes(value)) {
      state.teams.push(value);
      rebuildTeamFilter();
      void saveTasks({ message: "Area added" });
      renderCurrentView();
    }

    closeTeamDialog();
  }

  function confirmGoal() {
    const value = els.newGoalInput.value.trim();
    if (!value) {
      return;
    }

    if (!state.goals.includes(value)) {
      state.goals.push(value);
      void saveTasks({ message: "Goal added" });
      renderCurrentView();
    }

    closeGoalDialog();
  }

  function confirmWeekTask() {
    const name = String(els.weekTaskInput?.value || "").trim();
    const slot = state.weekDraftSlot;
    if (!name || !slot) {
      return;
    }

    const task = buildTaskDraft({
      name,
      scheduled_date: slot.isoDate,
      scheduled_hour: slot.hour,
    });

    state.tasks.unshift(task);
    syncTeamsFromTasks();
    rebuildTeamFilter();
    closeWeekTaskDialog();
    void saveTasks({ message: "Task added to week" });
    renderCurrentView();
  }

  function sortBy(column) {
    state.delegatableMode = false;
    els.btnDelegatable.classList.remove("is-active");
    state.focusMode = false;
    els.btnFocus.classList.remove("is-active");
    state.smartSort = false;
    els.btnSmart.classList.remove("is-active");

    if (state.sortCol === column) {
      state.sortDir *= -1;
    } else {
      state.sortCol = column;
      state.sortDir = 1;
    }

    updateSortIndicators(column);
    renderCurrentView();
  }

  function updateSortIndicators(activeColumn = state.sortCol) {
    document.querySelectorAll(".sort-arrow").forEach((arrow) => {
      arrow.textContent = "";
    });
    document.querySelectorAll("thead th").forEach((header) => {
      header.classList.remove("sorted");
    });

    const arrow = byId(`sa-${activeColumn}`);
    if (arrow) {
      arrow.textContent = state.sortDir === 1 ? " ↑" : " ↓";
    }

    const activeHeader = document.querySelector(`th[data-sort="${activeColumn}"]`);
    if (activeHeader) {
      activeHeader.classList.add("sorted");
    }
  }

  function toggleSmartSort() {
    state.delegatableMode = false;
    els.btnDelegatable.classList.remove("is-active");
    state.focusMode = false;
    els.btnFocus.classList.remove("is-active");
    state.smartSort = !state.smartSort;
    els.btnSmart.classList.toggle("is-active", state.smartSort);

    if (state.smartSort) {
      state.sortCol = "";
      state.sortDir = 1;
      updateSortIndicators();
    }

    renderCurrentView();
  }

  function toggleFocusMode() {
    state.delegatableMode = false;
    els.btnDelegatable.classList.remove("is-active");
    state.focusMode = !state.focusMode;
    els.btnFocus.classList.toggle("is-active", state.focusMode);

    if (state.focusMode) {
      state.smartSort = false;
      els.btnSmart.classList.remove("is-active");
      state.sortCol = "";
      state.sortDir = 1;
      updateSortIndicators();
    }

    renderCurrentView();
  }

  function toggleDelegatableMode() {
    state.delegatableMode = !state.delegatableMode;
    els.btnDelegatable.classList.toggle("is-active", state.delegatableMode);

    if (state.delegatableMode) {
      state.focusMode = false;
      state.smartSort = false;
      els.btnFocus.classList.remove("is-active");
      els.btnSmart.classList.remove("is-active");
      state.sortCol = "";
      state.sortDir = 1;
      updateSortIndicators();
    }

    renderCurrentView();
  }

  function getFilteredTasks() {
    const filterTeam = els.fTeam.value;
    const filterStatus = els.fStatus.value;
    const filterMode = els.fMode.value;
    const filterOwner = els.fOwner.value;
    const filterTime = els.fTime.value;
    const query = els.fSearch.value.toLowerCase();

    let data = state.tasks.filter((task) => {
      if (!state.showDone && task.status === "Done") {
        return false;
      }
      if (filterTeam && task.team !== filterTeam) {
        return false;
      }
      if (filterStatus && task.status !== filterStatus) {
        return false;
      }
      if (filterMode && task.mode !== filterMode) {
        return false;
      }
      if (filterOwner && task.owner !== filterOwner) {
        return false;
      }
      if (filterTime && task.time_estimate !== filterTime) {
        return false;
      }
      if (
        query &&
        !task.name.toLowerCase().includes(query) &&
        !task.goal.toLowerCase().includes(query) &&
        !task.notes.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    if (state.delegatableMode) {
      return buildDelegatableList(data);
    }

    if (state.focusMode) {
      return buildFocusList(data);
    }

    if (state.smartSort) {
      return [...data].sort(compareSmartTasks);
    }

    if (!state.sortCol) {
      return [...data].sort(
        (left, right) =>
          (STATUS_SORT[left.status] ?? 0) - (STATUS_SORT[right.status] ?? 0),
      );
    }

    data = [...data].sort((left, right) => {
      if (state.sortCol === "mode") {
        return ((MODE_SORT[left.mode] ?? 2) - (MODE_SORT[right.mode] ?? 2)) * state.sortDir;
      }

      if (state.sortCol === "owner") {
        return (
          ((OWNER_SORT[left.owner] ?? 2) - (OWNER_SORT[right.owner] ?? 2)) * state.sortDir
        );
      }

      if (state.sortCol === "priority") {
        return (
          ((PRIORITY_SORT[left.priority] ?? 4) - (PRIORITY_SORT[right.priority] ?? 4)) *
          state.sortDir
        );
      }

      if (state.sortCol === "time_estimate") {
        return (
          ((TIME_SORT[left.time_estimate] ?? 5) - (TIME_SORT[right.time_estimate] ?? 5)) *
          state.sortDir
        );
      }

      if (state.sortCol === "status") {
        return (
          ((STATUS_SORT[left.status] ?? 0) - (STATUS_SORT[right.status] ?? 0)) * state.sortDir
        );
      }

      if (state.sortCol === "created_at") {
        const leftValue = left.created_at || "";
        const rightValue = right.created_at || "";
        if (leftValue < rightValue) {
          return -state.sortDir;
        }
        if (leftValue > rightValue) {
          return state.sortDir;
        }
        return 0;
      }

      const leftValue = String(left[state.sortCol] || "").toLowerCase();
      const rightValue = String(right[state.sortCol] || "").toLowerCase();
      if (leftValue < rightValue) {
        return -state.sortDir;
      }
      if (leftValue > rightValue) {
        return state.sortDir;
      }
      return 0;
    });

    return data;
  }

  function compareSmartTasks(left, right) {
    const scoreDiff = smartScore(right) - smartScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const dueDiff = compareDateStrings(left.deadline, right.deadline);
    if (dueDiff !== 0) {
      return dueDiff;
    }

    const createdDiff = compareDateStrings(left.created_at, right.created_at);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  }

  function buildFocusList(tasks) {
    const candidates = [...tasks].filter(isFocusBaseCandidate);
    const selected = [];
    const selectedIds = new Set();

    const pushTask = (task) => {
      if (selectedIds.has(task.id)) {
        return false;
      }
      selected.push(task);
      selectedIds.add(task.id);
      return true;
    };

    candidates
      .filter(isWeeklyFocusCommitment)
      .sort(compareFocusTasks)
      .forEach(pushTask);

    candidates
      .filter((task) => task.goal && task.priority === "Must" && task.deadline)
      .sort(compareFocusTasks)
      .forEach(pushTask);

    let goalCount = selected.filter(
      (task) => task.goal && task.priority !== "Could",
    ).length;
    if (goalCount < 7) {
      candidates
        .filter((task) => task.goal && task.priority !== "Could")
        .sort(compareFocusTasks)
        .forEach((task) => {
          if (goalCount >= 7) {
            return;
          }
          if (pushTask(task)) {
            goalCount += 1;
          }
        });
    }

    return selected;
  }

  function buildDelegatableList(tasks) {
    return [...tasks]
      .filter((task) => task.status !== "Done" && task.owner === "Delegate")
      .sort(compareDelegatableTasks);
  }

  function isFocusBaseCandidate(task) {
    if (task.status === "Done") {
      return false;
    }

    if (task.priority === "Needs refinement" && task.status !== "In development") {
      return false;
    }

    return true;
  }

  function isWeeklyFocusCommitment(task) {
    if (!["Must", "Should"].includes(task.priority)) {
      return false;
    }

    if (!task.deadline) {
      return false;
    }

    const diff = daysUntil(task.deadline);
    return diff !== null && diff <= 7;
  }

  function compareFocusTasks(left, right) {
    const scoreDiff = focusScore(right) - focusScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const dueDiff = compareDateStrings(left.deadline, right.deadline);
    if (dueDiff !== 0) {
      return dueDiff;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  }

  function compareDelegatableTasks(left, right) {
    const scoreDiff = delegatableScore(right) - delegatableScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const dueDiff = compareDateStrings(left.deadline, right.deadline);
    if (dueDiff !== 0) {
      return dueDiff;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  }

  function focusScore(task) {
    let score = 0;

    if (task.status === "In development") {
      score += 45;
    } else if (task.status === "Not started") {
      score += 10;
    }

    if (task.mode === "Change") {
      score += 24;
    } else if (task.mode === "Run") {
      score += 14;
    }

    if (task.owner === "Me") {
      score += 16;
    } else if (task.owner === "Delegate") {
      score -= 20;
    }

    score += priorityScore(task.priority);
    score += Math.max(dueScore(task.deadline), 0);
    score += focusEffortScore(task.time_estimate);

    if (task.goal) {
      score += 12;
    }

    if (task.mode === "Run" && !task.deadline) {
      score -= 6;
    }

    if (task.mode === "Change" && !task.goal) {
      score -= 4;
    }

    return score;
  }

  function focusEffortScore(timeEstimate) {
    if (timeEstimate === "30m") {
      return 10;
    }
    if (timeEstimate === "15m") {
      return 8;
    }
    if (timeEstimate === "1h") {
      return 7;
    }
    if (timeEstimate === "<5m") {
      return 5;
    }
    if (timeEstimate === "2h+") {
      return 0;
    }
    return -2;
  }

  function delegatableScore(task) {
    let score = 0;

    if (task.status === "In development") {
      score += 35;
    }

    score += Math.max(dueScore(task.deadline), 0);
    score += timeScore(task.time_estimate);

    if (task.mode === "Run") {
      score += 12;
    } else if (task.mode === "Change") {
      score += 6;
    }

    if (task.goal) {
      score += 4;
    }

    return score;
  }

  function smartScore(task) {
    let score = 0;

    if (task.status === "In development") {
      score += 40;
    } else if (task.status === "Not started") {
      score += 18;
    } else if (task.status === "Done") {
      score -= 80;
    }

    if (task.mode === "Change") {
      score += 18;
    } else if (task.mode === "Run") {
      score += 14;
    } else {
      score -= 8;
    }

    if (task.owner === "Me") {
      score += 10;
    } else if (task.owner === "Delegate") {
      score -= 4;
    } else {
      score -= 6;
    }

    score += priorityScore(task.priority);
    score += timeScore(task.time_estimate);
    score += dueScore(task.deadline);
    if (task.goal) {
      score += 8;
    }

    if (!task.team) {
      score -= 3;
    }

    const knownCoreSignals = [
      task.mode,
      task.owner,
      task.priority,
      task.time_estimate,
      task.goal,
      task.deadline,
    ].filter(Boolean).length;
    if (knownCoreSignals <= 1) {
      score -= 16;
    }

    return score;
  }

  function timeScore(timeEstimate) {
    if (timeEstimate === "<5m") {
      return 34;
    }
    if (timeEstimate === "15m") {
      return 16;
    }
    if (timeEstimate === "30m") {
      return 9;
    }
    if (timeEstimate === "1h") {
      return 2;
    }
    if (timeEstimate === "2h+") {
      return -2;
    }
    return -6;
  }

  function priorityScore(priority) {
    if (priority === "Must") {
      return 28;
    }
    if (priority === "Should") {
      return 14;
    }
    if (priority === "Could") {
      return 4;
    }
    if (priority === "Needs refinement") {
      return -42;
    }
    return -3;
  }

  function dueScore(deadline) {
    if (!deadline) {
      return -2;
    }

    const diff = daysUntil(deadline);
    if (diff === null) {
      return -2;
    }
    if (diff < 0) {
      return 20;
    }
    if (diff <= 1) {
      return 16;
    }
    if (diff <= 3) {
      return 12;
    }
    if (diff <= 7) {
      return 7;
    }
    return 2;
  }

  function daysUntil(isoDate) {
    if (!isoDate) {
      return null;
    }

    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) {
      return null;
    }

    const target = new Date(year, month - 1, day);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((target.getTime() - startOfToday.getTime()) / 86400000);
  }

  function compareDateStrings(left, right) {
    const leftValue = left || "9999-12-31";
    const rightValue = right || "9999-12-31";
    if (leftValue < rightValue) {
      return -1;
    }
    if (leftValue > rightValue) {
      return 1;
    }
    return 0;
  }

  function toggleDone() {
    state.showDone = !state.showDone;
    els.btnDone.classList.toggle("is-active", state.showDone);
    els.btnDone.textContent = state.showDone ? "Hide done" : "Show done";
    renderTable();
  }

  function renderCurrentView() {
    if (currentView === "goals") {
      renderGoalsView();
      return;
    }

    if (currentView === "week") {
      renderWeekView();
      return;
    }

    renderTable();
  }

  function renderTable() {
    if (!els.tbody || !els.statsLine) {
      return;
    }

    const data = getFilteredTasks();
    els.statsLine.textContent = state.delegatableMode
      ? `Delegatable ${data.length} of ${state.tasks.length} tasks`
      : state.focusMode
        ? `Focus ${data.length} of ${state.tasks.length} tasks`
        : `${data.length} of ${state.tasks.length} tasks`;
    els.tbody.innerHTML = "";

    const knownTeams = state.teams.filter((team) => data.some((task) => task.team === team));
    const extraTeams = [
      ...new Set(data.map((task) => task.team).filter((team) => team && !state.teams.includes(team))),
    ];
    const hasNoTeam = data.some((task) => !task.team);
    const groupOrder = [...knownTeams, ...extraTeams, ...(hasNoTeam ? [""] : [])];

    groupOrder.forEach((teamName) => {
      const group = data.filter((task) => (task.team || "") === (teamName || ""));
      if (!group.length) {
        return;
      }

      els.tbody.appendChild(buildTeamHeader(teamName, group.length));
      group.forEach((task) => {
        els.tbody.appendChild(buildInsertRow(task.id, teamName));
        els.tbody.appendChild(buildRow(task));
      });
      els.tbody.appendChild(buildInsertRow(null, teamName));
    });

    renderInsertRail();
  }

  function renderGoalsView() {
    if (!els.goalList || !els.statsLine) {
      return;
    }

    els.goalList.replaceChildren();

    const goals = [...state.goals];
    const linkedTasks = state.tasks.filter((task) => task.goal);
    const openLinkedTasks = linkedTasks.filter((task) => task.status !== "Done");
    const unassignedTasks = state.tasks.filter((task) => !task.goal && task.status !== "Done");

    els.statsLine.textContent = `${goals.length} goals · ${openLinkedTasks.length} open linked tasks`;

    if (!goals.length && !unassignedTasks.length) {
      const empty = document.createElement("div");
      empty.className = "goal-empty";
      empty.textContent = "No goals yet. Add one to start structuring strategic work.";
      els.goalList.appendChild(empty);
      return;
    }

    goals.forEach((goalName) => {
      const goalTasks = state.tasks
        .filter((task) => task.goal === goalName)
        .sort(compareGoalTasks);
      els.goalList.appendChild(buildGoalCard(goalName, goalTasks));
    });

    if (unassignedTasks.length) {
      els.goalList.appendChild(buildGoalCard("", unassignedTasks.sort(compareGoalTasks), { unassigned: true }));
    }
  }

  function renderWeekView() {
    if (!els.weekCalendar || !els.weekBacklog || !els.statsLine || !els.weekLabel) {
      return;
    }

    const weekDates = getWeekDates(state.weekStart || getStartOfWeekIso(new Date()));
    const weekSet = new Set(weekDates);
    ensureWeekEventsLoaded(weekDates[0], weekDates.length);
    const openTasks = state.tasks.filter((task) => task.status !== "Done");
    const focusTasks = buildFocusList(openTasks);
    const scheduledThisWeek = openTasks.filter(
      (task) => weekSet.has(task.scheduled_date) && task.scheduled_hour,
    ).sort(compareWeekScheduledTasks);
    const backlogTasks = focusTasks
      .filter((task) => !weekSet.has(task.scheduled_date) || !task.scheduled_hour)
      .sort(compareWeekBacklogTasks);

    els.weekLabel.textContent = formatWeekLabel(weekDates);
    els.statsLine.textContent = `${focusTasks.length} focus tasks · ${scheduledThisWeek.length} scheduled · ${backlogTasks.length} still to place`;
    if (els.weekBacklogCount) {
      els.weekBacklogCount.textContent = `${backlogTasks.length} to place`;
    }

    renderWeekBacklog(backlogTasks);
    renderWeekCalendar(weekDates, scheduledThisWeek, state.weekEvents);
  }

  function renderWeekBacklog(tasks) {
    els.weekBacklog.replaceChildren();
    els.weekBacklog.ondragover = onWeekBacklogDragOver;
    els.weekBacklog.ondrop = onWeekBacklogDrop;

    if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "week-empty";
      empty.textContent = "Everything open is already placed into a slot.";
      els.weekBacklog.appendChild(empty);
      return;
    }

    tasks.forEach((task) => {
      els.weekBacklog.appendChild(buildWeekBacklogCard(task));
    });
  }

  function renderWeekCalendar(weekDates, tasks, externalEvents) {
    els.weekCalendar.replaceChildren();

    const headerCorner = document.createElement("div");
    headerCorner.className = "week-corner";
    headerCorner.textContent = "Time";
    els.weekCalendar.appendChild(headerCorner);

    weekDates.forEach((isoDate) => {
      const header = document.createElement("div");
      header.className = "week-day-header";
      header.innerHTML = `<strong>${formatWeekday(isoDate)}</strong><span>${formatDayShort(isoDate)}</span>`;
      els.weekCalendar.appendChild(header);
    });

    WEEK_HOURS.forEach((hour) => {
      const label = document.createElement("div");
      label.className = "week-hour-label";
      label.textContent = hour;
      els.weekCalendar.appendChild(label);

      weekDates.forEach((isoDate) => {
        const cell = document.createElement("div");
        cell.className = "week-slot";
        cell.dataset.date = isoDate;
        cell.dataset.hour = hour;
        cell.addEventListener("dragover", onWeekSlotDragOver);
        cell.addEventListener("drop", onWeekSlotDrop);
        cell.addEventListener("click", onWeekSlotClick);

        const cellTasks = tasks
          .filter((task) => task.scheduled_date === isoDate && task.scheduled_hour === hour)
          .sort(compareWeekScheduledTasks);
        const blockers = externalEvents.filter((event) =>
          eventBlockedInSlot(event, isoDate, hour),
        );

        if (!blockers.length && !cellTasks.length) {
          const empty = document.createElement("div");
          empty.className = "week-slot-empty";
          empty.textContent = "+";
          cell.appendChild(empty);
        } else {
          blockers.forEach((event) => {
            cell.appendChild(buildWeekBlocker(event));
          });
          cellTasks.forEach((task) => {
            cell.appendChild(buildWeekScheduledCard(task));
          });
        }

        els.weekCalendar.appendChild(cell);
      });
    });
  }

  function compareWeekBacklogTasks(left, right) {
    const leftFocus = buildFocusList([left]).length ? 1 : 0;
    const rightFocus = buildFocusList([right]).length ? 1 : 0;
    if (leftFocus !== rightFocus) {
      return rightFocus - leftFocus;
    }
    return compareSmartTasks(left, right);
  }

  function compareWeekScheduledTasks(left, right) {
    const priorityDiff = (PRIORITY_SORT[left.priority] ?? 4) - (PRIORITY_SORT[right.priority] ?? 4);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return compareSmartTasks(left, right);
  }

  function buildWeekBacklogCard(task) {
    const card = document.createElement("div");
    card.className = "week-task-card";
    card.draggable = true;
    card.addEventListener("dragstart", () => {
      state.weekDragTaskId = task.id;
    });
    card.addEventListener("dragend", () => {
      state.weekDragTaskId = null;
    });

    const title = document.createElement("div");
    title.className = "week-task-title";
    title.textContent = task.name;
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "week-task-meta";
    meta.innerHTML = [
      priorityBadge(task.priority),
      modeBadge(task.mode),
      goalBadge(task.goal),
      task.deadline ? `<span class="goal-due">Due ${formatDate(task.deadline)}</span>` : "",
    ].filter(Boolean).join("");
    card.appendChild(meta);

    return card;
  }

  function buildWeekScheduledCard(task) {
    const card = document.createElement("div");
    card.className = "week-scheduled-card";
    card.draggable = true;
    card.addEventListener("dragstart", () => {
      state.weekDragTaskId = task.id;
    });
    card.addEventListener("dragend", () => {
      state.weekDragTaskId = null;
    });

    const title = document.createElement("div");
    title.className = "week-task-title";
    title.textContent = task.name;
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "week-task-meta";
    meta.innerHTML = [
      priorityBadge(task.priority),
      modeBadge(task.mode),
      timeBadge(task.time_estimate),
    ].filter(Boolean).join("");
    card.appendChild(meta);

    const unschedule = document.createElement("button");
    unschedule.className = "week-unschedule-btn";
    unschedule.type = "button";
    unschedule.textContent = "×";
    unschedule.title = "Remove from week";
    unschedule.addEventListener("click", () => unscheduleTask(task.id));
    card.appendChild(unschedule);

    return card;
  }

  function buildWeekBlocker(event) {
    const blocker = document.createElement("div");
    blocker.className = "week-blocker";
    blocker.title = `${event.summary} (${formatCalendarTime(event.start, event.end, event.all_day === "true")})`;
    blocker.innerHTML = `<strong>${event.summary}</strong><span>${formatCalendarTime(
      event.start,
      event.end,
      event.all_day === "true",
    )}</span>`;
    return blocker;
  }

  function onWeekSlotDragOver(event) {
    event.preventDefault();
  }

  function onWeekSlotClick(event) {
    if (event.target !== event.currentTarget && !event.target.classList.contains("week-slot-empty")) {
      return;
    }

    const isoDate = event.currentTarget.dataset.date || "";
    const hour = event.currentTarget.dataset.hour || "";
    if (!isoDate || !hour) {
      return;
    }

    openWeekTaskDialog(isoDate, hour);
  }

  function onWeekSlotDrop(event) {
    event.preventDefault();
    if (!state.weekDragTaskId) {
      return;
    }

    const isoDate = event.currentTarget.dataset.date || "";
    const hour = event.currentTarget.dataset.hour || "";

    scheduleTask(
      state.weekDragTaskId,
      isoDate,
      hour,
    );
  }

  function onWeekBacklogDragOver(event) {
    event.preventDefault();
  }

  function onWeekBacklogDrop(event) {
    event.preventDefault();
    if (!state.weekDragTaskId) {
      return;
    }
    unscheduleTask(state.weekDragTaskId);
  }

  function scheduleTask(taskId, isoDate, hour) {
    const task = state.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }
    task.scheduled_date = isoDate;
    task.scheduled_hour = hour;
    state.weekDragTaskId = null;
    void saveTasks({ message: "Placed into week" });
    renderCurrentView();
  }

  function unscheduleTask(taskId) {
    const task = state.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }
    task.scheduled_date = "";
    task.scheduled_hour = "";
    state.weekDragTaskId = null;
    void saveTasks({ message: "Removed from week" });
    renderCurrentView();
  }

  function buildTaskDraft(overrides = {}) {
    const activeTeam = els.fTeam ? els.fTeam.value : "";
    return {
      id: Date.now(),
      name: "",
      status: "Not started",
      team: activeTeam,
      mode: "",
      owner: "",
      priority: "",
      time_estimate: "",
      goal: "",
      deadline: "",
      scheduled_date: "",
      scheduled_hour: "",
      created_at: toLocalIsoDate(new Date()),
      completed_at: "",
      notes: "",
      ...overrides,
    };
  }

  function shiftWeek(days) {
    const start = new Date(`${state.weekStart || getStartOfWeekIso(new Date())}T00:00:00`);
    start.setDate(start.getDate() + days);
    state.weekStart = getStartOfWeekIso(start);
    renderCurrentView();
  }

  function resetWeekToToday() {
    state.weekStart = getStartOfWeekIso(new Date());
    renderCurrentView();
  }

  function getStartOfWeekIso(date) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    return toLocalIsoDate(copy);
  }

  function getWeekDates(weekStart) {
    const start = new Date(`${weekStart}T00:00:00`);
    return Array.from({ length: 5 }, (_, index) => {
      const next = new Date(start);
      next.setDate(start.getDate() + index);
      return toLocalIsoDate(next);
    });
  }

  function formatWeekLabel(weekDates) {
    if (!weekDates.length) {
      return "";
    }
    const first = formatDate(weekDates[0]);
    const last = formatDate(weekDates[weekDates.length - 1]);
    return `${first} - ${last}`;
  }

  function updateCalendarFeedStatus(message = "") {
    if (!els.calendarFeedStatus) {
      return;
    }

    if (message) {
      els.calendarFeedStatus.textContent = message;
      return;
    }

    els.calendarFeedStatus.textContent = state.calendarFeedUrl
      ? "Calendar feed connected"
      : "No calendar feed connected";
  }

  async function saveCalendarFeed() {
    const nextUrl = String(els.calendarFeedInput?.value || "").trim();
    try {
      const response = await fetch(API_CALENDAR_FEED_URL, {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_url: nextUrl }),
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      state.calendarFeedUrl = nextUrl;
      state.weekEvents = [];
      state.weekEventsKey = "";
      updateCalendarFeedStatus("Calendar feed saved");
      renderCurrentView();
    } catch (error) {
      console.error(error);
      updateCalendarFeedStatus("Could not save calendar feed");
      toast("Save failed");
    }
  }

  function ensureWeekEventsLoaded(weekStart, days) {
    const key = `${weekStart}|${days}|${state.calendarFeedUrl}`;
    if (!state.calendarFeedUrl) {
      state.weekEvents = [];
      state.weekEventsKey = key;
      updateCalendarFeedStatus();
      return;
    }

    if (state.weekEventsKey === key || state.loadingWeekEvents) {
      return;
    }

    state.loadingWeekEvents = true;
    state.weekEventsKey = key;
    updateCalendarFeedStatus("Loading calendar blockers...");
    void requestJson(
      `${API_CALENDAR_EVENTS_URL}?start=${encodeURIComponent(weekStart)}&days=${days}`,
    )
      .then((payload) => {
        const events = Array.isArray(payload.events) ? payload.events : [];
        state.weekEvents = events.filter(
          (event) => event.all_day !== "true" && event.blocking !== "false",
        );
        updateCalendarFeedStatus(`Calendar feed connected · ${state.weekEvents.length} timed events this week`);
        renderCurrentView();
      })
      .catch((error) => {
        console.error(error);
        state.weekEvents = [];
        updateCalendarFeedStatus("Could not load calendar feed");
      })
      .finally(() => {
        state.loadingWeekEvents = false;
      });
  }

  function eventBlockedInSlot(event, isoDate, hour) {
    const slotStart = new Date(`${isoDate}T${hour}:00`);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(slotStart.getHours() + 1);

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) {
      return false;
    }

    return eventStart < slotEnd && eventEnd > slotStart;
  }

  function formatCalendarTime(start, end, allDay) {
    if (allDay) {
      return "All day";
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return "";
    }
    const formatOptions = { hour: "2-digit", minute: "2-digit" };
    return `${startDate.toLocaleTimeString("en-GB", formatOptions)}-${endDate.toLocaleTimeString("en-GB", formatOptions)}`;
  }

  function formatWeekday(isoDate) {
    const date = new Date(`${isoDate}T00:00:00`);
    return date.toLocaleDateString("en-GB", { weekday: "short" });
  }

  function formatDayShort(isoDate) {
    const date = new Date(`${isoDate}T00:00:00`);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function compareGoalTasks(left, right) {
    const statusDiff = (STATUS_SORT[left.status] ?? 0) - (STATUS_SORT[right.status] ?? 0);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const dueDiff = compareDateStrings(left.deadline, right.deadline);
    if (dueDiff !== 0) {
      return dueDiff;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  }

  function buildGoalCard(goalName, tasks, { unassigned = false } = {}) {
    const card = document.createElement("section");
    card.className = "goal-card";

    const header = document.createElement("div");
    header.className = "goal-card-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "goal-card-title";
    title.textContent = goalName || "Unassigned work";
    titleWrap.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "goal-card-subtitle";
    if (unassigned) {
      subtitle.textContent = "Tasks not currently linked to a strategic goal.";
    } else if (tasks.length) {
      subtitle.textContent = summarizeGoalAreas(tasks);
    } else {
      subtitle.textContent = "No tasks linked yet.";
    }
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);

    if (!unassigned) {
      header.appendChild(buildGoalActions(goalName));
    }

    card.appendChild(header);
    card.appendChild(buildGoalStats(tasks));

    if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "goal-empty goal-empty-inline";
      empty.textContent = "No linked tasks yet.";
      card.appendChild(empty);
      return card;
    }

    const taskList = document.createElement("div");
    taskList.className = "goal-task-list";
    tasks.forEach((task) => {
      taskList.appendChild(buildGoalTaskRow(task));
    });
    card.appendChild(taskList);

    return card;
  }

  function buildGoalActions(goalName) {
    const actions = document.createElement("div");
    actions.className = "goal-card-actions";
    const goalIndex = state.goals.indexOf(goalName);

    const upButton = document.createElement("button");
    upButton.className = "btn-ghost goal-action-btn";
    upButton.type = "button";
    upButton.textContent = "↑";
    upButton.title = "Move goal up";
    upButton.disabled = goalIndex <= 0;
    upButton.addEventListener("click", () => moveGoal(goalName, -1));
    actions.appendChild(upButton);

    const downButton = document.createElement("button");
    downButton.className = "btn-ghost goal-action-btn";
    downButton.type = "button";
    downButton.textContent = "↓";
    downButton.title = "Move goal down";
    downButton.disabled = goalIndex === -1 || goalIndex >= state.goals.length - 1;
    downButton.addEventListener("click", () => moveGoal(goalName, 1));
    actions.appendChild(downButton);

    const renameButton = document.createElement("button");
    renameButton.className = "btn-ghost goal-action-btn";
    renameButton.type = "button";
    renameButton.textContent = "Rename";
    renameButton.addEventListener("click", () => renameGoal(goalName));
    actions.appendChild(renameButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "btn-danger goal-action-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteGoal(goalName));
    actions.appendChild(deleteButton);

    return actions;
  }

  function buildGoalStats(tasks) {
    const stats = document.createElement("div");
    stats.className = "goal-stats";

    const doneCount = tasks.filter((task) => task.status === "Done").length;
    const activeCount = tasks.filter((task) => task.status === "In development").length;
    const openCount = tasks.length - doneCount;

    [
      [`${tasks.length}`, "tasks"],
      [`${openCount}`, "open"],
      [`${activeCount}`, "in progress"],
      [`${doneCount}`, "done"],
    ].forEach(([value, label]) => {
      const stat = document.createElement("div");
      stat.className = "goal-stat";
      stat.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
      stats.appendChild(stat);
    });

    return stats;
  }

  function buildGoalTaskRow(task) {
    const row = document.createElement("div");
    row.className = "goal-task-row";

    const main = document.createElement("div");
    main.className = "goal-task-main";

    const name = document.createElement("div");
    name.className = "goal-task-name";
    name.textContent = task.name;
    main.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "goal-task-meta";
    meta.innerHTML = [
      statusBadge(task.status),
      teamBadgeHtml(task.team),
      modeBadge(task.mode),
      ownerBadge(task.owner),
      priorityBadge(task.priority),
      timeBadge(task.time_estimate),
      task.deadline ? `<span class="goal-due">Due ${formatDate(task.deadline)}</span>` : "",
    ]
      .filter(Boolean)
      .join("");
    main.appendChild(meta);

    row.appendChild(main);
    return row;
  }

  function summarizeGoalAreas(tasks) {
    const areas = [...new Set(tasks.map((task) => task.team).filter(Boolean))];
    if (!areas.length) {
      return "No linked areas yet.";
    }
    if (areas.length <= 3) {
      return areas.join(" · ");
    }
    return `${areas.slice(0, 3).join(" · ")} +${areas.length - 3}`;
  }

  function moveGoal(goalName, direction) {
    const fromIndex = state.goals.indexOf(goalName);
    const toIndex = fromIndex + direction;
    if (fromIndex === -1 || toIndex < 0 || toIndex >= state.goals.length) {
      return;
    }

    const reordered = [...state.goals];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, goalName);
    state.goals = reordered;
    void saveTasks({ message: "Goal order updated" });
    renderCurrentView();
  }

  function renameGoal(goalName) {
    const nextName = window.prompt("Rename goal", goalName)?.trim();
    if (!nextName || nextName === goalName) {
      return;
    }

    state.tasks.forEach((task) => {
      if (task.goal === goalName) {
        task.goal = nextName;
      }
    });

    const nextGoals = state.goals.map((goal) => (goal === goalName ? nextName : goal));
    state.goals = normalizeGoals(nextGoals, state.tasks);
    void saveTasks({ message: "Goal renamed" });
    renderCurrentView();
  }

  function deleteGoal(goalName) {
    const linkedCount = state.tasks.filter((task) => task.goal === goalName).length;
    const confirmed = window.confirm(
      linkedCount
        ? `Delete "${goalName}" and clear it from ${linkedCount} linked tasks?`
        : `Delete "${goalName}"?`,
    );
    if (!confirmed) {
      return;
    }

    state.tasks.forEach((task) => {
      if (task.goal === goalName) {
        task.goal = "";
      }
    });
    state.goals = state.goals.filter((goal) => goal !== goalName);
    void saveTasks({ message: "Goal deleted" });
    renderCurrentView();
  }

  function buildTeamHeader(teamName, count) {
    const row = document.createElement("tr");
    row.className = "team-header-row";
    row.dataset.team = teamName;
    row.draggable = true;
    row.addEventListener("dragstart", (event) => onTeamDragStart(event, teamName));
    row.addEventListener("dragend", onTeamDragEnd);
    row.addEventListener("dragover", (event) => onTeamDragOver(event, teamName));
    row.addEventListener("drop", (event) => onTeamDrop(event, teamName));

    const cell = document.createElement("td");
    const [color] = teamColor(teamName);
    const isActive = els.fTeam?.value === teamName;
    cell.colSpan = 12;
    cell.innerHTML = `<div class="team-header-inner" style="border-left-color:${color}">
      <span class="team-drag-handle">⠿</span>
      <button
        class="team-filter-btn${isActive ? " is-active" : ""}"
        type="button"
        style="--team-color:${color}"
      >
        <span class="team-header-label">${teamName || "— No area —"}</span>
        <span class="team-header-count">${count}</span>
      </button>
      ${teamName ? '<button class="team-action-btn" type="button" title="Rename area">Rename</button>' : ""}
    </div>`;
    const filterButton = cell.querySelector(".team-filter-btn");
    if (filterButton) {
      filterButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleTeamFilter(teamName);
      });
    }
    const actionButton = cell.querySelector(".team-action-btn");
    if (actionButton) {
      actionButton.addEventListener("click", (event) => {
        event.stopPropagation();
        renameArea(teamName);
      });
    }
    row.appendChild(cell);
    return row;
  }

  function renameArea(teamName) {
    if (!teamName) {
      return;
    }

    const nextName = window.prompt("Rename area", teamName)?.trim();
    if (!nextName || nextName === teamName) {
      return;
    }

    state.tasks.forEach((task) => {
      if (task.team === teamName) {
        task.team = nextName;
      }
    });

    state.teams = state.teams.map((team) => (team === teamName ? nextName : team));
    state.teams = normalizeTeams(state.teams, state.tasks);

    if (els.fTeam && els.fTeam.value === teamName) {
      els.fTeam.value = nextName;
    }

    rebuildTeamFilter();
    void saveTasks({ message: "Area renamed" });
    renderCurrentView();
  }

  function buildRow(task) {
    const row = document.createElement("tr");
    row.dataset.id = task.id;
    row.draggable = true;
    row.addEventListener("dragstart", (event) => onDragStart(event, task.id));
    row.addEventListener("dragend", onDragEnd);
    row.addEventListener("dragover", (event) => onDragOver(event, task.id));
    row.addEventListener("drop", (event) => onDrop(event, task.id));

    const dragCell = document.createElement("td");
    dragCell.className = "col-drag";
    dragCell.textContent = "⠿";
    row.appendChild(dragCell);

    row.appendChild(buildNameCell(task));
    row.appendChild(
      buildSelectCell(
        task,
        "status",
        "col-status",
        ["Not started", "In development", "Done"],
        () => statusBadge(task.status),
      ),
    );
    row.appendChild(
      buildSelectCell(task, "team", "col-team", ["", ...state.teams], () => teamBadgeHtml(task.team)),
    );
    row.appendChild(
      buildSelectCell(
        task,
        "mode",
        "col-mode",
        ["", "Run", "Change"],
        () => modeBadge(task.mode),
      ),
    );
    row.appendChild(
      buildSelectCell(task, "owner", "col-owner", ["", "Me", "Delegate"], () => ownerBadge(task.owner)),
    );
    row.appendChild(
      buildSelectCell(
        task,
        "priority",
        "col-priority",
        ["", "Must", "Should", "Could", "Needs refinement"],
        () => priorityBadge(task.priority),
      ),
    );
    row.appendChild(
      buildSelectCell(
        task,
        "time_estimate",
        "col-time",
        ["", "<5m", "15m", "30m", "1h", "2h+"],
        () => timeBadge(task.time_estimate),
      ),
    );
    row.appendChild(buildDeadlineCell(task));
    row.appendChild(
      buildSelectCell(task, "goal", "col-goal", ["", ...state.goals], () => goalBadge(task.goal)),
    );
    row.appendChild(buildEditableTextCell(task, "notes", "col-notes", task.notes));

    const deleteCell = document.createElement("td");
    deleteCell.className = "col-del";
    const deleteButton = document.createElement("button");
    deleteButton.className = "del-btn";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete";
    deleteButton.addEventListener("click", () => deleteRow(task.id));
    deleteCell.appendChild(deleteButton);
    row.appendChild(deleteCell);

    return row;
  }

  function buildInsertRow(targetTaskId, teamName) {
    const row = document.createElement("tr");
    row.className = "insert-row";
    row.dataset.targetTaskId = targetTaskId === null ? "" : String(targetTaskId);
    row.dataset.team = teamName || "";

    const cell = document.createElement("td");
    cell.colSpan = 12;
    row.appendChild(cell);
    return row;
  }

  function renderInsertRail() {
    if (!els.insertRail) {
      return;
    }

    els.insertRail.replaceChildren();

    const insertRows = Array.from(els.tbody.querySelectorAll("tr.insert-row"));
    if (!insertRows.length) {
      return;
    }

    const shellRect = els.insertRail.parentElement.getBoundingClientRect();
    insertRows.forEach((row) => {
      const rect = row.getBoundingClientRect();
      const button = document.createElement("button");
      button.className = "insert-rail-btn";
      button.type = "button";
      button.textContent = "+";
      button.title = "Add task here";
      button.style.top = `${rect.top - shellRect.top + rect.height / 2}px`;
      row.addEventListener("mouseenter", () => button.classList.add("is-visible"));
      row.addEventListener("mouseleave", () => button.classList.remove("is-visible"));
      button.addEventListener("mouseenter", () => button.classList.add("is-visible"));
      button.addEventListener("mouseleave", () => button.classList.remove("is-visible"));
      button.addEventListener("click", () =>
        insertRowAt(
          row.dataset.targetTaskId ? Number(row.dataset.targetTaskId) : null,
          row.dataset.team || "",
        ),
      );
      els.insertRail.appendChild(button);
    });
  }

  function buildNameCell(task) {
    const cell = document.createElement("td");
    cell.className = "col-name editable";
    cell.dataset.editCol = "col-name";
    renderNameCell(cell, task);
    cell.addEventListener("click", () => startTextEdit(cell, task, "name", () => renderNameCell(cell, task)));
    makeKeyboardEditable(cell, () => startTextEdit(cell, task, "name", () => renderNameCell(cell, task)));
    return cell;
  }

  function buildEditableTextCell(task, field, className, value) {
    const cell = document.createElement("td");
    cell.className = `${className} editable`;
    cell.dataset.editCol = className;
    renderTextCell(cell, value);
    cell.addEventListener("click", () => startTextEdit(cell, task, field));
    makeKeyboardEditable(cell, () => startTextEdit(cell, task, field));
    return cell;
  }

  function renderNameCell(cell, task) {
    const wrap = document.createElement("div");
    wrap.className = "task-name-wrap";

    const title = document.createElement("span");
    title.className = "cell-inner";
    title.textContent = task.name || "";
    if (!task.name) {
      title.style.color = "var(--muted)";
    }
    wrap.appendChild(title);

    const reasons = getTaskReasons(task);
    if (reasons.length) {
      const meta = document.createElement("span");
      meta.className = "task-reason-line";
      meta.textContent = reasons.join(" · ");
      wrap.appendChild(meta);
    }

    cell.replaceChildren(wrap);
  }

  function getTaskReasons(task) {
    const reasons = [];

    if (state.focusMode) {
      if (task.status === "In development") {
        reasons.push("in progress");
      }
      if (task.priority) {
        reasons.push(task.priority.toLowerCase());
      }
      if (task.mode === "Change") {
        reasons.push("change work");
      } else if (task.mode === "Run" && dueScore(task.deadline) >= 7) {
        reasons.push("run work due soon");
      }
      if (task.goal) {
        reasons.push(`goal: ${task.goal}`);
      }
      if (task.owner === "Me") {
        reasons.push("owned by me");
      }
      if (["<5m", "15m", "30m"].includes(task.time_estimate)) {
        reasons.push(`fits ${task.time_estimate}`);
      }
    } else if (state.delegatableMode) {
      reasons.push("delegated");
      if (task.status === "In development") {
        reasons.push("already moving");
      }
      if (task.priority) {
        reasons.push(task.priority.toLowerCase());
      }
      if (task.deadline) {
        reasons.push(`due ${formatDate(task.deadline)}`);
      }
      if (task.goal) {
        reasons.push(`goal: ${task.goal}`);
      }
    }

    return reasons.slice(0, 3);
  }

  function renderTextCell(cell, value) {
    const inner = document.createElement("span");
    inner.className = "cell-inner";
    inner.textContent = value || "";
    if (!value) {
      inner.style.color = "var(--muted)";
    }
    cell.replaceChildren(inner);
  }

  function buildSelectCell(task, field, className, options, renderValue) {
    const cell = document.createElement("td");
    cell.className = `${className} editable`;
    cell.dataset.editCol = className;
    renderSelectDisplay(cell, renderValue());
    cell.addEventListener("click", () => startSelectEdit(cell, task, field, options, renderValue));
    makeKeyboardEditable(cell, () => startSelectEdit(cell, task, field, options, renderValue));
    return cell;
  }

  function renderSelectDisplay(cell, html) {
    const inner = document.createElement("span");
    inner.className = "cell-inner";
    inner.innerHTML = html || '<span style="color:var(--muted)">—</span>';
    cell.replaceChildren(inner);
  }

  function buildDeadlineCell(task) {
    const cell = document.createElement("td");
    cell.className = "col-deadline editable";
    cell.dataset.editCol = "col-deadline";
    renderDeadlineDisplay(cell, task.deadline);
    cell.addEventListener("click", () => startDateEdit(cell, task, "deadline"));
    makeKeyboardEditable(cell, () => startDateEdit(cell, task, "deadline"));
    return cell;
  }

  function makeKeyboardEditable(cell, openEditor) {
    cell.tabIndex = 0;
    cell.addEventListener("keydown", (event) => {
      if (event.target !== cell) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openEditor();
        return;
      }

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        moveCellFocus(cell, event.key);
      }
    });
  }

  function getEditableCells() {
    return Array.from(els.tbody.querySelectorAll("td.editable"));
  }

  function moveCellFocus(cell, direction) {
    const cells = getEditableCells();
    const index = cells.indexOf(cell);
    if (index === -1) {
      return;
    }

    const currentRow = cell.parentElement;
    const currentColumn = getEditableColumnIndex(cell);

    if (direction === "ArrowLeft" && index > 0) {
      cells[index - 1].focus();
      return;
    }

    if (direction === "ArrowRight" && index < cells.length - 1) {
      cells[index + 1].focus();
      return;
    }

    if (direction === "ArrowUp" || direction === "ArrowDown") {
      const step = direction === "ArrowUp" ? -1 : 1;
      let row = currentRow;

      while (row) {
        row = step === -1 ? row.previousElementSibling : row.nextElementSibling;
        if (!row || row.classList.contains("team-header-row")) {
          continue;
        }

        const target = row.querySelector(`td.editable[data-edit-col="${currentColumn}"]`);
        if (target) {
          target.focus();
          return;
        }
      }
    }
  }

  function getEditableColumnIndex(cell) {
    return cell.dataset.editCol || "";
  }

  function focusEditableCell(cell) {
    requestAnimationFrame(() => {
      cell.focus();
    });
  }

  function focusTaskCell(taskId, editCol) {
    requestAnimationFrame(() => {
      const row = els.tbody.querySelector(`tr[data-id="${CSS.escape(String(taskId))}"]`);
      const cell = row?.querySelector(`td.editable[data-edit-col="${editCol}"]`);
      cell?.focus();
    });
  }

  function renderDeadlineDisplay(cell, deadline) {
    const inner = document.createElement("span");
    inner.className = "cell-inner";
    inner.innerHTML = deadline
      ? `<span style="color:#fbbf24;font-size:12px">📅</span> ${formatDate(deadline)}`
      : '<span style="color:var(--muted)">Set date…</span>';
    cell.replaceChildren(inner);
  }

  function buildCreatedCell(task) {
    const cell = document.createElement("td");
    cell.className = "col-created";
    renderCreatedDisplay(cell, task.created_at);
    return cell;
  }

  function renderCreatedDisplay(cell, createdAt) {
    const inner = document.createElement("span");
    inner.className = "cell-inner";
    inner.innerHTML = createdAt
      ? `<span class="created-badge">${formatDate(createdAt)}</span>`
      : '<span style="color:var(--muted)">—</span>';
    cell.replaceChildren(inner);
  }

  function formatDate(isoDate) {
    if (!isoDate) {
      return "";
    }

    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return isoDate;
    }

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function startTextEdit(cell, task, field, render = null) {
    if (cell.querySelector("input")) {
      return;
    }

    const input = document.createElement("input");
    input.className = "cell-edit";
    input.type = "text";
    input.value = task[field] || "";
    cell.replaceChildren(input);
    input.focus();
    input.select();

    let shouldRestoreFocus = false;

    const commit = () => {
      task[field] = input.value.trim();
      void saveTasks();
      if (render) {
        render();
      } else {
        renderTextCell(cell, task[field]);
      }
      if (shouldRestoreFocus) {
        focusEditableCell(cell);
      }
    };

    input.addEventListener("blur", commit, { once: true });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        shouldRestoreFocus = true;
        input.blur();
      }
    });
  }

  function startDateEdit(cell, task, field) {
    if (cell.querySelector("input")) {
      return;
    }

    const input = document.createElement("input");
    input.className = "cell-edit";
    input.type = "date";
    input.value = task[field] || "";
    input.style.colorScheme = "dark";
    cell.replaceChildren(input);
    input.focus();

    try {
      input.showPicker();
    } catch {}

    let committed = false;
    let shouldRestoreFocus = false;
    const commit = () => {
      if (committed) {
        return;
      }
      committed = true;
      task[field] = input.value;
      void saveTasks();
      renderDeadlineDisplay(cell, task[field]);
      if (shouldRestoreFocus) {
        focusEditableCell(cell);
      }
    };

    input.addEventListener(
      "change",
      () => {
        shouldRestoreFocus = true;
        commit();
      },
      { once: true },
    );
    input.addEventListener("blur", commit, { once: true });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        shouldRestoreFocus = true;
        input.blur();
      }
    });
  }

  function startSelectEdit(cell, task, field, options, renderValue) {
    if (cell.querySelector("select")) {
      return;
    }

    const select = document.createElement("select");
    select.className = "cell-edit";
    options.forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue || "—";
      select.appendChild(option);
    });
    select.value = task[field] || "";
    cell.replaceChildren(select);
    select.focus();

    try {
      select.showPicker();
    } catch {}

    let committed = false;
    let shouldRestoreFocus = false;
    const editCol = cell.dataset.editCol || "";
    const commit = () => {
      if (committed) {
        return;
      }
      committed = true;
      const previousStatus = task.status;
      task[field] = select.value;
      if (field === "status") {
        task.completed_at = nextCompletedAt(
          task.completed_at,
          previousStatus,
          task.status,
        );
      }
      syncTeamsFromTasks();
      rebuildTeamFilter();
      state.goals = normalizeGoals(state.goals, state.tasks);
      void saveTasks();
      renderSelectDisplay(cell, renderValue());
      if (field === "team") {
        renderCurrentView();
      }
      if (shouldRestoreFocus) {
        if (field === "team") {
          focusTaskCell(task.id, editCol);
        } else {
          focusEditableCell(cell);
        }
      }
    };

    select.addEventListener(
      "change",
      () => {
        shouldRestoreFocus = true;
        commit();
      },
      { once: true },
    );
    select.addEventListener("blur", commit, { once: true });
  }

  function addRow() {
    const task = buildTaskDraft();

    state.tasks.unshift(task);
    syncTeamsFromTasks();
    rebuildTeamFilter();
    void saveTasks();
    if (els.fStatus) {
      els.fStatus.value = "";
    }
    if (els.fMode) {
      els.fMode.value = "";
    }
    if (els.fOwner) {
      els.fOwner.value = "";
    }
    if (els.fTime) {
      els.fTime.value = "";
    }
    if (els.fSearch) {
      els.fSearch.value = "";
    }
    renderCurrentView();

    const row = document.querySelector(`tr[data-id="${task.id}"]`);
    const nameCell = row?.querySelector("td.col-name");
    if (nameCell) {
      nameCell.click();
    }
  }

  function insertRowAt(targetTaskId, teamName) {
    const task = buildTaskDraft({ team: teamName || "" });

    if (targetTaskId === null) {
      let insertIndex = state.tasks.length;
      for (let index = state.tasks.length - 1; index >= 0; index -= 1) {
        if ((state.tasks[index].team || "") === (teamName || "")) {
          insertIndex = index + 1;
          break;
        }
      }
      state.tasks.splice(insertIndex, 0, task);
    } else {
      const targetIndex = state.tasks.findIndex((item) => item.id === targetTaskId);
      const insertIndex = targetIndex === -1 ? state.tasks.length : targetIndex;
      state.tasks.splice(insertIndex, 0, task);
    }

    syncTeamsFromTasks();
    rebuildTeamFilter();
    void saveTasks();
    renderCurrentView();

    const row = document.querySelector(`tr[data-id="${task.id}"]`);
    const nameCell = row?.querySelector("td.col-name");
    if (nameCell) {
      nameCell.click();
    }
  }

  function deleteRow(id) {
    state.tasks = state.tasks.filter((task) => task.id !== id);
    syncTeamsFromTasks();
    rebuildTeamFilter();
    void saveTasks({ message: "Task deleted" });
    renderCurrentView();
  }

  function statusBadge(status) {
    if (!status) {
      return "";
    }

    const className =
      status === "Done" ? "s-done" : status === "In development" ? "s-dev" : "s-todo";
    return `<span class="badge ${className}">${status}</span>`;
  }

  function teamBadgeHtml(team) {
    if (!team) {
      return "";
    }

    const [color, background] = teamColor(team);
    return `<span class="team-badge" style="background:${background};color:${color}">${team}</span>`;
  }

  function goalBadge(goal) {
    if (!goal) {
      return "";
    }

    return `<span class="badge g-goal">${goal}</span>`;
  }

  function modeBadge(mode) {
    if (!mode) {
      return "";
    }

    const className = mode === "Change" ? "m-change" : "m-run";
    const label = mode;
    return `<span class="badge ${className}">${label}</span>`;
  }

  function ownerBadge(owner) {
    if (!owner) {
      return "";
    }

    const className = owner === "Me" ? "o-me" : "o-delegate";
    const label = owner;
    return `<span class="badge ${className}">${label}</span>`;
  }

  function priorityBadge(priority) {
    if (!priority) {
      return "";
    }

    const className =
      priority === "Must"
        ? "p-must"
        : priority === "Should"
          ? "p-should"
          : priority === "Could"
            ? "p-could"
            : "p-refine";
    return `<span class="badge ${className}">${priority}</span>`;
  }

  function timeBadge(timeEstimate) {
    if (!timeEstimate) {
      return "";
    }

    const className = timeEstimate === "<5m" ? "t-quick" : "t-block";
    const label = timeEstimate;
    return `<span class="badge ${className}">${label}</span>`;
  }

  function onDragStart(event, id) {
    if (state.dragTeam) {
      return;
    }

    state.dragId = id;
    event.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      row?.classList.add("dragging");
    }, 0);
  }

  function onDragEnd() {
    document.querySelectorAll("tr.dragging, tr.drag-over").forEach((row) => {
      row.classList.remove("dragging", "drag-over");
    });
    state.dragId = null;
  }

  function onDragOver(event, id) {
    if (state.dragTeam) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (id === state.dragId) {
      return;
    }

    document.querySelectorAll("tr.drag-over").forEach((row) => {
      row.classList.remove("drag-over");
    });

    const row = document.querySelector(`tr[data-id="${id}"]`);
    row?.classList.add("drag-over");
  }

  function onDrop(event, targetId) {
    if (state.dragTeam) {
      return;
    }

    event.preventDefault();
    document.querySelectorAll("tr.dragging, tr.drag-over").forEach((row) => {
      row.classList.remove("dragging", "drag-over");
    });

    if (!state.dragId || state.dragId === targetId) {
      return;
    }

    const sourceIndex = state.tasks.findIndex((task) => task.id === state.dragId);
    const targetIndex = state.tasks.findIndex((task) => task.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const targetTeam = state.tasks[targetIndex].team;
    const [movedTask] = state.tasks.splice(sourceIndex, 1);
    movedTask.team = targetTeam;
    const updatedTargetIndex = state.tasks.findIndex((task) => task.id === targetId);
    state.tasks.splice(updatedTargetIndex, 0, movedTask);
    syncTeamsFromTasks();
    rebuildTeamFilter();
    void saveTasks();
    renderCurrentView();
  }

  function onTeamDragStart(event, team) {
    state.dragTeam = team;
    event.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      const row = document.querySelector(
        `tr.team-header-row[data-team="${CSS.escape(team)}"]`,
      );
      row?.classList.add("team-dragging");
    }, 0);
  }

  function onTeamDragEnd() {
    document.querySelectorAll("tr.team-dragging, tr.team-drag-over").forEach((row) => {
      row.classList.remove("team-dragging", "team-drag-over");
    });
    state.dragTeam = null;
  }

  function onTeamDragOver(event, team) {
    if (!state.dragTeam || team === state.dragTeam) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    document.querySelectorAll("tr.team-drag-over").forEach((row) => {
      row.classList.remove("team-drag-over");
    });

    const row = document.querySelector(
      `tr.team-header-row[data-team="${CSS.escape(team)}"]`,
    );
    row?.classList.add("team-drag-over");
  }

  function onTeamDrop(event, targetTeam) {
    event.preventDefault();
    event.stopPropagation();
    document.querySelectorAll("tr.team-dragging, tr.team-drag-over").forEach((row) => {
      row.classList.remove("team-dragging", "team-drag-over");
    });

    if (!state.dragTeam || state.dragTeam === targetTeam) {
      state.dragTeam = null;
      return;
    }

    const visibleTeams = state.teams.filter((team) => state.tasks.some((task) => task.team === team));
    const fromIndex = visibleTeams.indexOf(state.dragTeam);
    const toIndex = visibleTeams.indexOf(targetTeam);
    if (fromIndex === -1 || toIndex === -1) {
      state.dragTeam = null;
      return;
    }

    state.teams = [...state.teams];
    state.teams.splice(state.teams.indexOf(state.dragTeam), 1);
    state.teams.splice(state.teams.indexOf(targetTeam), 0, state.dragTeam);
    state.dragTeam = null;
    syncTeamsFromTasks();
    rebuildTeamFilter();
    void saveTasks();
    renderCurrentView();
  }

  async function checkForExternalUpdates() {
    if (state.isReloading || document.querySelector(".cell-edit")) {
      return;
    }

    try {
      const response = await requestState("HEAD");
      const lastModified = response.headers.get("Last-Modified");
      if (lastModified && state.lastModified && lastModified !== state.lastModified) {
        state.lastModified = lastModified;
        await loadData({ showReloadToast: true });
        renderCurrentView();
      }
    } catch (error) {
      console.error(error);
    }
  }

  function toast(message) {
    if (!els.toast) {
      return;
    }

    els.toast.textContent = message;
    els.toast.style.opacity = "1";
    clearTimeout(els.toast._timeout);
    els.toast._timeout = setTimeout(() => {
      els.toast.style.opacity = "0";
    }, 2200);
  }

  async function boot() {
    cacheElements();
    state.weekStart = getStartOfWeekIso(new Date());
    wireUi();
    await loadData();
    renderCurrentView();
    window.setInterval(checkForExternalUpdates, POLL_INTERVAL_MS);
  }

  void boot();
})();
