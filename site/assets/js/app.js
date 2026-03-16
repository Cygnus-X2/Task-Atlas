(() => {
  const API_STATE_URL = "/api/state";
  const POLL_INTERVAL_MS = 4000;

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
  const FLAG_SORT = { yes: 0, no: 1, "": 2 };
  const TIME_SORT = { "<5m": 0, "15m": 1, "30m": 2, "1h": 3, "2h+": 4, "": 5 };

  const state = {
    dragId: null,
    dragTeam: null,
    isReloading: false,
    lastModified: "",
    saveChain: Promise.resolve(),
    showDone: false,
    smartSort: false,
    sortCol: "",
    sortDir: 1,
    tasks: [],
    teams: [...DEFAULT_TEAMS],
  };

  const els = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.btnAddTask = byId("btnAddTask");
    els.btnAddTeam = byId("btnAddTeam");
    els.btnCancelTeam = byId("btnCancelTeam");
    els.btnConfirmTeam = byId("btnConfirmTeam");
    els.btnDone = byId("btnDone");
    els.btnSmart = byId("btnSmart");
    els.btnExport = byId("btnExport");
    els.btnImport = byId("btnImport");
    els.csvIn = byId("csvIn");
    els.fUrgency = byId("fUrgency");
    els.fImportance = byId("fImportance");
    els.fTime = byId("fTime");
    els.fSearch = byId("fSearch");
    els.fStatus = byId("fStatus");
    els.fTeam = byId("fTeam");
    els.newTeamInput = byId("newTeamInput");
    els.statsLine = byId("statsLine");
    els.tbody = byId("tbody");
    els.teamOverlay = byId("teamOverlay");
    els.toast = byId("toast");
  }

  function wireUi() {
    els.btnAddTask.addEventListener("click", addRow);
    els.btnAddTeam.addEventListener("click", openTeamDialog);
    els.btnCancelTeam.addEventListener("click", closeTeamDialog);
    els.btnConfirmTeam.addEventListener("click", confirmTeam);
    els.btnDone.addEventListener("click", toggleDone);
    els.btnSmart.addEventListener("click", toggleSmartSort);
    els.btnExport.addEventListener("click", exportCSV);
    els.btnImport.addEventListener("click", () => els.csvIn.click());
    els.csvIn.addEventListener("change", importCSV);
    els.fUrgency.addEventListener("change", renderTable);
    els.fImportance.addEventListener("change", renderTable);
    els.fTime.addEventListener("change", renderTable);
    els.fSearch.addEventListener("input", renderTable);
    els.fStatus.addEventListener("change", renderTable);
    els.fTeam.addEventListener("change", renderTable);
    els.teamOverlay.addEventListener("click", (event) => {
      if (event.target === els.teamOverlay) {
        closeTeamDialog();
      }
    });
    els.newTeamInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        confirmTeam();
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

  async function loadData({ showReloadToast = false } = {}) {
    state.isReloading = true;

    try {
      const response = await requestState("GET");
      const payload = await response.json();
      state.tasks = normalizeTasks(payload.tasks || []);
      state.teams = normalizeTeams(payload.teams || [], state.tasks);
      syncTeamsFromTasks();
      rebuildTeamFilter();

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
        urgency: normalizeFlag(task.urgency),
        importance: normalizeImportance(task.importance, task.prio),
        time_estimate: normalizeTimeEstimate(task.time_estimate),
        deadline: String(task.deadline || "").trim(),
        created_at: normalizeCreatedAt(task.created_at, task.id),
        notes: String(task.notes || "").trim(),
      }))
      .filter((task) => task.name);
  }

  function syncTeamsFromTasks() {
    state.teams = normalizeTeams(state.teams, state.tasks);
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

  function normalizeFlag(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (["yes", "true", "1", "urgent"].includes(raw)) {
      return "yes";
    }
    if (["no", "false", "0", "not urgent", "later"].includes(raw)) {
      return "no";
    }
    return "";
  }

  function normalizeImportance(value, legacyPrio = "") {
    const raw = String(value || "").trim().toLowerCase();
    if (["yes", "true", "1", "important"].includes(raw)) {
      return "yes";
    }
    if (["no", "false", "0", "not important"].includes(raw)) {
      return "no";
    }

    const legacy = String(legacyPrio || "").trim().toLowerCase();
    if (["high", "medium"].includes(legacy)) {
      return "yes";
    }
    if (legacy === "low") {
      return "no";
    }
    return "";
  }

  function normalizeTimeEstimate(value) {
    const raw = String(value || "").trim();
    return ["<5m", "15m", "30m", "1h", "2h+"].includes(raw) ? raw : "";
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
        task.team = task.team || "";
        task.urgency = normalizeFlag(task.urgency);
        task.importance = normalizeImportance(task.importance, task.priority || task.prio);
        task.time_estimate = normalizeTimeEstimate(
          task.time || task.time_estimate || task.estimate,
        );
        task.deadline = task.deadline || "";
        task.created_at = normalizeCreatedAt(task.created || task.created_at, task.id);
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
    const header = ["Name", "Status", "Team", "Urgent", "Important", "Time", "Deadline", "Created", "Notes"];
    const rows = tasks.map((task) =>
      [
        csvCell(task.name),
        csvCell(task.status),
        csvCell(task.team),
        csvCell(task.urgency),
        csvCell(task.importance),
        csvCell(task.time_estimate),
        csvCell(task.deadline),
        csvCell(task.created_at),
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
      tasks: state.tasks.map((task) => ({
        id: Number(task.id) || null,
        name: task.name,
        status: task.status,
        team: task.team,
        urgency: task.urgency,
        importance: task.importance,
        time_estimate: task.time_estimate,
        deadline: task.deadline,
        created_at: task.created_at,
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
      renderTable();
      await saveTasks({ message: `Imported ${state.tasks.length} tasks` });
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function rebuildTeamFilter() {
    const selectedTeam = els.fTeam.value;
    els.fTeam.innerHTML = '<option value="">All teams</option>';

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
    if (!team) {
      return;
    }

    els.fTeam.value = els.fTeam.value === team ? "" : team;
    renderTable();
  }

  function openTeamDialog() {
    els.teamOverlay.classList.add("open");
    els.newTeamInput.focus();
  }

  function closeTeamDialog() {
    els.teamOverlay.classList.remove("open");
    els.newTeamInput.value = "";
  }

  function confirmTeam() {
    const value = els.newTeamInput.value.trim();
    if (!value) {
      return;
    }

    if (!state.teams.includes(value)) {
      state.teams.push(value);
      rebuildTeamFilter();
      void saveTasks({ message: "Team added" });
    }

    closeTeamDialog();
  }

  function sortBy(column) {
    state.smartSort = false;
    els.btnSmart.classList.remove("is-active");

    if (state.sortCol === column) {
      state.sortDir *= -1;
    } else {
      state.sortCol = column;
      state.sortDir = 1;
    }

    updateSortIndicators(column);
    renderTable();
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
    state.smartSort = !state.smartSort;
    els.btnSmart.classList.toggle("is-active", state.smartSort);

    if (state.smartSort) {
      state.sortCol = "";
      state.sortDir = 1;
      updateSortIndicators();
    }

    renderTable();
  }

  function getFilteredTasks() {
    const filterTeam = els.fTeam.value;
    const filterStatus = els.fStatus.value;
    const filterUrgency = els.fUrgency.value;
    const filterImportance = els.fImportance.value;
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
      if (filterUrgency && task.urgency !== filterUrgency) {
        return false;
      }
      if (filterImportance && task.importance !== filterImportance) {
        return false;
      }
      if (filterTime && task.time_estimate !== filterTime) {
        return false;
      }
      if (
        query &&
        !task.name.toLowerCase().includes(query) &&
        !task.notes.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

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
      if (state.sortCol === "urgency") {
        return ((FLAG_SORT[left.urgency] ?? 2) - (FLAG_SORT[right.urgency] ?? 2)) * state.sortDir;
      }

      if (state.sortCol === "importance") {
        return (
          ((FLAG_SORT[left.importance] ?? 2) - (FLAG_SORT[right.importance] ?? 2)) * state.sortDir
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

  function smartScore(task) {
    let score = 0;

    if (task.status === "In development") {
      score += 40;
    } else if (task.status === "Not started") {
      score += 18;
    } else if (task.status === "Done") {
      score -= 80;
    }

    if (task.importance === "yes") {
      score += 34;
    } else if (task.importance === "no") {
      score -= 6;
    } else {
      score -= 8;
    }

    if (task.urgency === "yes") {
      score += 24;
    } else if (task.urgency === "no") {
      score -= 2;
    } else {
      score -= 8;
    }

    score += timeScore(task.time_estimate);
    score += dueScore(task.deadline);

    if (!task.team) {
      score -= 3;
    }

    const knownCoreSignals = [
      task.importance,
      task.urgency,
      task.time_estimate,
      task.deadline,
    ].filter(Boolean).length;
    if (knownCoreSignals <= 1) {
      score -= 16;
    }

    return score;
  }

  function timeScore(timeEstimate) {
    if (timeEstimate === "<5m") {
      return 18;
    }
    if (timeEstimate === "15m") {
      return 14;
    }
    if (timeEstimate === "30m") {
      return 10;
    }
    if (timeEstimate === "1h") {
      return 4;
    }
    if (timeEstimate === "2h+") {
      return 0;
    }
    return -6;
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

  function renderTable() {
    const data = getFilteredTasks();
    els.statsLine.textContent = `${data.length} of ${state.tasks.length} tasks`;
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
      group.forEach((task) => els.tbody.appendChild(buildRow(task)));
    });
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
    const isActive = els.fTeam.value === teamName;
    cell.colSpan = 11;
    cell.innerHTML = `<div class="team-header-inner" style="border-left-color:${color}">
      <span class="team-drag-handle">⠿</span>
      <button
        class="team-filter-btn${isActive ? " is-active" : ""}"
        type="button"
        style="--team-color:${color}"
      >
        <span class="team-header-label">${teamName || "— No team —"}</span>
        <span class="team-header-count">${count}</span>
      </button>
    </div>`;
    const filterButton = cell.querySelector(".team-filter-btn");
    if (filterButton) {
      filterButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleTeamFilter(teamName);
      });
    }
    row.appendChild(cell);
    return row;
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

    row.appendChild(buildEditableTextCell(task, "name", "col-name", task.name));
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
        "importance",
        "col-important",
        ["", "yes", "no"],
        () => importanceBadge(task.importance),
      ),
    );
    row.appendChild(
      buildSelectCell(task, "urgency", "col-urgent", ["", "yes", "no"], () => urgencyBadge(task.urgency)),
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
    row.appendChild(buildEditableTextCell(task, "notes", "col-notes", task.notes));
    row.appendChild(buildCreatedCell(task));

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

  function buildEditableTextCell(task, field, className, value) {
    const cell = document.createElement("td");
    cell.className = `${className} editable`;
    cell.dataset.editCol = className;
    renderTextCell(cell, value);
    cell.addEventListener("click", () => startTextEdit(cell, task, field));
    makeKeyboardEditable(cell, () => startTextEdit(cell, task, field));
    return cell;
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

  function startTextEdit(cell, task, field) {
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
      renderTextCell(cell, task[field]);
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
      task[field] = select.value;
      syncTeamsFromTasks();
      rebuildTeamFilter();
      void saveTasks();
      renderSelectDisplay(cell, renderValue());
      if (field === "team") {
        renderTable();
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
    const activeTeam = els.fTeam.value;
    const task = {
      id: Date.now(),
      name: "",
      status: "Not started",
      team: activeTeam,
      urgency: "",
      importance: "",
      time_estimate: "",
      deadline: "",
      created_at: toLocalIsoDate(new Date()),
      notes: "",
    };

    state.tasks.unshift(task);
    syncTeamsFromTasks();
    rebuildTeamFilter();
    void saveTasks();
    els.fStatus.value = "";
    els.fUrgency.value = "";
    els.fImportance.value = "";
    els.fTime.value = "";
    els.fSearch.value = "";
    renderTable();

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
    renderTable();
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

  function urgencyBadge(urgency) {
    if (!urgency) {
      return "";
    }

    const className = urgency === "yes" ? "u-yes" : "u-no";
    const label = urgency === "yes" ? "Urgent" : "Not urgent";
    return `<span class="badge ${className}">${label}</span>`;
  }

  function importanceBadge(importance) {
    if (!importance) {
      return "";
    }

    const className = importance === "yes" ? "i-yes" : "i-no";
    const label = importance === "yes" ? "Important" : "Not important";
    return `<span class="badge ${className}">${label}</span>`;
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
    renderTable();
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
    renderTable();
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
        renderTable();
      }
    } catch (error) {
      console.error(error);
    }
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.style.opacity = "1";
    clearTimeout(els.toast._timeout);
    els.toast._timeout = setTimeout(() => {
      els.toast.style.opacity = "0";
    }, 2200);
  }

  async function boot() {
    cacheElements();
    wireUi();
    await loadData();
    renderTable();
    window.setInterval(checkForExternalUpdates, POLL_INTERVAL_MS);
  }

  void boot();
})();
