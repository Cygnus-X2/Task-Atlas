(() => {
  const API_STATE_URL = "/api/state";
  const API_CALENDAR_EVENTS_URL = "/api/calendar-events";
  const API_CALENDAR_FEED_URL = "/api/calendar-feed";
  const API_SESSION_LOGOUT_URL = "/api/session/logout";
  const POLL_INTERVAL_MS = 4000;
  const SETTINGS_TEAM_COLORS_KEY = "team_colors";
  const TOP_CHROME_PIN_KEY = "task-atlas.top-chrome-pinned";
  const LAST_PAGE_ID_KEY = "task-atlas.last-page-id";
  const PAGE_COLLAPSED_IDS_KEY = "task-atlas.page-collapsed-ids";
  const SHOW_CREATED_AT_KEY = "task-atlas.show-created-at";
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
  const WEEK_BACKLOG_NO_GOAL = "__week_backlog_no_goal__";
  const WEEK_BACKLOG_NO_AREA = "__week_backlog_no_area__";
  const WEEK_CLOCK_TICK_MS = 60000;
  const PAGE_EMOJI_LIMIT = 8;
  const PAGE_EMOJI_INDEX = [
    { emoji: "😀", name: "grinning", aliases: ["smile", "happy", "face"] },
    { emoji: "😁", name: "beaming", aliases: ["smile", "grin", "happy"] },
    { emoji: "😂", name: "joy", aliases: ["laugh", "tears", "funny"] },
    { emoji: "🤣", name: "rolling_laugh", aliases: ["lol", "laugh", "funny"] },
    { emoji: "🙂", name: "slightly_smiling", aliases: ["smile", "pleasant"] },
    { emoji: "😊", name: "blush", aliases: ["smile", "happy", "warm"] },
    { emoji: "😍", name: "heart_eyes", aliases: ["love", "adoring"] },
    { emoji: "😘", name: "kiss", aliases: ["love", "heart"] },
    { emoji: "🤔", name: "thinking", aliases: ["hmm", "idea", "consider"] },
    { emoji: "🫡", name: "salute", aliases: ["respect", "ack", "yes"] },
    { emoji: "😉", name: "wink", aliases: ["playful"] },
    { emoji: "😎", name: "cool", aliases: ["sunglasses"] },
    { emoji: "🥳", name: "party", aliases: ["celebrate", "birthday"] },
    { emoji: "🤯", name: "mind_blown", aliases: ["wow", "surprised"] },
    { emoji: "😴", name: "sleepy", aliases: ["tired", "sleep"] },
    { emoji: "🔥", name: "fire", aliases: ["lit", "hot", "streak"] },
    { emoji: "✨", name: "sparkles", aliases: ["shine", "magic"] },
    { emoji: "⭐", name: "star", aliases: ["favorite"] },
    { emoji: "✅", name: "check", aliases: ["done", "complete", "tick"] },
    { emoji: "☑️", name: "checkbox", aliases: ["check", "todo", "tick"] },
    { emoji: "❌", name: "cross", aliases: ["x", "cancel", "no"] },
    { emoji: "⚠️", name: "warning", aliases: ["alert", "caution"] },
    { emoji: "🚧", name: "construction", aliases: ["wip", "blocked", "work_in_progress"] },
    { emoji: "🚀", name: "rocket", aliases: ["launch", "ship", "deploy"] },
    { emoji: "🎯", name: "dart", aliases: ["goal", "target", "focus"] },
    { emoji: "📌", name: "pin", aliases: ["pinned", "marker"] },
    { emoji: "📍", name: "round_pin", aliases: ["location", "marker"] },
    { emoji: "🧭", name: "compass", aliases: ["direction", "strategy"] },
    { emoji: "🗺️", name: "map", aliases: ["plan", "roadmap"] },
    { emoji: "📅", name: "calendar", aliases: ["date", "schedule"] },
    { emoji: "⏰", name: "alarm", aliases: ["time", "reminder"] },
    { emoji: "⌛", name: "hourglass", aliases: ["waiting", "time"] },
    { emoji: "🕒", name: "clock", aliases: ["time"] },
    { emoji: "📝", name: "memo", aliases: ["note", "write"] },
    { emoji: "📄", name: "document", aliases: ["page", "file"] },
    { emoji: "📚", name: "books", aliases: ["reading", "docs", "knowledge"] },
    { emoji: "📦", name: "package", aliases: ["shipment", "release", "bundle"] },
    { emoji: "📈", name: "chart_up", aliases: ["growth", "metrics", "up"] },
    { emoji: "📉", name: "chart_down", aliases: ["drop", "metrics", "down"] },
    { emoji: "💡", name: "bulb", aliases: ["idea", "insight"] },
    { emoji: "🧠", name: "brain", aliases: ["think", "smart"] },
    { emoji: "🔍", name: "search", aliases: ["find", "inspect"] },
    { emoji: "🔒", name: "lock", aliases: ["secure", "private"] },
    { emoji: "🔓", name: "unlock", aliases: ["open", "access"] },
    { emoji: "🔁", name: "repeat", aliases: ["loop", "again"] },
    { emoji: "🔄", name: "refresh", aliases: ["reload", "sync"] },
    { emoji: "🛠️", name: "tools", aliases: ["fix", "build"] },
    { emoji: "⚙️", name: "gear", aliases: ["settings", "config"] },
    { emoji: "🔧", name: "wrench", aliases: ["fix", "repair"] },
    { emoji: "🧪", name: "test_tube", aliases: ["test", "experiment"] },
    { emoji: "🐛", name: "bug", aliases: ["issue", "defect"] },
    { emoji: "🎨", name: "art", aliases: ["design", "creative"] },
    { emoji: "🧱", name: "bricks", aliases: ["foundation", "building"] },
    { emoji: "🏗️", name: "building", aliases: ["construction", "architecture"] },
    { emoji: "🤝", name: "handshake", aliases: ["deal", "partnership"] },
    { emoji: "👏", name: "clap", aliases: ["applause", "nice"] },
    { emoji: "🙌", name: "raised_hands", aliases: ["celebrate", "success"] },
    { emoji: "👍", name: "thumbsup", aliases: ["yes", "approve", "good"] },
    { emoji: "👎", name: "thumbsdown", aliases: ["no", "bad"] },
    { emoji: "🙏", name: "pray", aliases: ["thanks", "please"] },
    { emoji: "👀", name: "eyes", aliases: ["look", "watch", "review"] },
    { emoji: "💬", name: "speech_balloon", aliases: ["comment", "talk"] },
    { emoji: "🗣️", name: "speaking", aliases: ["voice", "say"] },
    { emoji: "📣", name: "megaphone", aliases: ["announce", "broadcast"] },
    { emoji: "📞", name: "phone", aliases: ["call"] },
    { emoji: "📧", name: "email", aliases: ["mail", "message"] },
    { emoji: "✉️", name: "envelope", aliases: ["mail", "message"] },
    { emoji: "🔔", name: "bell", aliases: ["alert", "notify"] },
    { emoji: "🏁", name: "finish", aliases: ["done", "goal", "end"] },
    { emoji: "🏆", name: "trophy", aliases: ["win", "success"] },
    { emoji: "🥇", name: "gold", aliases: ["first", "winner"] },
    { emoji: "💥", name: "boom", aliases: ["impact", "explosion"] },
    { emoji: "❤️", name: "heart", aliases: ["love", "favorite"] },
    { emoji: "🟢", name: "green_circle", aliases: ["green", "go", "ok"] },
    { emoji: "🟡", name: "yellow_circle", aliases: ["yellow", "attention"] },
    { emoji: "🔴", name: "red_circle", aliases: ["red", "stop", "blocked"] },
    { emoji: "🔵", name: "blue_circle", aliases: ["blue"] },
    { emoji: "🟣", name: "purple_circle", aliases: ["purple"] },
    { emoji: "⚪", name: "white_circle", aliases: ["white"] },
    { emoji: "⚫", name: "black_circle", aliases: ["black"] },
    { emoji: "➡️", name: "arrow_right", aliases: ["next", "forward"] },
    { emoji: "⬅️", name: "arrow_left", aliases: ["back", "previous"] },
    { emoji: "⬆️", name: "arrow_up", aliases: ["up"] },
    { emoji: "⬇️", name: "arrow_down", aliases: ["down"] },
    { emoji: "↗️", name: "arrow_up_right", aliases: ["growth", "trend_up"] },
    { emoji: "↘️", name: "arrow_down_right", aliases: ["trend_down"] },
    { emoji: "➕", name: "plus", aliases: ["add", "new"] },
    { emoji: "➖", name: "minus", aliases: ["remove", "subtract"] },
    { emoji: "🧩", name: "puzzle", aliases: ["piece", "fit"] },
    { emoji: "🌱", name: "seedling", aliases: ["growth", "new"] },
    { emoji: "🌍", name: "earth", aliases: ["world", "global"] },
    { emoji: "🏠", name: "house", aliases: ["home"] },
    { emoji: "💼", name: "briefcase", aliases: ["work", "business"] },
    { emoji: "🧑‍💻", name: "technologist", aliases: ["developer", "coding"] },
  ];

  const state = {
    dragId: null,
    dragTeam: null,
    weekDragTaskId: null,
    weekDraftSlot: null,
    weekEditingTaskId: null,
    weekCardMenuTaskId: null,
    goalCardMenuName: null,
    goalEditingName: "",
    delegatableMode: false,
    focusMode: false,
    isReloading: false,
    lastModified: "",
    loadingWeekEvents: false,
    saveChain: Promise.resolve(),
    showCreatedAt: false,
    showDone: false,
    smartSort: false,
    sortCol: "",
    sortDir: 1,
    settings: {},
    calendarFeedUrl: "",
    teamStyles: {},
    teamStyleEditingName: "",
    goals: [],
    pages: [],
    pageSearchQuery: "",
    pageAutosaveTimer: null,
    pageCollapsedIds: new Set(),
    pageDragId: null,
    pageDropTarget: null,
    pageMouseDrag: null,
    pageSuppressClickUntil: 0,
    pageTouchDrag: null,
    currentPageId: null,
    pageFocusMode: false,
    pageEmojiItems: [],
    pageEmojiIndex: 0,
    pageEmojiQuery: "",
    pageEmojiRange: null,
    pageEmojiRect: null,
    pageSelectedImageId: "",
    topChromePinned: false,
    tasks: [],
    teams: [...DEFAULT_TEAMS],
    weekEvents: [],
    weekEventsKey: "",
    weekBacklogAreaFilter: "",
    weekBacklogGoalFilter: "",
    weekStart: "",
  };

  const els = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.btnAddGoal = byId("btnAddGoal");
    els.btnAddPage = byId("btnAddPage");
    els.btnQuickAddPage = byId("btnQuickAddPage");
    els.btnAddTask = byId("btnAddTask");
    els.btnAddTeam = byId("btnAddTeam");
    els.btnClearFilters = byId("btnClearFilters");
    els.btnCancelGoal = byId("btnCancelGoal");
    els.btnCancelPage = byId("btnCancelPage");
    els.btnCancelTeam = byId("btnCancelTeam");
    els.btnCancelTeamStyle = byId("btnCancelTeamStyle");
    els.btnConfirmGoal = byId("btnConfirmGoal");
    els.btnConfirmPage = byId("btnConfirmPage");
    els.btnConfirmTeam = byId("btnConfirmTeam");
    els.btnConfirmTeamStyle = byId("btnConfirmTeamStyle");
    els.btnConfirmWeekTask = byId("btnConfirmWeekTask");
    els.btnDelegatable = byId("btnDelegatable");
    els.btnDone = byId("btnDone");
    els.btnFocus = byId("btnFocus");
    els.btnSmart = byId("btnSmart");
    els.toggleCreatedAt = byId("toggleCreatedAt");
    els.btnLogout = byId("btnLogout");
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
    els.goalDescriptionHeading = byId("goalDescriptionHeading");
    els.goalDescriptionInput = byId("goalDescriptionInput");
    els.goalDescriptionLabel = byId("goalDescriptionLabel");
    els.goalDescriptionOverlay = byId("goalDescriptionOverlay");
    els.goalList = byId("goalList");
    els.insertRail = byId("insertRail");
    els.newGoalInput = byId("newGoalInput");
    els.newPageInput = byId("newPageInput");
    els.newTeamInput = byId("newTeamInput");
    els.teamStyleBgColor = byId("teamStyleBgColor");
    els.teamStyleHeading = byId("teamStyleHeading");
    els.teamStyleOverlay = byId("teamStyleOverlay");
    els.teamStylePreviewBadge = byId("teamStylePreviewBadge");
    els.teamStylePreviewHeader = byId("teamStylePreviewHeader");
    els.teamStyleTextColor = byId("teamStyleTextColor");
    els.btnResetTeamStyle = byId("btnResetTeamStyle");
    els.pageBodyInput = byId("pageBodyInput");
    els.pageEmpty = byId("pageEmpty");
    els.pageEmojiMenu = byId("pageEmojiMenu");
    els.pageImageMenu = byId("pageImageMenu");
    els.pageImagePresetButtons = Array.from(document.querySelectorAll("[data-page-image-size]"));
    els.pageImageSizeInput = byId("pageImageSizeInput");
    els.pageImageSizeValue = byId("pageImageSizeValue");
    els.pageEditorScroll = document.querySelector(".pages-editor-scroll");
    els.pageList = byId("pageList");
    els.pageMeta = byId("pageMeta");
    els.pageOverlay = byId("pageOverlay");
    els.pageSearchInput = byId("pageSearchInput");
    els.pageTableMenu = byId("pageTableMenu");
    els.pageToolButtons = Array.from(document.querySelectorAll("[data-page-command]"));
    els.pageTitleInput = byId("pageTitleInput");
    els.btnDeletePage = byId("btnDeletePage");
    els.btnPageFocus = byId("btnPageFocus");
    els.weekTaskDate = byId("weekTaskDate");
    els.weekTaskCreatedAt = byId("weekTaskCreatedAt");
    els.weekTaskCreatedField = byId("weekTaskCreatedField");
    els.weekTaskDeadline = byId("weekTaskDeadline");
    els.weekTaskGoal = byId("weekTaskGoal");
    els.weekTaskHour = byId("weekTaskHour");
    els.weekTaskHeading = byId("weekTaskHeading");
    els.weekTaskInput = byId("weekTaskInput");
    els.weekTaskMode = byId("weekTaskMode");
    els.weekTaskNotes = byId("weekTaskNotes");
    els.weekTaskOwner = byId("weekTaskOwner");
    els.weekTaskPriority = byId("weekTaskPriority");
    els.weekTaskStatus = byId("weekTaskStatus");
    els.weekTaskTeam = byId("weekTaskTeam");
    els.weekTaskTime = byId("weekTaskTime");
    els.weekTaskOverlay = byId("weekTaskOverlay");
    els.weekTaskSlotLabel = byId("weekTaskSlotLabel");
    els.btnCancelWeekTask = byId("btnCancelWeekTask");
    els.btnCancelGoalDescription = byId("btnCancelGoalDescription");
    els.btnConfirmGoalDescription = byId("btnConfirmGoalDescription");
    els.statsLine = byId("statsLine");
    els.tbody = byId("tbody");
    els.teamOverlay = byId("teamOverlay");
    els.toast = byId("toast");
    els.btnWeekNext = byId("btnWeekNext");
    els.btnWeekPrev = byId("btnWeekPrev");
    els.btnWeekToday = byId("btnWeekToday");
    els.btnSaveCalendarFeed = byId("btnSaveCalendarFeed");
    els.btnRefreshCalendar = byId("btnRefreshCalendar");
    els.calendarFeedInput = byId("calendarFeedInput");
    els.calendarFeedStatus = byId("calendarFeedStatus");
    els.weekBacklog = byId("weekBacklog");
    els.weekBacklogAreaFilter = byId("weekBacklogAreaFilter");
    els.weekBacklogCount = byId("weekBacklogCount");
    els.weekBacklogGoalFilter = byId("weekBacklogGoalFilter");
    els.weekCalendar = byId("weekCalendar");
    els.weekLabel = byId("weekLabel");
    els.topChrome = document.querySelector(".top-chrome, .week-top-chrome");
    els.topChromePeek = els.topChrome?.querySelector(".top-peek, .week-top-peek") || null;
    els.topChromeNavLinks = Array.from(document.querySelectorAll(".header-nav .nav-link"));
    els.boardTableShell = document.querySelector(".table-shell");
    els.boardTableWrap = document.querySelector(".table-wrap");
    els.boardTableScroll = document.querySelector(".table-scroll");
    els.boardTable = els.boardTableScroll?.querySelector("table") || null;
    els.boardThead = els.boardTable?.querySelector("thead") || null;
    els.boardStickyHeader = byId("boardStickyHeader");
  }

  function bind(element, eventName, handler) {
    if (element) {
      element.addEventListener(eventName, handler);
    }
  }

  function isTopChromeInteractive() {
    return Boolean(els.topChrome) && window.innerWidth > 720 && !(currentView === "pages" && state.pageFocusMode);
  }

  function loadTopChromePinnedPreference() {
    try {
      return window.sessionStorage.getItem(TOP_CHROME_PIN_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function persistTopChromePinnedPreference() {
    try {
      window.sessionStorage.setItem(TOP_CHROME_PIN_KEY, state.topChromePinned ? "1" : "0");
    } catch (error) {
      // Ignore storage failures in private mode / locked-down browsers.
    }
  }

  function loadLastPageIdPreference() {
    try {
      const value = Number(window.sessionStorage.getItem(LAST_PAGE_ID_KEY));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (error) {
      return null;
    }
  }

  function persistLastPageIdPreference(pageId) {
    try {
      if (Number.isFinite(pageId) && pageId > 0) {
        window.sessionStorage.setItem(LAST_PAGE_ID_KEY, String(pageId));
      } else {
        window.sessionStorage.removeItem(LAST_PAGE_ID_KEY);
      }
    } catch (error) {
      // Ignore storage failures in private mode / locked-down browsers.
    }
  }

  function loadCollapsedPagePreference() {
    try {
      const raw = JSON.parse(window.sessionStorage.getItem(PAGE_COLLAPSED_IDS_KEY) || "[]");
      if (!Array.isArray(raw)) {
        return new Set();
      }
      return new Set(
        raw
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0),
      );
    } catch (error) {
      return new Set();
    }
  }

  function persistCollapsedPagePreference() {
    try {
      const values = [...state.pageCollapsedIds]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      window.sessionStorage.setItem(PAGE_COLLAPSED_IDS_KEY, JSON.stringify(values));
    } catch (error) {
      // Ignore storage failures in private mode / locked-down browsers.
    }
  }

  function loadShowCreatedAtPreference() {
    try {
      return window.sessionStorage.getItem(SHOW_CREATED_AT_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function persistShowCreatedAtPreference() {
    try {
      window.sessionStorage.setItem(SHOW_CREATED_AT_KEY, state.showCreatedAt ? "1" : "0");
    } catch (error) {
      // Ignore storage failures in private mode / locked-down browsers.
    }
  }

  function getBoardColumnCount() {
    return state.showCreatedAt ? 13 : 12;
  }

  function syncCreatedAtVisibility() {
    document.documentElement.classList.toggle("show-created-at", state.showCreatedAt);
    if (els.toggleCreatedAt) {
      els.toggleCreatedAt.checked = state.showCreatedAt;
    }
    syncBoardStickyHeader();
    updateBoardStickyHeaderPosition();
  }

  function syncCollapsedPagePreferenceWithPages() {
    const validIds = new Set(state.pages.map((page) => page.id));
    const nextCollapsedIds = new Set(
      [...state.pageCollapsedIds].filter((pageId) => validIds.has(pageId)),
    );
    const changed =
      nextCollapsedIds.size !== state.pageCollapsedIds.size ||
      [...nextCollapsedIds].some((pageId) => !state.pageCollapsedIds.has(pageId));

    if (changed) {
      state.pageCollapsedIds = nextCollapsedIds;
      persistCollapsedPagePreference();
    }
  }

  function setTopChromeOpen(open) {
    if (!els.topChrome) {
      return;
    }
    els.topChrome.classList.toggle("is-open", Boolean(open));
    updateBoardStickyHeaderPosition();
  }

  function setTopChromePinned(pinned) {
    state.topChromePinned = Boolean(pinned);
    persistTopChromePinnedPreference();
    document.documentElement.classList.toggle("top-chrome-pinned", state.topChromePinned);
    if (!els.topChrome) {
      return;
    }
    els.topChrome.classList.toggle("is-pinned", state.topChromePinned);
    els.topChrome.classList.toggle("is-open", state.topChromePinned);
    updateBoardStickyHeaderPosition();
  }

  function updateTopChromeInteractionState() {
    if (!els.topChrome) {
      return;
    }
    if (!isTopChromeInteractive()) {
      els.topChrome.classList.remove("is-open", "is-pinned");
      return;
    }
    els.topChrome.classList.toggle("is-pinned", state.topChromePinned);
    if (state.topChromePinned) {
      setTopChromeOpen(true);
    }
  }

  function handleTopChromeMouseMove(event) {
    if (!isTopChromeInteractive()) {
      return;
    }
    if (event.clientY <= 28) {
      setTopChromeOpen(true);
      return;
    }
    if (els.topChrome.matches(":hover") || els.topChrome.contains(document.activeElement)) {
      setTopChromeOpen(true);
      return;
    }
    const rect = els.topChrome.getBoundingClientRect();
    if (event.clientY > rect.bottom + 24) {
      if (state.topChromePinned) {
        setTopChromePinned(false);
      } else {
        setTopChromeOpen(false);
      }
    }
  }

  function handleTopChromePeekClick(event) {
    event.preventDefault();
    event.stopPropagation();
    setTopChromePinned(!state.topChromePinned);
  }

  function handleTopChromeNavClick() {
    if (!els.topChrome) {
      return;
    }
    setTopChromePinned(true);
  }

  function handleTopChromeKeydown(event) {
    if (event.key !== "Escape" || !state.topChromePinned) {
      return;
    }
    setTopChromePinned(false);
  }

  function getTopChromeOffset() {
    if (!els.topChrome || !isTopChromeInteractive()) {
      return 0;
    }
    const isOpen = els.topChrome.classList.contains("is-open") || els.topChrome.classList.contains("is-pinned");
    if (!isOpen) {
      return 28;
    }
    return Math.max(28, Math.round(els.topChrome.offsetHeight || 0));
  }

  function ensureBoardStickyHeader() {
    if (currentView !== "board" || !els.boardTable || !els.boardThead) {
      return null;
    }
    if (els.boardStickyHeader) {
      return els.boardStickyHeader;
    }

    const shell = document.createElement("div");
    shell.id = "boardStickyHeader";
    shell.className = "board-sticky-header";

    const fill = document.createElement("div");
    fill.className = "board-sticky-header-fill";

    const clip = document.createElement("div");
    clip.className = "board-sticky-header-clip";

    const table = document.createElement("table");
    table.className = "board-sticky-header-table";
    clip.appendChild(table);
    shell.appendChild(fill);
    shell.appendChild(clip);
    shell.addEventListener("click", handleBoardStickyHeaderClick);
    document.body.appendChild(shell);

    els.boardStickyHeader = shell;
    return shell;
  }

  function handleBoardStickyHeaderClick(event) {
    const header = event.target.closest("th[data-sort]");
    if (!header || !els.boardThead) {
      return;
    }
    const original = els.boardThead.querySelector(`th[data-sort="${CSS.escape(header.dataset.sort || "")}"]`);
    original?.click();
  }

  function syncBoardStickyHeader() {
    const sticky = ensureBoardStickyHeader();
    if (!sticky || !els.boardThead || !els.boardTable) {
      return;
    }

    const table = sticky.querySelector(".board-sticky-header-table");
    if (!table) {
      return;
    }

    table.innerHTML = "";
    table.appendChild(els.boardThead.cloneNode(true));

    const originalHeaders = Array.from(els.boardThead.querySelectorAll("th"));
    const cloneHeaders = Array.from(table.querySelectorAll("th"));
    let totalWidth = 0;

    originalHeaders.forEach((header, index) => {
      const width = Math.ceil(header.getBoundingClientRect().width);
      totalWidth += width;
      if (cloneHeaders[index]) {
        cloneHeaders[index].style.width = `${width}px`;
        cloneHeaders[index].style.minWidth = `${width}px`;
        cloneHeaders[index].style.maxWidth = `${width}px`;
      }
    });

    table.style.width = `${Math.max(totalWidth, Math.ceil(els.boardTable.getBoundingClientRect().width))}px`;
    updateBoardStickyHeaderPosition();
  }

  function updateBoardStickyHeaderPosition() {
    if (currentView !== "board" || !els.boardStickyHeader || !els.boardTableWrap || !els.boardTableScroll || !els.boardThead) {
      if (els.boardStickyHeader) {
        els.boardStickyHeader.classList.remove("is-visible");
      }
      return;
    }

    const wrapRect = els.boardTableWrap.getBoundingClientRect();
    const headerRect = els.boardThead.getBoundingClientRect();
    const topOffset = getTopChromeOffset();
    const headerHeight = Math.ceil(headerRect.height || 48);
    const shouldShow = wrapRect.top <= topOffset && wrapRect.bottom - headerHeight > topOffset;

    if (!shouldShow) {
      els.boardStickyHeader.classList.remove("is-visible");
      return;
    }

    const clip = els.boardStickyHeader.querySelector(".board-sticky-header-clip");
    const fill = els.boardStickyHeader.querySelector(".board-sticky-header-fill");
    const table = els.boardStickyHeader.querySelector(".board-sticky-header-table");
    els.boardStickyHeader.classList.add("is-visible");
    els.boardStickyHeader.style.top = "0px";
    els.boardStickyHeader.style.left = `${Math.round(wrapRect.left)}px`;
    els.boardStickyHeader.style.width = `${Math.round(wrapRect.width)}px`;
    if (fill) {
      fill.style.height = `${topOffset}px`;
    }
    if (clip) {
      clip.style.height = `${headerHeight}px`;
    }
    if (table) {
      table.style.transform = `translateX(${-els.boardTableScroll.scrollLeft}px)`;
    }
  }

  function wireUi() {
    bind(els.btnAddGoal, "click", openGoalDialog);
    bind(els.btnAddPage, "click", openPageDialog);
    bind(els.btnQuickAddPage, "click", () => {
      createPage(null);
    });
    bind(els.btnAddTask, "click", addRow);
    bind(els.btnAddTeam, "click", openTeamDialog);
    bind(els.btnCancelGoal, "click", closeGoalDialog);
    bind(els.btnCancelGoalDescription, "click", closeGoalDescriptionDialog);
    bind(els.btnCancelPage, "click", closePageDialog);
    bind(els.btnCancelTeam, "click", closeTeamDialog);
    bind(els.btnCancelTeamStyle, "click", closeTeamStyleDialog);
    bind(els.btnCancelWeekTask, "click", closeWeekTaskDialog);
    bind(els.btnConfirmGoal, "click", confirmGoal);
    bind(els.btnConfirmGoalDescription, "click", confirmGoalDescription);
    bind(els.btnConfirmPage, "click", confirmPage);
    bind(els.btnConfirmTeam, "click", confirmTeam);
    bind(els.btnConfirmTeamStyle, "click", confirmTeamStyle);
    bind(els.btnResetTeamStyle, "click", resetTeamStyleInputs);
    bind(els.btnConfirmWeekTask, "click", confirmWeekTask);
    bind(els.btnClearFilters, "click", clearBoardFilters);
    bind(els.btnDelegatable, "click", toggleDelegatableMode);
    bind(els.btnDone, "click", toggleDone);
    bind(els.btnFocus, "click", toggleFocusMode);
    bind(els.btnSmart, "click", toggleSmartSort);
    bind(els.toggleCreatedAt, "change", toggleCreatedAtVisibility);
    bind(els.btnLogout, "click", logoutSession);
    bind(els.btnWeekPrev, "click", () => shiftWeek(-7));
    bind(els.btnWeekToday, "click", resetWeekToToday);
    bind(els.btnWeekNext, "click", () => shiftWeek(7));
    bind(els.btnSaveCalendarFeed, "click", saveCalendarFeed);
    bind(els.btnRefreshCalendar, "click", refreshCalendarFeed);
    bind(els.btnDeletePage, "click", deleteCurrentPage);
    bind(els.btnPageFocus, "click", togglePageFocusMode);
    bind(els.topChromePeek, "click", handleTopChromePeekClick);
    els.topChromeNavLinks.forEach((link) => bind(link, "click", handleTopChromeNavClick));
    bind(els.boardTableScroll, "scroll", updateBoardStickyHeaderPosition);
    bind(els.btnExport, "click", exportCSV);
    bind(els.btnImport, "click", () => els.csvIn?.click());
    bind(els.csvIn, "change", importCSV);
    bind(els.fMode, "change", renderCurrentView);
    bind(els.fOwner, "change", renderCurrentView);
    bind(els.fTime, "change", renderCurrentView);
    bind(els.fSearch, "input", renderCurrentView);
    bind(els.fStatus, "change", renderCurrentView);
    bind(els.fTeam, "change", renderCurrentView);
    bind(els.weekBacklogAreaFilter, "change", onWeekBacklogFilterChange);
    bind(els.weekBacklogGoalFilter, "change", onWeekBacklogFilterChange);
    bind(els.teamOverlay, "click", (event) => {
      if (event.target === els.teamOverlay) {
        closeTeamDialog();
      }
    });
    bind(els.teamStyleOverlay, "click", (event) => {
      if (event.target === els.teamStyleOverlay) {
        closeTeamStyleDialog();
      }
    });
    bind(els.goalOverlay, "click", (event) => {
      if (event.target === els.goalOverlay) {
        closeGoalDialog();
      }
    });
    bind(els.pageOverlay, "click", (event) => {
      if (event.target === els.pageOverlay) {
        closePageDialog();
      }
    });
    bind(els.goalDescriptionOverlay, "click", (event) => {
      if (event.target === els.goalDescriptionOverlay) {
        closeGoalDescriptionDialog();
      }
    });
    bind(els.weekTaskOverlay, "click", (event) => {
      if (event.target === els.weekTaskOverlay) {
        closeWeekTaskDialog();
      }
    });
    document.addEventListener("mousemove", handleTopChromeMouseMove, { passive: true });
    document.addEventListener("keydown", handleTopChromeKeydown);
    window.addEventListener("scroll", updateBoardStickyHeaderPosition, { passive: true });
    window.addEventListener("resize", updateBoardStickyHeaderPosition, { passive: true });
    bind(els.newGoalInput, "keydown", (event) => {
      if (event.key === "Enter") {
        confirmGoal();
      }
    });
    bind(els.newPageInput, "keydown", (event) => {
      if (event.key === "Enter") {
        confirmPage();
      }
    });
    bind(els.goalDescriptionInput, "keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        confirmGoalDescription();
      }
    });
    bind(els.pageTitleInput, "input", onPageTitleInput);
    bind(els.pageTitleInput, "blur", normalizeCurrentPageTitle);
    bind(els.pageSearchInput, "input", onPageSearchInput);
    bind(els.pageBodyInput, "input", onPageBodyInput);
    bind(els.pageBodyInput, "keydown", onPageBodyKeyDown);
    bind(els.pageBodyInput, "paste", onPageBodyPaste);
    bind(els.pageBodyInput, "click", onPageBodyClick);
    bind(els.pageBodyInput, "focus", updatePageToolbarState);
    bind(els.pageBodyInput, "focus", updatePageEmojiAutocomplete);
    bind(els.pageBodyInput, "keyup", updatePageToolbarState);
    bind(els.pageBodyInput, "keyup", updatePageEmojiAutocomplete);
    bind(els.pageEditorScroll, "scroll", updatePageToolbarState);
    bind(els.teamStyleTextColor, "input", updateTeamStylePreview);
    bind(els.teamStyleBgColor, "input", updateTeamStylePreview);
    bind(els.newTeamInput, "keydown", (event) => {
      if (event.key === "Enter") {
        confirmTeam();
      }
    });
    els.pageToolButtons.forEach((button) => {
      bind(button, "click", () => applyPageCommand(button.dataset.pageCommand || ""));
    });
    els.pageImagePresetButtons.forEach((button) => {
      bind(button, "click", () => setSelectedPageImageWidth(button.dataset.pageImageSize));
    });
    bind(els.pageImageSizeInput, "input", onPageImageSizeInput);
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
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onGlobalKeyDown);
    document.addEventListener("mousemove", onPageMouseMove);
    document.addEventListener("mouseup", onPageMouseUp);
    document.addEventListener("selectionchange", onDocumentSelectionChange);

    document.querySelectorAll("th[data-sort]").forEach((header) => {
      header.addEventListener("click", () => sortBy(header.dataset.sort));
    });
  }

  function onDocumentClick(event) {
    if (currentView === "pages") {
      if (
        event.target.closest(".page-image-block") ||
        event.target.closest(".page-image-menu")
      ) {
        return;
      }
      clearSelectedPageImage();
      return;
    }

    if (!["week", "goals"].includes(currentView)) {
      return;
    }

    if (
      event.target.closest(".week-card-menu") ||
      event.target.closest(".week-card-menu-btn")
    ) {
      return;
    }

    if (state.weekCardMenuTaskId || state.goalCardMenuName) {
      state.weekCardMenuTaskId = null;
      state.goalCardMenuName = null;
      renderCurrentView();
    }
  }

  function onGlobalKeyDown(event) {
    if (currentView === "pages" && state.pageFocusMode && event.key === "Escape") {
      exitPageFocusMode();
    }
  }

  function onDocumentSelectionChange() {
    if (currentView !== "pages") {
      return;
    }
    updatePageToolbarState();
    updatePageEmojiAutocomplete();
  }

  function teamColor(team) {
    const teamName = String(team || "").trim();
    const defaultStyle = defaultTeamStyle(teamName);
    const style = state.teamStyles[teamName];
    const textColor = normalizeHexColor(style?.color, defaultStyle.color);
    const backgroundBase = normalizeHexColor(style?.background, defaultStyle.background);
    const fallbackBackground = TEAM_COLORS[teamName]?.[1] || colorToRgba(defaultStyle.background, 0.18);
    return [
      textColor,
      style ? colorToRgba(backgroundBase, 0.18) : fallbackBackground,
    ];
  }

  function normalizeHexColor(value, fallback = "#a78bfa") {
    const input = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(input)) {
      return input.toLowerCase();
    }
    if (/^#[0-9a-f]{3}$/i.test(input)) {
      const [, r, g, b] = input;
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return fallback;
  }

  function colorToRgba(hex, alpha = 0.18) {
    const normalized = normalizeHexColor(hex);
    const red = parseInt(normalized.slice(1, 3), 16);
    const green = parseInt(normalized.slice(3, 5), 16);
    const blue = parseInt(normalized.slice(5, 7), 16);
    const opacity = Math.max(0, Math.min(1, Number(alpha) || 0));
    return `rgba(${red},${green},${blue},${opacity})`;
  }

  function defaultTeamStyle(team) {
    const defaultColor = normalizeHexColor(TEAM_COLORS[String(team || "").trim()]?.[0], "#a78bfa");
    return {
      color: defaultColor,
      background: defaultColor,
    };
  }

  function normalizeSettings(settings) {
    const normalized = {};
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return normalized;
    }

    Object.entries(settings).forEach(([key, value]) => {
      const name = String(key || "").trim();
      if (!name) {
        return;
      }
      normalized[name] = String(value || "");
    });

    return normalized;
  }

  function normalizeTeamStyles(styles) {
    const normalized = {};
    if (!styles || typeof styles !== "object" || Array.isArray(styles)) {
      return normalized;
    }

    Object.entries(styles).forEach(([teamName, style]) => {
      const name = String(teamName || "").trim();
      if (!name || !style || typeof style !== "object" || Array.isArray(style)) {
        return;
      }

      normalized[name] = {
        color: normalizeHexColor(style.color, defaultTeamStyle(name).color),
        background: normalizeHexColor(style.background, defaultTeamStyle(name).background),
      };
    });

    return normalized;
  }

  function parseTeamStylesSetting(rawValue) {
    try {
      return normalizeTeamStyles(JSON.parse(String(rawValue || "{}")));
    } catch (error) {
      return {};
    }
  }

  function syncTeamStylesWithTeams() {
    const validNames = new Set(state.teams.map((team) => String(team || "").trim()).filter(Boolean));
    const nextStyles = {};
    Object.entries(state.teamStyles || {}).forEach(([teamName, style]) => {
      if (validNames.has(teamName)) {
        nextStyles[teamName] = style;
      }
    });
    state.teamStyles = nextStyles;
  }

  function serializeTeamStyles() {
    const serialized = {};
    Object.entries(state.teamStyles || {}).forEach(([teamName, style]) => {
      const defaultStyle = defaultTeamStyle(teamName);
      const color = normalizeHexColor(style?.color, defaultStyle.color);
      const background = normalizeHexColor(style?.background, defaultStyle.background);
      if (color === defaultStyle.color && background === defaultStyle.background) {
        return;
      }
      serialized[teamName] = { color, background };
    });
    return JSON.stringify(serialized);
  }

  function loginRedirectUrl() {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return `/login.html?next=${encodeURIComponent(next)}`;
  }

  function redirectToLogin() {
    window.location.replace(loginRedirectUrl());
  }

  async function ensureAuthorizedResponse(response) {
    if (response.status !== 401) {
      return response;
    }

    redirectToLogin();
    throw new Error("Authentication required");
  }

  async function requestState(method, body) {
    const response = await ensureAuthorizedResponse(await fetch(API_STATE_URL, {
      method,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }));

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
    const response = await ensureAuthorizedResponse(await fetch(url, {
      cache: "no-store",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    }));

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  async function logoutSession() {
    try {
      await fetch(API_SESSION_LOGOUT_URL, {
        method: "POST",
        cache: "no-store",
      });
    } catch (error) {
      console.error(error);
    } finally {
      window.location.assign("/login.html");
    }
  }

  async function loadData({ showReloadToast = false } = {}) {
    state.isReloading = true;

    try {
      const response = await requestState("GET");
      const payload = await response.json();
      state.tasks = normalizeTasks(payload.tasks || []);
      state.teams = normalizeTeams(payload.teams || [], state.tasks);
      state.goals = normalizeGoals(payload.goals || [], state.tasks);
      state.pages = normalizePages(payload.pages || []);
      state.settings = normalizeSettings(payload.settings || {});
      state.teamStyles = parseTeamStylesSetting(state.settings[SETTINGS_TEAM_COLORS_KEY]);
      syncTeamStylesWithTeams();
      syncCollapsedPagePreferenceWithPages();
      state.calendarFeedUrl = String(state.settings.calendar_feed_url || "").trim();
      ensureCurrentPageSelection();
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
        goal: parseGoalReference(task.goal).name,
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

  function normalizePages(pages) {
    const ordered = [];
    const seen = new Set();
    const rawParents = new Map();

    (pages || []).forEach((page, index) => {
      if (!page || typeof page !== "object" || Array.isArray(page)) {
        return;
      }
      let id = Number(page.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
        id = Date.now() + index + ordered.length;
      }
      while (seen.has(id)) {
        id += 1;
      }
      seen.add(id);
      const rawParentId = Number(page.parent_id);
      rawParents.set(id, Number.isFinite(rawParentId) && rawParentId > 0 ? rawParentId : null);
      ordered.push({
        id,
        parent_id: null,
        title: String(page.title || "").trim() || "Untitled page",
        body: String(page.body || ""),
        created_at: String(page.created_at || "").trim(),
        updated_at: String(page.updated_at || "").trim(),
      });
    });

    const idSet = new Set(ordered.map((page) => page.id));
    ordered.forEach((page) => {
      const parentId = rawParents.get(page.id);
      page.parent_id = parentId && parentId !== page.id && idSet.has(parentId) ? parentId : null;
    });

    return ordered;
  }

  function normalizeGoals(goals, tasks) {
    const ordered = [];
    const seen = new Set();

    const addGoal = (name, description = "") => {
      const parsed = parseGoalReference(
        name && typeof name === "object" && !Array.isArray(name)
          ? { name: name.name, description }
          : name,
      );
      const normalizedName = parsed.name;
      if (!normalizedName || seen.has(normalizedName)) {
        return;
      }
      seen.add(normalizedName);
      ordered.push({
        name: normalizedName,
        description: parsed.description || String(description || "").trim(),
      });
    };

    (goals || []).forEach((goal) => {
      if (goal && typeof goal === "object" && !Array.isArray(goal)) {
        addGoal(goal.name, goal.description);
      } else {
        addGoal(goal, "");
      }
    });

    (tasks || []).forEach((task) => {
      addGoal(task.goal, "");
    });

    return ordered;
  }

  function parseGoalReference(goal) {
    let name = "";
    let description = "";

    if (goal && typeof goal === "object" && !Array.isArray(goal)) {
      name = String(goal.name || "").trim();
      description = String(goal.description || "").trim();
    } else {
      name = String(goal || "").trim();
    }

    let iterations = 0;
    while (name && iterations < 6) {
      const nextName = extractStructuredField(name, "name");
      if (!nextName || nextName === name) {
        break;
      }
      const nextDescription = extractStructuredField(name, "description");
      name = nextName.trim();
      if (!description && nextDescription) {
        description = nextDescription.trim();
      }
      iterations += 1;
    }

    return { name, description };
  }

  function extractStructuredField(source, fieldName) {
    const text = String(source || "").trim();
    const pattern = new RegExp(`[\"']${fieldName}[\"']\\s*:\\s*([\"'])(.*?)\\1`);
    const match = text.match(pattern);
    return match ? match[2] : "";
  }

  function goalNames(goals = state.goals) {
    return (goals || [])
      .map((goal) => parseGoalReference(goal).name)
      .filter(Boolean);
  }

  function findGoal(goalName) {
    const normalizedName = parseGoalReference(goalName).name;
    return state.goals.find((goal) => goal.name === normalizedName) || null;
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
      settings: {
        ...state.settings,
        calendar_feed_url: state.calendarFeedUrl,
        [SETTINGS_TEAM_COLORS_KEY]: serializeTeamStyles(),
      },
      goals: state.goals.map((goal) => ({
        name: goal.name,
        description: goal.description || "",
      })),
      pages: state.pages.map((page) => ({
        id: page.id,
        parent_id: page.parent_id ?? null,
        title: page.title,
        body: page.body,
        created_at: page.created_at || "",
        updated_at: page.updated_at || "",
      })),
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

  function onWeekBacklogFilterChange() {
    state.weekBacklogGoalFilter = String(els.weekBacklogGoalFilter?.value || "");
    state.weekBacklogAreaFilter = String(els.weekBacklogAreaFilter?.value || "");
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

  function openPageDialog() {
    if (!els.pageOverlay || !els.newPageInput) {
      return;
    }

    els.pageOverlay.classList.add("open");
    els.newPageInput.focus();
  }

  function closeTeamDialog() {
    if (!els.teamOverlay || !els.newTeamInput) {
      return;
    }

    els.teamOverlay.classList.remove("open");
    els.newTeamInput.value = "";
  }

  function openTeamStyleDialog(teamName) {
    const name = String(teamName || "").trim();
    if (
      !name ||
      !els.teamStyleOverlay ||
      !els.teamStyleTextColor ||
      !els.teamStyleBgColor
    ) {
      return;
    }

    state.teamStyleEditingName = name;
    if (els.teamStyleHeading) {
      els.teamStyleHeading.textContent = `Area colors · ${name}`;
    }

    const style = state.teamStyles[name] || defaultTeamStyle(name);
    els.teamStyleTextColor.value = normalizeHexColor(style.color, defaultTeamStyle(name).color);
    els.teamStyleBgColor.value = normalizeHexColor(style.background, defaultTeamStyle(name).background);
    els.teamStyleOverlay.classList.add("open");
    updateTeamStylePreview();
    els.teamStyleTextColor.focus();
  }

  function closeGoalDialog() {
    if (!els.goalOverlay || !els.newGoalInput) {
      return;
    }

    els.goalOverlay.classList.remove("open");
    els.newGoalInput.value = "";
  }

  function closePageDialog() {
    if (!els.pageOverlay || !els.newPageInput) {
      return;
    }

    els.pageOverlay.classList.remove("open");
    els.newPageInput.value = "";
  }

  function closeTeamStyleDialog() {
    if (!els.teamStyleOverlay) {
      return;
    }

    els.teamStyleOverlay.classList.remove("open");
    state.teamStyleEditingName = "";
  }

  function resetTeamStyleInputs() {
    const teamName = state.teamStyleEditingName;
    if (!teamName || !els.teamStyleTextColor || !els.teamStyleBgColor) {
      return;
    }

    const defaults = defaultTeamStyle(teamName);
    els.teamStyleTextColor.value = defaults.color;
    els.teamStyleBgColor.value = defaults.background;
    updateTeamStylePreview();
  }

  function updateTeamStylePreview() {
    const teamName = state.teamStyleEditingName || "Area";
    const textColor = normalizeHexColor(els.teamStyleTextColor?.value, defaultTeamStyle(teamName).color);
    const background = normalizeHexColor(els.teamStyleBgColor?.value, defaultTeamStyle(teamName).background);

    if (els.teamStylePreviewBadge) {
      els.teamStylePreviewBadge.textContent = compactAreaLabel(teamName) || "Area";
      els.teamStylePreviewBadge.style.color = textColor;
      els.teamStylePreviewBadge.style.background = colorToRgba(background, 0.18);
    }

    if (els.teamStylePreviewHeader) {
      els.teamStylePreviewHeader.textContent = teamName.toUpperCase();
      els.teamStylePreviewHeader.style.color = textColor;
    }
  }

  function confirmTeamStyle() {
    const teamName = String(state.teamStyleEditingName || "").trim();
    if (!teamName || !els.teamStyleTextColor || !els.teamStyleBgColor) {
      return;
    }

    const defaults = defaultTeamStyle(teamName);
    const nextStyle = {
      color: normalizeHexColor(els.teamStyleTextColor.value, defaults.color),
      background: normalizeHexColor(els.teamStyleBgColor.value, defaults.background),
    };

    if (
      nextStyle.color === defaults.color &&
      nextStyle.background === defaults.background
    ) {
      delete state.teamStyles[teamName];
    } else {
      state.teamStyles[teamName] = nextStyle;
    }

    closeTeamStyleDialog();
    void saveTasks({ message: "Area colors updated" });
    renderCurrentView();
  }

  function openGoalDescriptionDialog(goalName) {
    const goal = findGoal(goalName);
    if (!goal || !els.goalDescriptionOverlay || !els.goalDescriptionInput) {
      return;
    }

    state.goalEditingName = goalName;
    state.goalCardMenuName = null;
    if (els.goalDescriptionHeading) {
      els.goalDescriptionHeading.textContent = "Edit goal description";
    }
    if (els.goalDescriptionLabel) {
      els.goalDescriptionLabel.textContent = goalName;
    }
    els.goalDescriptionInput.value = goal.description || "";
    els.goalDescriptionOverlay.classList.add("open");
    els.goalDescriptionInput.focus();
    els.goalDescriptionInput.setSelectionRange(
      els.goalDescriptionInput.value.length,
      els.goalDescriptionInput.value.length,
    );
    renderCurrentView();
  }

  function closeGoalDescriptionDialog() {
    if (!els.goalDescriptionOverlay || !els.goalDescriptionInput) {
      return;
    }

    els.goalDescriptionOverlay.classList.remove("open");
    els.goalDescriptionInput.value = "";
    state.goalEditingName = "";
  }

  function openWeekTaskDialog(isoDate, hour, task = null, draft = {}) {
    if (!els.weekTaskOverlay || !els.weekTaskInput) {
      return;
    }

    state.weekDraftSlot = isoDate || hour ? { isoDate, hour } : null;
    state.weekEditingTaskId = task ? task.id : null;
    populateWeekTaskForm(isoDate, hour, task, draft);
    if (els.weekTaskSlotLabel) {
      if (draft.slotLabel) {
        els.weekTaskSlotLabel.textContent = draft.slotLabel;
      } else if (task && (!task.scheduled_date || !task.scheduled_hour)) {
        els.weekTaskSlotLabel.textContent = "No week slot yet. Set date and hour below if needed.";
      } else if (!isoDate || !hour) {
        els.weekTaskSlotLabel.textContent = "No week slot yet. Set date and hour below if needed.";
      } else {
        els.weekTaskSlotLabel.textContent = `${formatWeekday(isoDate)}, ${formatDayShort(isoDate)} at ${hour}`;
      }
    }
    if (els.weekTaskHeading) {
      els.weekTaskHeading.textContent = task ? "Edit task" : "Add task to week";
    }
    if (els.btnConfirmWeekTask) {
      els.btnConfirmWeekTask.textContent = task ? "Save" : "Add";
    }
    els.weekTaskOverlay.classList.add("open");
    els.weekTaskInput.focus();
  }

  function closeWeekTaskDialog() {
    if (!els.weekTaskOverlay || !els.weekTaskInput) {
      return;
    }

    els.weekTaskOverlay.classList.remove("open");
    els.weekTaskInput.value = "";
    if (els.weekTaskNotes) {
      els.weekTaskNotes.value = "";
    }
    if (els.weekTaskCreatedAt) {
      els.weekTaskCreatedAt.textContent = "—";
      els.weekTaskCreatedAt.classList.add("is-empty");
    }
    if (els.weekTaskCreatedField) {
      els.weekTaskCreatedField.hidden = true;
    }
    state.weekDraftSlot = null;
    state.weekEditingTaskId = null;
    state.weekCardMenuTaskId = null;
  }

  function populateWeekTaskForm(isoDate, hour, task = null, draft = {}) {
    setWeekTaskSelectOptions(els.weekTaskTeam, state.teams, "No area");
    setWeekTaskSelectOptions(els.weekTaskGoal, goalNames(), "No goal");

    if (els.weekTaskInput) {
      els.weekTaskInput.value = task?.name || draft.name || "";
    }
    if (els.weekTaskStatus) {
      els.weekTaskStatus.value = task?.status || draft.status || "Not started";
    }
    if (els.weekTaskTeam) {
      els.weekTaskTeam.value = task?.team || draft.team || els.fTeam?.value || "";
    }
    if (els.weekTaskMode) {
      els.weekTaskMode.value = task?.mode || draft.mode || "";
    }
    if (els.weekTaskOwner) {
      els.weekTaskOwner.value = task?.owner || draft.owner || "";
    }
    if (els.weekTaskPriority) {
      els.weekTaskPriority.value = task?.priority || draft.priority || "";
    }
    if (els.weekTaskTime) {
      els.weekTaskTime.value = task?.time_estimate || draft.time_estimate || "";
    }
    if (els.weekTaskGoal) {
      els.weekTaskGoal.value = task?.goal || draft.goal || "";
    }
    if (els.weekTaskDeadline) {
      els.weekTaskDeadline.value = task?.deadline || draft.deadline || "";
    }
    if (els.weekTaskCreatedAt) {
      const createdAt = task?.created_at || "";
      els.weekTaskCreatedAt.textContent = createdAt ? formatDate(createdAt) : "—";
      els.weekTaskCreatedAt.classList.toggle("is-empty", !createdAt);
    }
    if (els.weekTaskCreatedField) {
      els.weekTaskCreatedField.hidden = !task;
    }
    if (els.weekTaskDate) {
      els.weekTaskDate.value = task?.scheduled_date || draft.scheduled_date || isoDate || "";
    }
    if (els.weekTaskHour) {
      els.weekTaskHour.value = task?.scheduled_hour || draft.scheduled_hour || hour || "";
    }
    if (els.weekTaskNotes) {
      els.weekTaskNotes.value = task?.notes || draft.notes || "";
    }
  }

  function setWeekTaskSelectOptions(select, values, emptyLabel) {
    if (!select) {
      return;
    }

    const selected = select.value;
    select.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = emptyLabel;
    select.appendChild(emptyOption);

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    select.value = values.includes(selected) ? selected : "";
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

    if (!goalNames().includes(value)) {
      state.goals.push({ name: value, description: "" });
      void saveTasks({ message: "Goal added" });
      renderCurrentView();
    }

    closeGoalDialog();
  }

  function confirmPage() {
    const value = String(els.newPageInput?.value || "").trim() || "Untitled page";
    createPage(null, value, { toastMessage: "Page added" });
    closePageDialog();
  }

  function confirmGoalDescription() {
    const goalName = state.goalEditingName;
    if (!goalName || !els.goalDescriptionInput) {
      return;
    }

    const description = els.goalDescriptionInput.value;
    void updateGoalDescription(goalName, description).then(() => {
      closeGoalDescriptionDialog();
      renderCurrentView();
    });
  }

  function confirmWeekTask() {
    const name = String(els.weekTaskInput?.value || "").trim();
    if (!name) {
      return;
    }

    const status = String(els.weekTaskStatus?.value || "Not started").trim() || "Not started";
    const scheduledDate = normalizeIsoDate(els.weekTaskDate?.value || "");
    const scheduledHour = normalizeScheduledHour(els.weekTaskHour?.value || "");
    const hasScheduledSlot = scheduledDate && scheduledHour;
    const priority = normalizePriority(els.weekTaskPriority?.value || "");
    const existingTask = state.tasks.find((entry) => entry.id === state.weekEditingTaskId);
    const taskPayload = {
      name,
      status,
      team: String(els.weekTaskTeam?.value || "").trim(),
      mode: normalizeMode(els.weekTaskMode?.value || ""),
      owner: normalizeOwner(els.weekTaskOwner?.value || ""),
      priority,
      time_estimate: normalizeTimeEstimate(els.weekTaskTime?.value || ""),
      goal: String(els.weekTaskGoal?.value || "").trim(),
      deadline: normalizeIsoDate(els.weekTaskDeadline?.value || ""),
      scheduled_date: hasScheduledSlot ? scheduledDate : "",
      scheduled_hour: hasScheduledSlot ? scheduledHour : "",
      notes: String(els.weekTaskNotes?.value || "").trim(),
    };

    if (existingTask) {
      const previousStatus = existingTask.status;
      Object.assign(existingTask, taskPayload, {
        completed_at: nextCompletedAt(existingTask.completed_at, previousStatus, status),
      });
    } else {
      const task = buildTaskDraft({
        ...taskPayload,
        completed_at: nextCompletedAt("", "", status),
      });
      state.tasks.unshift(task);
    }
    syncTeamsFromTasks();
    rebuildTeamFilter();
    closeWeekTaskDialog();
    void saveTasks({ message: existingTask ? "Task updated" : "Task added to week" });
    renderCurrentView();
  }

  function openGoalTaskDialog(goalName) {
    openWeekTaskDialog("", "", null, {
      goal: goalName,
      slotLabel: `New task linked to goal: ${goalName}`,
    });
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

  function hasActiveBoardFilters() {
    return Boolean(
      (els.fTeam && els.fTeam.value) ||
      (els.fStatus && els.fStatus.value) ||
      (els.fMode && els.fMode.value) ||
      (els.fOwner && els.fOwner.value) ||
      (els.fTime && els.fTime.value) ||
      (els.fSearch && String(els.fSearch.value || "").trim()),
    );
  }

  function isManualBoardOrderMode() {
    return !hasActiveBoardFilters() && !state.sortCol && !state.smartSort && !state.focusMode && !state.delegatableMode;
  }

  function clearBoardFilters({ render = true } = {}) {
    if (els.fTeam) {
      els.fTeam.value = "";
    }
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

    state.delegatableMode = false;
    els.btnDelegatable?.classList.remove("is-active");
    state.focusMode = false;
    els.btnFocus?.classList.remove("is-active");
    state.smartSort = false;
    els.btnSmart?.classList.remove("is-active");
    state.sortCol = "";
    state.sortDir = 1;
    updateSortIndicators();
    if (render) {
      renderCurrentView();
    }
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
      return [...data];
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

  function toggleCreatedAtVisibility() {
    state.showCreatedAt = Boolean(els.toggleCreatedAt?.checked);
    if (!state.showCreatedAt && state.sortCol === "created_at") {
      state.sortCol = "";
      state.sortDir = 1;
      updateSortIndicators();
    }
    persistShowCreatedAtPreference();
    syncCreatedAtVisibility();
    renderCurrentView();
  }

  function renderCurrentView() {
    updateTopChromeInteractionState();
    if (currentView !== "pages") {
      closePageEmojiMenu();
    }
    if (currentView === "goals") {
      renderGoalsView();
      return;
    }

    if (currentView === "week") {
      renderWeekView();
      return;
    }

    if (currentView === "pages") {
      renderPagesView();
      return;
    }

    renderTable();
  }

  function renderTable() {
    if (!els.tbody || !els.statsLine) {
      return;
    }

    const data = getFilteredTasks();
    const manualMode = isManualBoardOrderMode();
    const hasComputedBoardView = hasActiveBoardFilters() || !!state.sortCol || state.smartSort || state.focusMode || state.delegatableMode;
    els.btnClearFilters?.classList.toggle("is-active", hasComputedBoardView);
    els.statsLine.textContent = state.delegatableMode
      ? `Delegatable ${data.length} of ${state.tasks.length} tasks`
      : state.focusMode
        ? `Focus ${data.length} of ${state.tasks.length} tasks`
        : manualMode
          ? `${data.length} of ${state.tasks.length} tasks · custom order`
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
        if (manualMode) {
          els.tbody.appendChild(buildInsertRow(task.id, teamName));
        }
        els.tbody.appendChild(buildRow(task));
      });
      if (manualMode) {
        els.tbody.appendChild(buildInsertRow(null, teamName));
      }
    });

    renderInsertRail();
    syncBoardStickyHeader();
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

    goals.forEach((goal) => {
      const goalTasks = state.tasks
        .filter((task) => task.goal === goal.name)
        .sort(compareGoalTasks);
      els.goalList.appendChild(buildGoalCard(goal, goalTasks));
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
    const doneThisWeek = state.tasks
      .filter((task) => isTaskDoneThisWeek(task, weekSet))
      .sort(compareWeekCompletedTasks);
    const focusTasks = buildFocusList(openTasks);
    const scheduledThisWeek = state.tasks.filter(
      (task) =>
        weekSet.has(task.scheduled_date) &&
        task.scheduled_hour &&
        (task.status !== "Done" || isTaskDoneThisWeek(task, weekSet)),
    ).sort(compareWeekScheduledTasks);
    const backlogTasks = focusTasks
      .filter((task) => !weekSet.has(task.scheduled_date) || !task.scheduled_hour)
      .sort(compareWeekBacklogTasks);
    rebuildWeekBacklogFilters(backlogTasks, doneThisWeek);
    const filteredBacklogTasks = backlogTasks.filter(matchesWeekBacklogFilters);
    const filteredDoneThisWeek = doneThisWeek.filter(matchesWeekBacklogFilters);

    els.weekLabel.textContent = formatWeekLabel(weekDates);
    els.statsLine.textContent = `${focusTasks.length} focus tasks · ${scheduledThisWeek.length} scheduled · ${backlogTasks.length} still to place · ${doneThisWeek.length} done this week`;
    if (els.weekBacklogCount) {
      els.weekBacklogCount.textContent = hasWeekBacklogFilters()
        ? `${filteredBacklogTasks.length} of ${backlogTasks.length} to place`
        : `${backlogTasks.length} to place`;
    }

    renderWeekBacklog(filteredBacklogTasks, filteredDoneThisWeek);
    renderWeekCalendar(weekDates, scheduledThisWeek, state.weekEvents);
  }

  function renderPagesView() {
    if (
      !els.pageList ||
      !els.pageTitleInput ||
      !els.pageBodyInput ||
      !els.pageEmpty ||
      !els.pageMeta ||
      !els.statsLine
    ) {
      return;
    }

    ensureCurrentPageSelection();
    document.body.classList.toggle("page-focus-mode", state.pageFocusMode);
    els.pageList.replaceChildren();
    if (els.pageSearchInput && els.pageSearchInput.value !== state.pageSearchQuery) {
      els.pageSearchInput.value = state.pageSearchQuery;
    }
    updatePagesStatsLine();
    if (els.btnPageFocus) {
      els.btnPageFocus.textContent = state.pageFocusMode ? "Close" : "Focus";
    }
    renderPagesListOnly();

    const page = getCurrentPage();
    if (!page) {
      els.pageEmpty.style.display = "flex";
      els.pageTitleInput.style.display = "none";
      els.pageBodyInput.style.display = "none";
      clearSelectedPageImage();
      closePageEmojiMenu();
      if (els.btnDeletePage) {
        els.btnDeletePage.disabled = true;
      }
      els.pageMeta.textContent = "";
      return;
    }

    els.pageEmpty.style.display = "none";
    els.pageTitleInput.style.display = "";
    els.pageBodyInput.style.display = "";
    els.pageTitleInput.value = page.title;
    els.pageBodyInput.innerHTML = renderPageBody(page.body);
    clearSelectedPageImage();
    els.pageMeta.textContent = page.updated_at
      ? `Updated ${formatPageTimestamp(page.updated_at)}`
      : "";
    if (els.btnDeletePage) {
      els.btnDeletePage.disabled = false;
    }
    updatePageToolbarState();
    updatePageEmojiAutocomplete();
  }

  function buildPageListItem(page, depth, hasChildren) {
    const searchActive = Boolean(getNormalizedPageSearchQuery());
    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-list-item${state.currentPageId === page.id ? " is-active" : ""}`;
    button.draggable = true;
    button.dataset.pageId = String(page.id);
    button.dataset.pageDepth = String(depth);
    button.style.setProperty("--page-depth", String(depth));
    button.style.setProperty("--page-nest-offset", `${depth * 16}px`);
    if (depth > 0) {
      button.classList.add("is-nested");
    }
    button.addEventListener("click", () => {
      if (Date.now() < state.pageSuppressClickUntil) {
        return;
      }
      state.currentPageId = page.id;
      persistLastPageIdPreference(page.id);
      renderCurrentView();
    });
    button.addEventListener("mousedown", onPageMouseDown);
    button.addEventListener("dragstart", onPageDragStart);
    button.addEventListener("dragover", onPageDragOver);
    button.addEventListener("drop", onPageDrop);
    button.addEventListener("dragend", onPageDragEnd);
    button.addEventListener("touchstart", onPageTouchStart, { passive: true });
    button.addEventListener("touchmove", onPageTouchMove, { passive: false });
    button.addEventListener("touchend", onPageTouchEnd);
    button.addEventListener("touchcancel", onPageTouchCancel);

    const dropTarget = state.pageDropTarget;
    if (dropTarget && dropTarget.targetId === page.id) {
      button.classList.add(
        dropTarget.mode === "before"
          ? "is-drop-before"
          : dropTarget.mode === "after"
            ? "is-drop-after"
            : "is-drop-inside",
      );
    }
    if (state.pageDragId === page.id) {
      button.classList.add("is-dragging");
    }

    if (hasChildren && !searchActive) {
      button.classList.add("has-children");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "page-tree-toggle";
      toggle.textContent = state.pageCollapsedIds.has(page.id) ? "+" : "−";
      toggle.setAttribute(
        "aria-label",
        state.pageCollapsedIds.has(page.id) ? "Expand nested pages" : "Collapse nested pages",
      );
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.pageCollapsedIds.has(page.id)) {
          state.pageCollapsedIds.delete(page.id);
        } else {
          state.pageCollapsedIds.add(page.id);
        }
        persistCollapsedPagePreference();
        renderPagesListOnly();
      });
      button.appendChild(toggle);
    } else if (depth > 0 || (hasChildren && searchActive)) {
      button.classList.add("has-children");
      const spacer = document.createElement("span");
      spacer.className = "page-tree-spacer";
      spacer.setAttribute("aria-hidden", "true");
      button.appendChild(spacer);
    }

    const title = document.createElement("div");
    title.className = "page-list-title";
    title.textContent = page.title;
    button.appendChild(title);

    const addChildButton = document.createElement("button");
    addChildButton.type = "button";
    addChildButton.className = "page-add-child-btn";
    addChildButton.textContent = "+";
    addChildButton.setAttribute("aria-label", `Add sub-page under ${page.title}`);
    addChildButton.addEventListener("click", (event) => {
      event.stopPropagation();
      createPage(page.id, "Untitled page", { toastMessage: "Sub-page added" });
    });
    button.appendChild(addChildButton);

    return button;
  }

  function flattenPageTree() {
    const ordered = [];
    const childrenByParent = buildPageChildrenMap();
    const visited = new Set();
    const pageIds = new Set(state.pages.map((page) => page.id));

    const visit = (parentId, depth) => {
      const children = childrenByParent.get(parentId) || [];
      children.forEach((page) => {
        if (visited.has(page.id)) {
          return;
        }
        visited.add(page.id);
        const hasChildren = (childrenByParent.get(page.id) || []).length > 0;
        ordered.push({ page, depth, hasChildren });
        if (!state.pageCollapsedIds.has(page.id)) {
          visit(page.id, depth + 1);
        }
      });
    };

    visit(null, 0);
    state.pages.forEach((page) => {
      if (visited.has(page.id)) {
        return;
      }
      const hasValidParent =
        Number.isFinite(Number(page.parent_id)) &&
        Number(page.parent_id) > 0 &&
        Number(page.parent_id) !== page.id &&
        pageIds.has(Number(page.parent_id));
      if (hasValidParent) {
        return;
      }
      const hasChildren = (childrenByParent.get(page.id) || []).length > 0;
      ordered.push({ page, depth: 0, hasChildren });
      if (!state.pageCollapsedIds.has(page.id)) {
        visit(page.id, 1);
      }
    });

    return ordered;
  }

  function buildPageChildrenMap() {
    const ids = new Set(state.pages.map((page) => page.id));
    const map = new Map();
    const keyFor = (parentId) => (ids.has(parentId) ? parentId : null);

    state.pages.forEach((page) => {
      const parentId = page.parent_id && ids.has(page.parent_id) && page.parent_id !== page.id
        ? page.parent_id
        : null;
      const key = keyFor(parentId);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(page);
    });

    return map;
  }

  function collectPageDescendants(pageId, childrenByParent = buildPageChildrenMap()) {
    const descendants = new Set();
    const stack = [...(childrenByParent.get(pageId) || [])];

    while (stack.length) {
      const page = stack.pop();
      if (!page || descendants.has(page.id)) {
        continue;
      }
      descendants.add(page.id);
      stack.push(...(childrenByParent.get(page.id) || []));
    }

    return descendants;
  }

  function movePageNode(pageId, targetId, mode) {
    if (!pageId || !targetId || pageId === targetId) {
      return false;
    }

    const clonedPages = state.pages.map((page) => ({ ...page }));
    const pageById = new Map(clonedPages.map((page) => [page.id, page]));
    const dragged = pageById.get(pageId);
    const target = pageById.get(targetId);
    if (!dragged || !target) {
      return false;
    }

    const childrenByParent = new Map();
    const keyFor = (parentId) => (parentId == null ? "root" : String(parentId));
    clonedPages.forEach((page) => {
      const key = keyFor(page.parent_id ?? null);
      if (!childrenByParent.has(key)) {
        childrenByParent.set(key, []);
      }
      childrenByParent.get(key).push(page);
    });

    const descendants = collectPageDescendants(pageId, new Map(
      [...childrenByParent.entries()].map(([key, pages]) => [
        key === "root" ? null : Number(key),
        pages,
      ]),
    ));
    if (descendants.has(targetId)) {
      return false;
    }

    const oldParentKey = keyFor(dragged.parent_id ?? null);
    const oldSiblings = childrenByParent.get(oldParentKey) || [];
    const oldIndex = oldSiblings.findIndex((page) => page.id === pageId);
    if (oldIndex >= 0) {
      oldSiblings.splice(oldIndex, 1);
    }

    let newParentId = null;
    let newParentKey = "root";
    let insertIndex = 0;

    if (mode === "inside") {
      newParentId = target.id;
      newParentKey = keyFor(newParentId);
      const children = childrenByParent.get(newParentKey) || [];
      insertIndex = children.length;
      childrenByParent.set(newParentKey, children);
    } else {
      newParentId = target.parent_id ?? null;
      newParentKey = keyFor(newParentId);
      const siblings = childrenByParent.get(newParentKey) || [];
      const targetIndex = siblings.findIndex((page) => page.id === target.id);
      insertIndex = targetIndex < 0 ? siblings.length : targetIndex + (mode === "after" ? 1 : 0);
      childrenByParent.set(newParentKey, siblings);
    }

    dragged.parent_id = newParentId;
    const destination = childrenByParent.get(newParentKey) || [];
    destination.splice(insertIndex, 0, dragged);
    childrenByParent.set(newParentKey, destination);

    const nextPages = [];
    const visited = new Set();
    const flatten = (parentId) => {
      const key = keyFor(parentId);
      (childrenByParent.get(key) || []).forEach((page) => {
        if (visited.has(page.id)) {
          return;
        }
        visited.add(page.id);
        nextPages.push(page);
        flatten(page.id);
      });
    };

    flatten(null);
    clonedPages.forEach((page) => {
      if (!visited.has(page.id)) {
        page.parent_id = null;
        nextPages.push(page);
        flatten(page.id);
      }
    });

    state.pages = nextPages;
    if (mode === "inside") {
      state.pageCollapsedIds.add(targetId);
      persistCollapsedPagePreference();
    }
    return true;
  }

  function onPageDragStart(event) {
    const pageId = Number(event.currentTarget?.dataset.pageId);
    if (!Number.isFinite(pageId)) {
      return;
    }
    state.pageDragId = pageId;
    state.pageDropTarget = null;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(pageId));
    renderPagesListOnly();
  }

  function onPageDragOver(event) {
    const targetId = Number(event.currentTarget?.dataset.pageId);
    if (!Number.isFinite(targetId) || !Number.isFinite(state.pageDragId) || state.pageDragId === targetId) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const threshold = rect.height * 0.28;
    const mode = offsetY < threshold ? "before" : offsetY > rect.height - threshold ? "after" : "inside";

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (
      !state.pageDropTarget ||
      state.pageDropTarget.targetId !== targetId ||
      state.pageDropTarget.mode !== mode
    ) {
      state.pageDropTarget = { targetId, mode };
      renderPagesListOnly();
    }
  }

  function onPageDrop(event) {
    event.preventDefault();
    const targetId = Number(event.currentTarget?.dataset.pageId);
    const draggedId = state.pageDragId;
    const mode = state.pageDropTarget?.targetId === targetId ? state.pageDropTarget.mode : "after";

    state.pageDragId = null;
    state.pageDropTarget = null;
    if (movePageNode(draggedId, targetId, mode)) {
      schedulePageAutosave();
    }
    renderCurrentView();
  }

  function onPageDragEnd() {
    state.pageDragId = null;
    state.pageDropTarget = null;
    renderPagesListOnly();
  }

  function onPageMouseDown(event) {
    if (event.button !== 0) {
      return;
    }

    const pageId = Number(event.currentTarget?.dataset.pageId);
    if (!Number.isFinite(pageId)) {
      return;
    }

    state.pageMouseDrag = {
      pageId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  }

  function onPageMouseMove(event) {
    const drag = state.pageMouseDrag;
    if (!drag) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.hypot(deltaX, deltaY) < 6) {
        return;
      }
      drag.active = true;
      state.pageDragId = drag.pageId;
      state.pageDropTarget = null;
      document.body.classList.add("page-list-dragging");
      renderPagesListOnly();
    }

    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".page-list-item");
    if (!target) {
      return;
    }

    const targetId = Number(target.dataset.pageId);
    if (!Number.isFinite(targetId) || targetId === drag.pageId) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const threshold = rect.height * 0.28;
    const mode = offsetY < threshold ? "before" : offsetY > rect.height - threshold ? "after" : "inside";

    if (
      !state.pageDropTarget ||
      state.pageDropTarget.targetId !== targetId ||
      state.pageDropTarget.mode !== mode
    ) {
      state.pageDropTarget = { targetId, mode };
      renderPagesListOnly();
    }
  }

  function onPageMouseUp() {
    const drag = state.pageMouseDrag;
    if (!drag) {
      return;
    }

    const draggedId = state.pageDragId;
    const dropTarget = state.pageDropTarget;
    const wasActive = drag.active;

    state.pageMouseDrag = null;
    state.pageDragId = null;
    state.pageDropTarget = null;
    document.body.classList.remove("page-list-dragging");

    if (wasActive) {
      state.pageSuppressClickUntil = Date.now() + 250;
    }

    if (wasActive && dropTarget && movePageNode(draggedId, dropTarget.targetId, dropTarget.mode)) {
      schedulePageAutosave();
      renderCurrentView();
      return;
    }

    if (wasActive) {
      renderPagesListOnly();
    }
  }

  function onPageTouchStart(event) {
    const pageId = Number(event.currentTarget?.dataset.pageId);
    const touch = event.touches?.[0];
    if (!Number.isFinite(pageId) || !touch) {
      return;
    }

    state.pageTouchDrag = {
      pageId,
      startX: touch.clientX,
      startY: touch.clientY,
      active: false,
    };
  }

  function onPageTouchMove(event) {
    const drag = state.pageTouchDrag;
    const touch = event.touches?.[0];
    if (!drag || !touch) {
      return;
    }

    const deltaX = touch.clientX - drag.startX;
    const deltaY = touch.clientY - drag.startY;
    if (!drag.active) {
      if (Math.hypot(deltaX, deltaY) < 8) {
        return;
      }
      drag.active = true;
      state.pageDragId = drag.pageId;
      state.pageDropTarget = null;
      document.body.classList.add("page-list-dragging");
      renderPagesListOnly();
    }

    event.preventDefault();
    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest(".page-list-item");
    if (!target) {
      return;
    }

    const targetId = Number(target.dataset.pageId);
    if (!Number.isFinite(targetId) || targetId === drag.pageId) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const offsetY = touch.clientY - rect.top;
    const threshold = rect.height * 0.28;
    const mode = offsetY < threshold ? "before" : offsetY > rect.height - threshold ? "after" : "inside";

    if (
      !state.pageDropTarget ||
      state.pageDropTarget.targetId !== targetId ||
      state.pageDropTarget.mode !== mode
    ) {
      state.pageDropTarget = { targetId, mode };
      renderPagesListOnly();
    }
  }

  function onPageTouchEnd() {
    const drag = state.pageTouchDrag;
    const draggedId = state.pageDragId;
    const dropTarget = state.pageDropTarget;

    state.pageTouchDrag = null;
    state.pageDragId = null;
    state.pageDropTarget = null;
    document.body.classList.remove("page-list-dragging");

    if (drag?.active && dropTarget && movePageNode(draggedId, dropTarget.targetId, dropTarget.mode)) {
      state.pageSuppressClickUntil = Date.now() + 250;
      schedulePageAutosave();
      renderCurrentView();
      return;
    }

    renderPagesListOnly();
  }

  function onPageTouchCancel() {
    state.pageTouchDrag = null;
    state.pageDragId = null;
    state.pageDropTarget = null;
    document.body.classList.remove("page-list-dragging");
    renderPagesListOnly();
  }

  function isTaskDoneThisWeek(task, weekSet) {
    return task.status === "Done" && !!task.completed_at && weekSet.has(task.completed_at);
  }

  function renderWeekBacklog(tasks, doneTasks = []) {
    els.weekBacklog.replaceChildren();
    els.weekBacklog.ondragover = onWeekBacklogDragOver;
    els.weekBacklog.ondrop = onWeekBacklogDrop;

    if (!tasks.length && !doneTasks.length) {
      const empty = document.createElement("div");
      empty.className = "week-empty";
      empty.textContent = hasWeekBacklogFilters()
        ? "No backlog tasks match the current goal and area filters."
        : "Everything open is already placed into a slot.";
      els.weekBacklog.appendChild(empty);
      return;
    }

    tasks.forEach((task) => {
      els.weekBacklog.appendChild(buildWeekBacklogCard(task));
    });

    if (doneTasks.length) {
      const sectionLabel = document.createElement("div");
      sectionLabel.className = "week-backlog-section-label";
      sectionLabel.textContent = "Done this week";
      els.weekBacklog.appendChild(sectionLabel);

      doneTasks.forEach((task) => {
        els.weekBacklog.appendChild(buildWeekBacklogCard(task, { done: true }));
      });
    }
  }

  function renderWeekCalendar(weekDates, tasks, externalEvents) {
    els.weekCalendar.replaceChildren();
    const nowMarker = getWeekNowMarker(weekDates);

    const headerCorner = document.createElement("div");
    headerCorner.className = "week-corner";
    headerCorner.textContent = "Time";
    els.weekCalendar.appendChild(headerCorner);

    weekDates.forEach((isoDate) => {
      const header = document.createElement("div");
      header.className = `week-day-header${nowMarker.todayIso === isoDate ? " is-today" : ""}`;
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
        cell.className = `week-slot${nowMarker.todayIso === isoDate ? " is-today" : ""}`;
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

        if (nowMarker.todayIso === isoDate && nowMarker.hour === hour) {
          cell.appendChild(buildWeekNowLine(nowMarker.minuteOffset));
        }

        els.weekCalendar.appendChild(cell);
      });
    });
  }

  function buildWeekNowLine(offsetPercent) {
    const marker = document.createElement("div");
    marker.className = "week-now-line";
    marker.style.top = `${offsetPercent}%`;
    return marker;
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
    if (left.status !== right.status) {
      return left.status === "Done" ? 1 : -1;
    }
    const priorityDiff = (PRIORITY_SORT[left.priority] ?? 4) - (PRIORITY_SORT[right.priority] ?? 4);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return compareSmartTasks(left, right);
  }

  function compareWeekCompletedTasks(left, right) {
    const completedDiff = compareDateStrings(right.completed_at, left.completed_at);
    if (completedDiff !== 0) {
      return completedDiff;
    }
    return String(left.name || "").localeCompare(String(right.name || ""));
  }

  function hasWeekBacklogFilters() {
    return !!(state.weekBacklogGoalFilter || state.weekBacklogAreaFilter);
  }

  function matchesWeekBacklogFilters(task) {
    const taskGoal = String(task.goal || "").trim();
    const taskArea = String(task.team || "").trim();

    if (state.weekBacklogGoalFilter) {
      if (state.weekBacklogGoalFilter === WEEK_BACKLOG_NO_GOAL) {
        if (taskGoal) {
          return false;
        }
      } else if (taskGoal !== state.weekBacklogGoalFilter) {
        return false;
      }
    }

    if (state.weekBacklogAreaFilter) {
      if (state.weekBacklogAreaFilter === WEEK_BACKLOG_NO_AREA) {
        if (taskArea) {
          return false;
        }
      } else if (taskArea !== state.weekBacklogAreaFilter) {
        return false;
      }
    }

    return true;
  }

  function rebuildWeekBacklogFilters(backlogTasks, doneTasks = []) {
    syncWeekBacklogFilterSelects(backlogTasks, doneTasks);
  }

  function syncWeekBacklogFilterSelects(backlogTasks, doneTasks = []) {
    const sourceTasks = [...backlogTasks, ...doneTasks];
    const goalValues = [...new Set(sourceTasks.map((task) => String(task.goal || "").trim()).filter(Boolean))];
    const areaValues = [...new Set(sourceTasks.map((task) => String(task.team || "").trim()).filter(Boolean))];
    const orderedGoals = orderFilterValues(goalValues, goalNames());
    const orderedAreas = orderFilterValues(areaValues, state.teams);

    const goalOptions = [{ value: "", label: "All goals" }];
    const areaOptions = [{ value: "", label: "All areas" }];

    if (sourceTasks.some((task) => !String(task.goal || "").trim())) {
      goalOptions.push({ value: WEEK_BACKLOG_NO_GOAL, label: "No goal" });
    }
    orderedGoals.forEach((goal) => {
      goalOptions.push({ value: goal, label: goal });
    });

    if (sourceTasks.some((task) => !String(task.team || "").trim())) {
      areaOptions.push({ value: WEEK_BACKLOG_NO_AREA, label: "No area" });
    }
    orderedAreas.forEach((area) => {
      areaOptions.push({ value: area, label: area });
    });

    state.weekBacklogGoalFilter = syncWeekBacklogFilterSelect(
      els.weekBacklogGoalFilter,
      goalOptions,
      state.weekBacklogGoalFilter,
    );
    state.weekBacklogAreaFilter = syncWeekBacklogFilterSelect(
      els.weekBacklogAreaFilter,
      areaOptions,
      state.weekBacklogAreaFilter,
    );
  }

  function orderFilterValues(values, preferredOrder = []) {
    const uniqueValues = [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
    const ordered = [];
    const seen = new Set();

    preferredOrder.forEach((value) => {
      if (uniqueValues.includes(value) && !seen.has(value)) {
        ordered.push(value);
        seen.add(value);
      }
    });

    uniqueValues
      .filter((value) => !seen.has(value))
      .sort((left, right) => left.localeCompare(right))
      .forEach((value) => {
        ordered.push(value);
      });

    return ordered;
  }

  function syncWeekBacklogFilterSelect(select, options, selectedValue) {
    if (!select) {
      return "";
    }

    const nextSelected = options.some((option) => option.value === selectedValue) ? selectedValue : "";
    select.innerHTML = "";

    options.forEach((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      select.appendChild(element);
    });

    select.value = nextSelected;
    return nextSelected;
  }

  function getCurrentPage() {
    return state.pages.find((page) => page.id === state.currentPageId) || null;
  }

  function ensureCurrentPageSelection() {
    if (!state.pages.length) {
      state.currentPageId = null;
      persistLastPageIdPreference(null);
      return;
    }

    if (!state.pages.some((page) => page.id === state.currentPageId)) {
      const preferredPageId = loadLastPageIdPreference();
      if (preferredPageId && state.pages.some((page) => page.id === preferredPageId)) {
        state.currentPageId = preferredPageId;
      } else {
        state.currentPageId = flattenPageTree()[0]?.page.id || state.pages[0].id;
      }
    }
    persistLastPageIdPreference(state.currentPageId);
  }

  function buildPageDraft(title = "") {
    const now = new Date().toISOString();
    return {
      id: Date.now(),
      parent_id: null,
      title: String(title || "").trim() || "Untitled page",
      body: "",
      created_at: now,
      updated_at: now,
    };
  }

  function createPage(parentId = null, title = "Untitled page", options = {}) {
    const page = buildPageDraft(title);
    page.parent_id = Number.isFinite(Number(parentId)) && Number(parentId) > 0 ? Number(parentId) : null;

    if (page.parent_id) {
      state.pageCollapsedIds.delete(page.parent_id);
      persistCollapsedPagePreference();
      const insertIndex = findPageInsertIndex(page.parent_id);
      state.pages.splice(insertIndex, 0, page);
    } else {
      state.pages.unshift(page);
    }

    state.currentPageId = page.id;
    persistLastPageIdPreference(page.id);
    renderCurrentView();
    focusCurrentPageTitle();
    void saveTasks({ message: options.toastMessage || "Page added" });
    return page;
  }

  function onPageSearchInput(event) {
    state.pageSearchQuery = String(event.target.value || "");
    updatePagesStatsLine();
    renderPagesListOnly();
  }

  function getNormalizedPageSearchQuery() {
    return String(state.pageSearchQuery || "").trim().toLowerCase();
  }

  function pageTitleMatchesQuery(page, query = getNormalizedPageSearchQuery()) {
    if (!query) {
      return true;
    }
    return String(page?.title || "").trim().toLowerCase().includes(query);
  }

  function updatePagesStatsLine() {
    if (!els.statsLine) {
      return;
    }

    const query = getNormalizedPageSearchQuery();
    if (!query) {
      els.statsLine.textContent = `${state.pages.length} pages`;
      return;
    }

    const matchCount = state.pages.filter((page) => pageTitleMatchesQuery(page, query)).length;
    els.statsLine.textContent = `${matchCount} of ${state.pages.length} page titles match`;
  }

  function findPageInsertIndex(parentId) {
    const pageIds = new Set(state.pages.map((page) => page.id));
    const descendants = collectPageDescendants(parentId);
    let insertIndex = state.pages.findIndex((page) => page.id === parentId);
    if (insertIndex < 0) {
      return state.pages.length;
    }

    for (let index = insertIndex + 1; index < state.pages.length; index += 1) {
      const page = state.pages[index];
      const validParentId =
        Number.isFinite(Number(page.parent_id)) &&
        Number(page.parent_id) > 0 &&
        Number(page.parent_id) !== page.id &&
        pageIds.has(Number(page.parent_id))
          ? Number(page.parent_id)
          : null;

      if (validParentId === parentId || descendants.has(page.id)) {
        insertIndex = index;
        continue;
      }
      break;
    }

    return insertIndex + 1;
  }

  function focusCurrentPageTitle() {
    if (!els.pageTitleInput) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (!els.pageTitleInput) {
        return;
      }
      els.pageTitleInput.focus();
      els.pageTitleInput.select();
    });
  }

  function onPageTitleInput(event) {
    const page = getCurrentPage();
    if (!page) {
      return;
    }

    page.title = String(event.target.value || "");
    page.updated_at = new Date().toISOString();
    schedulePageAutosave();
    updatePagesStatsLine();
    renderPagesListOnly();
  }

  function normalizeCurrentPageTitle() {
    const page = getCurrentPage();
    if (!page || !els.pageTitleInput) {
      return;
    }

    const nextTitle = String(els.pageTitleInput.value || "").trim() || "Untitled page";
    if (page.title !== nextTitle) {
      page.title = nextTitle;
      page.updated_at = new Date().toISOString();
      els.pageTitleInput.value = nextTitle;
      schedulePageAutosave();
    } else if (!els.pageTitleInput.value.trim()) {
      els.pageTitleInput.value = nextTitle;
    }
    updatePagesStatsLine();
    renderPagesListOnly();
  }

  function onPageBodyInput(event) {
    const page = getCurrentPage();
    if (!page) {
      return;
    }

    page.body = normalizePageBodyHtml(event.target.innerHTML || "");
    page.updated_at = new Date().toISOString();
    schedulePageAutosave();
    renderPagesListOnly();
    if (els.pageMeta) {
      els.pageMeta.textContent = `Updated ${formatPageTimestamp(page.updated_at)}`;
    }
    updatePageEmojiAutocomplete();
    updatePageImageMenu();
  }

  function onPageBodyKeyDown(event) {
    if (state.pageEmojiItems.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        state.pageEmojiIndex = (state.pageEmojiIndex + 1) % state.pageEmojiItems.length;
        renderPageEmojiMenu();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        state.pageEmojiIndex = (state.pageEmojiIndex - 1 + state.pageEmojiItems.length) % state.pageEmojiItems.length;
        renderPageEmojiMenu();
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyPageEmoji(state.pageEmojiIndex);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closePageEmojiMenu();
        return;
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      applyPageCommand("bold");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      applyPageCommand("italic");
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode || null;
      const inListItem = !!closestEditorTag(anchorNode, ["li"], els.pageBodyInput);

      if (inListItem) {
        document.execCommand(event.shiftKey ? "outdent" : "indent");
      } else {
        document.execCommand("insertText", false, "    ");
      }
      onPageBodyInput({ target: els.pageBodyInput });
      return;
    }

    if (event.key === " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (tryApplyPageListShortcut()) {
        event.preventDefault();
        onPageBodyInput({ target: els.pageBodyInput });
      }
    }
  }

  function onPageBodyPaste(event) {
    event.preventDefault();
    closePageEmojiMenu();
    const clipboard = event.clipboardData;
    if (!clipboard) {
      return;
    }

    const imageFile = getClipboardImageFile(clipboard);
    if (imageFile) {
      readFileAsDataUrl(imageFile)
        .then((dataUrl) => {
          if (!insertPageImageAtCursor(dataUrl, { alt: imageFile.name || "Pasted screenshot" })) {
            return;
          }
          onPageBodyInput({ target: els.pageBodyInput });
          updatePageToolbarState();
        })
        .catch((error) => {
          console.error(error);
          showToast("Could not paste screenshot");
        });
      return;
    }

    const html = clipboard.getData("text/html");
    const text = clipboard.getData("text/plain");

    if (html) {
      insertHtmlAtCursor(sanitizePastedHtml(html));
    } else if (text) {
      insertHtmlAtCursor(escapeHtml(text).replace(/\n/g, "<br>"));
    }

    onPageBodyInput({ target: els.pageBodyInput });
  }

  function onPageBodyClick(event) {
    const imageBlock = event.target.closest(".page-image-block");
    if (imageBlock && els.pageBodyInput?.contains(imageBlock)) {
      selectPageImage(imageBlock);
    } else {
      clearSelectedPageImage();
    }
    updatePageEmojiAutocomplete();
    updatePageToolbarState();
  }

  function updatePageEmojiAutocomplete() {
    if (currentView !== "pages" || !els.pageBodyInput || document.activeElement !== els.pageBodyInput) {
      closePageEmojiMenu();
      return;
    }

    const match = getPageEmojiTriggerMatch();
    if (!match) {
      closePageEmojiMenu();
      return;
    }

    const suggestions = findPageEmojiSuggestions(match.query);
    if (!suggestions.length) {
      closePageEmojiMenu();
      return;
    }

    state.pageEmojiQuery = match.query;
    state.pageEmojiRange = match.range;
    state.pageEmojiRect = match.rect;
    state.pageEmojiItems = suggestions;
    if (state.pageEmojiIndex >= suggestions.length) {
      state.pageEmojiIndex = 0;
    }
    renderPageEmojiMenu();
  }

  function closePageEmojiMenu() {
    state.pageEmojiItems = [];
    state.pageEmojiIndex = 0;
    state.pageEmojiQuery = "";
    state.pageEmojiRange = null;
    state.pageEmojiRect = null;
    if (els.pageEmojiMenu) {
      els.pageEmojiMenu.classList.remove("is-visible");
      els.pageEmojiMenu.innerHTML = "";
    }
  }

  function getPageEmojiTriggerMatch() {
    if (!els.pageBodyInput) {
      return null;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.isCollapsed) {
      return null;
    }

    const anchorNode = selection.anchorNode || null;
    if (!anchorNode || !els.pageBodyInput.contains(anchorNode)) {
      return null;
    }

    const block =
      closestEditorTag(anchorNode, ["p", "div", "li", "blockquote", "h1", "h2", "h3", "td", "th"], els.pageBodyInput) ||
      els.pageBodyInput;
    const prefixRange = selection.getRangeAt(0).cloneRange();
    prefixRange.setStart(block, 0);
    const prefixText = prefixRange.toString().replace(/\u00a0/g, " ");
    const match = prefixText.match(/(^|[\s([{])\:([a-z0-9_+\-]{0,32})$/i);
    if (!match) {
      return null;
    }

    const triggerText = `:${match[2]}`;
    const startOffset = prefixText.length - triggerText.length;
    const replaceRange = createRangeFromTextOffsets(block, startOffset, prefixText.length);
    if (!replaceRange) {
      return null;
    }

    return {
      query: String(match[2] || "").toLowerCase(),
      range: replaceRange,
      rect: getCaretRect(selection.getRangeAt(0), block),
    };
  }

  function findPageEmojiSuggestions(query) {
    const normalized = String(query || "").trim().toLowerCase();
    const matches = [];

    PAGE_EMOJI_INDEX.forEach((entry, index) => {
      const aliases = [entry.name, ...(entry.aliases || [])].map((value) => String(value || "").toLowerCase());
      let score = normalized ? Number.POSITIVE_INFINITY : index;

      if (normalized) {
        aliases.forEach((alias) => {
          if (alias === normalized) {
            score = Math.min(score, 0);
          } else if (alias.startsWith(normalized)) {
            score = Math.min(score, 10 + alias.length);
          } else {
            const hitIndex = alias.indexOf(normalized);
            if (hitIndex >= 0) {
              score = Math.min(score, 100 + hitIndex + alias.length);
            }
          }
        });
      }

      if (Number.isFinite(score)) {
        matches.push({ ...entry, score, order: index });
      }
    });

    return matches
      .sort((left, right) => left.score - right.score || left.order - right.order)
      .slice(0, PAGE_EMOJI_LIMIT);
  }

  function renderPageEmojiMenu() {
    if (!els.pageEmojiMenu || !els.pageEditorScroll || !state.pageEmojiItems.length) {
      if (els.pageEmojiMenu) {
        els.pageEmojiMenu.classList.remove("is-visible");
        els.pageEmojiMenu.innerHTML = "";
      }
      return;
    }

    const liveMatch = getPageEmojiTriggerMatch();
    if (liveMatch) {
      if (liveMatch.query !== state.pageEmojiQuery) {
        updatePageEmojiAutocomplete();
        return;
      }
      state.pageEmojiRange = liveMatch.range;
      state.pageEmojiRect = liveMatch.rect;
    }

    const caretRect = state.pageEmojiRect;
    if (!caretRect) {
      closePageEmojiMenu();
      return;
    }

    els.pageEmojiMenu.innerHTML = "";
    state.pageEmojiItems.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `page-emoji-item${index === state.pageEmojiIndex ? " is-active" : ""}`;
      button.innerHTML = `<span class="page-emoji-glyph">${item.emoji}</span><span class="page-emoji-meta"><strong>:${item.name}</strong><small>${item.aliases.slice(0, 2).join(" · ")}</small></span>`;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      button.addEventListener("click", () => {
        applyPageEmoji(index);
      });
      els.pageEmojiMenu.appendChild(button);
    });

    const scrollRect = els.pageEditorScroll.getBoundingClientRect();
    const top = caretRect.bottom - scrollRect.top + els.pageEditorScroll.scrollTop + 10;
    const left = caretRect.left - scrollRect.left + els.pageEditorScroll.scrollLeft;
    const maxLeft = Math.max(12, els.pageEditorScroll.scrollWidth - 260);

    els.pageEmojiMenu.style.top = `${Math.max(12, top)}px`;
    els.pageEmojiMenu.style.left = `${Math.max(12, Math.min(left, maxLeft))}px`;
    els.pageEmojiMenu.classList.add("is-visible");
  }

  function applyPageEmoji(index) {
    const entry = state.pageEmojiItems[index];
    const range = state.pageEmojiRange?.cloneRange();
    if (!entry || !range || !els.pageBodyInput) {
      closePageEmojiMenu();
      return;
    }

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    range.deleteContents();

    const textNode = document.createTextNode(`${entry.emoji} `);
    range.insertNode(textNode);

    const caretRange = document.createRange();
    caretRange.setStart(textNode, textNode.textContent.length);
    caretRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(caretRange);
    els.pageBodyInput.focus();

    closePageEmojiMenu();
    onPageBodyInput({ target: els.pageBodyInput });
    updatePageToolbarState();
  }

  function renderPagesListOnly() {
    if (currentView !== "pages" || !els.pageList) {
      return;
    }

    const entries = getVisiblePageListEntries();
    els.pageList.replaceChildren();
    if (!entries.length) {
      if (!getNormalizedPageSearchQuery()) {
        return;
      }
      const empty = document.createElement("div");
      empty.className = "goal-empty goal-empty-inline";
      empty.textContent = `No page titles match "${String(state.pageSearchQuery || "").trim()}".`;
      els.pageList.appendChild(empty);
      return;
    }

    entries.forEach(({ page, depth, hasChildren }) => {
      els.pageList.appendChild(buildPageListItem(page, depth, hasChildren));
    });
  }

  function getVisiblePageListEntries() {
    const query = getNormalizedPageSearchQuery();
    if (!query) {
      return flattenPageTree();
    }

    const ordered = [];
    const childrenByParent = buildPageChildrenMap();
    const visited = new Set();
    const pageIds = new Set(state.pages.map((page) => page.id));
    const branchMatchCache = new Map();
    const branchMatchStack = new Set();

    const branchHasMatch = (page) => {
      if (!page) {
        return false;
      }
      if (branchMatchCache.has(page.id)) {
        return branchMatchCache.get(page.id);
      }
      if (branchMatchStack.has(page.id)) {
        return pageTitleMatchesQuery(page, query);
      }

      branchMatchStack.add(page.id);
      const hasMatch =
        pageTitleMatchesQuery(page, query) ||
        (childrenByParent.get(page.id) || []).some((child) => branchHasMatch(child));
      branchMatchStack.delete(page.id);
      branchMatchCache.set(page.id, hasMatch);
      return hasMatch;
    };

    const visit = (parentId, depth) => {
      const children = childrenByParent.get(parentId) || [];
      children.forEach((page) => {
        if (visited.has(page.id) || !branchHasMatch(page)) {
          return;
        }
        visited.add(page.id);
        const hasChildren = (childrenByParent.get(page.id) || []).length > 0;
        ordered.push({ page, depth, hasChildren });
        visit(page.id, depth + 1);
      });
    };

    visit(null, 0);
    state.pages.forEach((page) => {
      if (visited.has(page.id)) {
        return;
      }
      const hasValidParent =
        Number.isFinite(Number(page.parent_id)) &&
        Number(page.parent_id) > 0 &&
        Number(page.parent_id) !== page.id &&
        pageIds.has(Number(page.parent_id));
      if (hasValidParent || !branchHasMatch(page)) {
        return;
      }
      const hasChildren = (childrenByParent.get(page.id) || []).length > 0;
      ordered.push({ page, depth: 0, hasChildren });
      visit(page.id, 1);
    });

    return ordered;
  }

  function schedulePageAutosave() {
    clearTimeout(state.pageAutosaveTimer);
    state.pageAutosaveTimer = window.setTimeout(() => {
      void saveTasks();
    }, 500);
  }

  function applyPageCommand(command) {
    if (!els.pageBodyInput) {
      return;
    }

    els.pageBodyInput.focus();

    if (command === "table") {
      insertHtmlAtCursor(buildDefaultPageTableHtml());
      onPageBodyInput({ target: els.pageBodyInput });
      return;
    }

    if (command.startsWith("table-")) {
      if (!applyPageTableCommand(command)) {
        return;
      }
      onPageBodyInput({ target: els.pageBodyInput });
      return;
    }

    if (command === "h1") {
      document.execCommand("formatBlock", false, "<h1>");
    } else if (command === "h2") {
      document.execCommand("formatBlock", false, "<h2>");
    } else if (command === "h3") {
      document.execCommand("formatBlock", false, "<h3>");
    } else if (command === "p") {
      document.execCommand("formatBlock", false, "<p>");
    } else if (command === "ul") {
      document.execCommand("insertUnorderedList");
    } else if (command === "ol") {
      document.execCommand("insertOrderedList");
    } else if (command === "quote") {
      document.execCommand("formatBlock", false, "<blockquote>");
    } else if (command === "clear") {
      document.execCommand("removeFormat");
    } else if (command === "bold" || command === "italic") {
      document.execCommand(command);
    } else {
      return;
    }

    onPageBodyInput({ target: els.pageBodyInput });
  }

  function buildDefaultPageTableHtml() {
    return `
      <table>
        <thead>
          <tr>
            <th>Column 1</th>
            <th>Column 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Value</td>
            <td>Value</td>
          </tr>
          <tr>
            <td>Value</td>
            <td>Value</td>
          </tr>
        </tbody>
      </table>
      <p></p>
    `.trim();
  }

  function applyPageTableCommand(command) {
    const cell = getCurrentTableCell();
    if (!cell) {
      return false;
    }

    const row = cell.closest("tr");
    const section = cell.closest("thead, tbody, tfoot") || row?.parentElement;
    const table = cell.closest("table");
    if (!row || !section || !table) {
      return false;
    }

    if (command === "table-add-row") {
      const newRow = document.createElement("tr");
      Array.from(row.children).forEach((currentCell) => {
        const tag = currentCell.tagName.toLowerCase() === "th" ? "th" : "td";
        const nextCell = document.createElement(tag);
        nextCell.textContent = tag === "th" ? "Header" : "Value";
        newRow.appendChild(nextCell);
      });
      row.insertAdjacentElement("afterend", newRow);
      placeCursorInNode(newRow.firstElementChild);
      return true;
    }

    const columnIndex = Array.from(row.children).indexOf(cell);
    if (columnIndex < 0) {
      return false;
    }

    const allRows = Array.from(table.querySelectorAll("tr"));

    if (command === "table-add-col") {
      allRows.forEach((currentRow) => {
        const referenceCell = currentRow.children[columnIndex] || currentRow.lastElementChild;
        const tag = referenceCell?.tagName?.toLowerCase() === "th" ? "th" : "td";
        const nextCell = document.createElement(tag);
        nextCell.textContent = tag === "th" ? "Header" : "Value";
        if (referenceCell) {
          referenceCell.insertAdjacentElement("afterend", nextCell);
        } else {
          currentRow.appendChild(nextCell);
        }
      });
      const targetRow = allRows[Array.from(allRows).indexOf(row)] || row;
      placeCursorInNode(targetRow.children[columnIndex + 1] || targetRow.lastElementChild);
      return true;
    }

    if (command === "table-del-row") {
      const siblingRows = Array.from(section.querySelectorAll("tr"));
      if (siblingRows.length <= 1) {
        return false;
      }
      const fallbackRow = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      placeCursorInNode(fallbackRow?.children[columnIndex] || fallbackRow?.firstElementChild || table);
      return true;
    }

    if (command === "table-del-col") {
      const maxColumns = Math.max(...allRows.map((currentRow) => currentRow.children.length), 0);
      if (maxColumns <= 1) {
        return false;
      }
      allRows.forEach((currentRow) => {
        const targetCell = currentRow.children[columnIndex];
        if (targetCell) {
          targetCell.remove();
        }
      });
      placeCursorInNode(row.children[Math.max(0, columnIndex - 1)] || row.firstElementChild || table);
      return true;
    }

    return false;
  }

  function getCurrentTableCell() {
    if (!els.pageBodyInput) {
      return null;
    }
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode || null;
    const cell = closestEditorTag(anchorNode, ["td", "th"], els.pageBodyInput);
    return cell instanceof HTMLElement ? cell : null;
  }

  function placeCursorInNode(node) {
    if (!node || !els.pageBodyInput) {
      return;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    const target = node.firstChild || node;
    const offset =
      target.nodeType === Node.TEXT_NODE
        ? String(target.textContent || "").length
        : target.childNodes.length;
    range.setStart(target, offset);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    els.pageBodyInput.focus();
    updatePageToolbarState();
  }

  function getSelectedPageImageBlock() {
    if (!els.pageBodyInput || !state.pageSelectedImageId) {
      return null;
    }
    return els.pageBodyInput.querySelector(`[data-page-image-id="${state.pageSelectedImageId}"]`);
  }

  function selectPageImage(node) {
    const imageBlock = node?.closest?.(".page-image-block");
    if (!imageBlock || !els.pageBodyInput?.contains(imageBlock)) {
      clearSelectedPageImage();
      return;
    }

    state.pageSelectedImageId = imageBlock.dataset.pageImageId || "";
    syncPageImageSelection();
  }

  function clearSelectedPageImage() {
    state.pageSelectedImageId = "";
    syncPageImageSelection();
  }

  function syncPageImageSelection() {
    if (!els.pageBodyInput) {
      return;
    }

    els.pageBodyInput.querySelectorAll(".page-image-block.is-selected").forEach((block) => {
      block.classList.remove("is-selected");
    });

    const selected = getSelectedPageImageBlock();
    if (selected) {
      selected.classList.add("is-selected");
    }

    updatePageImageMenu();
  }

  function onPageImageSizeInput(event) {
    setSelectedPageImageWidth(event.target.value);
  }

  function setSelectedPageImageWidth(value) {
    const imageBlock = getSelectedPageImageBlock();
    if (!imageBlock || !els.pageBodyInput) {
      return;
    }

    const width = normalizePageImageWidth(value);
    imageBlock.dataset.pageImageWidth = String(width);
    imageBlock.style.width = `${width}%`;
    if (els.pageImageSizeInput) {
      els.pageImageSizeInput.value = String(width);
    }
    if (els.pageImageSizeValue) {
      els.pageImageSizeValue.textContent = `${width}%`;
    }

    onPageBodyInput({ target: els.pageBodyInput });
    updatePageToolbarState();
  }

  function updatePageToolbarState() {
    if (!els.pageToolButtons?.length) {
      renderPageEmojiMenu();
      updatePageImageMenu();
      return;
    }

    const cell = getCurrentTableCell();
    const inTable = !!cell;
    els.pageToolButtons.forEach((button) => {
      const command = button.dataset.pageCommand || "";
      const needsTable = command.startsWith("table-") && command !== "table";
      const disabled = needsTable && !inTable;
      button.disabled = disabled;
      button.classList.toggle("is-disabled", disabled);
    });

    updatePageTableMenu(cell);
    renderPageEmojiMenu();
    updatePageImageMenu();
  }

  function updatePageTableMenu(cell = getCurrentTableCell()) {
    if (!els.pageTableMenu || !els.pageEditorScroll || !els.pageBodyInput) {
      return;
    }

    if (!cell) {
      els.pageTableMenu.classList.remove("is-visible");
      return;
    }

    const table = cell.closest("table");
    if (!table) {
      els.pageTableMenu.classList.remove("is-visible");
      return;
    }

    const scrollRect = els.pageEditorScroll.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const menuHeight = els.pageTableMenu.offsetHeight || 36;
    const menuWidth = els.pageTableMenu.offsetWidth || 220;
    const top = tableRect.top - scrollRect.top + els.pageEditorScroll.scrollTop - menuHeight - 8;
    const left = tableRect.right - scrollRect.left + els.pageEditorScroll.scrollLeft - menuWidth - 8;
    const maxLeft = Math.max(0, els.pageEditorScroll.clientWidth - (els.pageTableMenu.offsetWidth || 220) - 8);

    els.pageTableMenu.style.top = `${Math.max(8, top)}px`;
    els.pageTableMenu.style.left = `${Math.max(8, Math.min(left, maxLeft))}px`;
    els.pageTableMenu.classList.add("is-visible");
  }

  function updatePageImageMenu() {
    if (!els.pageImageMenu || !els.pageEditorScroll) {
      return;
    }

    const imageBlock = getSelectedPageImageBlock();
    if (!imageBlock) {
      els.pageImageMenu.classList.remove("is-visible");
      return;
    }

    const width = normalizePageImageWidth(imageBlock.dataset.pageImageWidth || imageBlock.style.width);
    if (els.pageImageSizeInput) {
      els.pageImageSizeInput.value = String(width);
    }
    if (els.pageImageSizeValue) {
      els.pageImageSizeValue.textContent = `${width}%`;
    }

    const scrollRect = els.pageEditorScroll.getBoundingClientRect();
    const imageRect = imageBlock.getBoundingClientRect();
    const menuHeight = els.pageImageMenu.offsetHeight || 52;
    const menuWidth = els.pageImageMenu.offsetWidth || 320;
    let top = imageRect.top - scrollRect.top + els.pageEditorScroll.scrollTop - menuHeight - 10;
    if (top < 8) {
      top = imageRect.bottom - scrollRect.top + els.pageEditorScroll.scrollTop + 10;
    }
    const left = imageRect.left - scrollRect.left + els.pageEditorScroll.scrollLeft;
    const maxLeft = Math.max(8, els.pageEditorScroll.clientWidth - menuWidth - 8);

    els.pageImageMenu.style.top = `${Math.max(8, top)}px`;
    els.pageImageMenu.style.left = `${Math.max(8, Math.min(left, maxLeft))}px`;
    els.pageImageMenu.classList.add("is-visible");
  }

  function deleteCurrentPage() {
    const page = getCurrentPage();
    if (!page) {
      return;
    }

    const confirmed = window.confirm(`Delete "${page.title}"?`);
    if (!confirmed) {
      return;
    }

    state.pages = state.pages.filter((entry) => entry.id !== page.id);
    syncCollapsedPagePreferenceWithPages();
    ensureCurrentPageSelection();
    persistLastPageIdPreference(state.currentPageId);
    void saveTasks({ message: "Page deleted" });
    renderCurrentView();
  }

  function formatPageTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderPageBody(body) {
    const raw = String(body || "");
    if (!raw) {
      return "";
    }
    if (/<\/?[a-z][\s\S]*>/i.test(raw)) {
      return raw;
    }
    return escapeHtml(raw).replace(/\n/g, "<br>");
  }

  function sanitizePastedHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ""), "text/html");
    const container = document.createElement("div");
    Array.from(doc.body.childNodes).forEach((node) => {
      const sanitized = sanitizeRichNode(node);
      if (sanitized) {
        container.appendChild(sanitized);
      }
    });
    return container.innerHTML;
  }

  function sanitizeRichNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const tag = node.nodeName.toLowerCase();
    const allowedTags = new Set([
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "hr",
      "a",
      "figure",
      "img",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
    ]);

    if (!allowedTags.has(tag)) {
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => {
        const sanitizedChild = sanitizeRichNode(child);
        if (sanitizedChild) {
          fragment.appendChild(sanitizedChild);
        }
      });
      return fragment;
    }

    const el = document.createElement(tag);
    if (tag === "a") {
      const href = String(node.getAttribute("href") || "").trim();
      if (href) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noreferrer noopener");
      }
    } else if (tag === "figure") {
      if (node.classList.contains("page-image-block")) {
        el.className = "page-image-block";
        el.setAttribute("contenteditable", "false");
        const width = normalizePageImageWidth(
          node.getAttribute("data-page-image-width") ||
          node.style.width ||
          node.getAttribute("width"),
        );
        el.dataset.pageImageWidth = String(width);
        el.style.width = `${width}%`;
      }
    } else if (tag === "img") {
      const src = sanitizePageImageSrc(node.getAttribute("src"));
      if (!src) {
        return null;
      }
      el.setAttribute("src", src);
      const alt = String(node.getAttribute("alt") || "").trim();
      if (alt) {
        el.setAttribute("alt", alt);
      }
      el.setAttribute("draggable", "false");
    }

    Array.from(node.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeRichNode(child);
      if (sanitizedChild) {
        el.appendChild(sanitizedChild);
      }
    });

    return el;
  }

  function getClipboardImageFile(clipboard) {
    const items = Array.from(clipboard.items || []);
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        return item.getAsFile();
      }
    }

    const files = Array.from(clipboard.files || []);
    return files.find((file) => String(file.type || "").startsWith("image/")) || null;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  }

  function sanitizePageImageSrc(value) {
    const src = String(value || "").trim();
    if (!src) {
      return "";
    }

    if (/^data:image\//i.test(src) || /^blob:/i.test(src) || /^https?:\/\//i.test(src)) {
      return src;
    }

    if (src.startsWith("/") || src.startsWith("./") || src.startsWith("../")) {
      return src;
    }

    return "";
  }

  function normalizePageImageWidth(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    const parsed = Number(match?.[1]);
    if (!Number.isFinite(parsed)) {
      return 100;
    }
    return Math.max(20, Math.min(100, Math.round(parsed)));
  }

  function buildPageImageId() {
    return `page-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function buildPageImageHtml(src, { alt = "Pasted screenshot", width = 100, id = buildPageImageId() } = {}) {
    const safeSrc = sanitizePageImageSrc(src);
    if (!safeSrc) {
      return "";
    }

    const safeWidth = normalizePageImageWidth(width);
    return `
      <figure
        class="page-image-block"
        contenteditable="false"
        data-page-image-id="${escapeHtmlAttribute(id)}"
        data-page-image-width="${safeWidth}"
        style="width:${safeWidth}%"
      >
        <img src="${escapeHtmlAttribute(safeSrc)}" alt="${escapeHtmlAttribute(alt)}" draggable="false" />
      </figure>
      <p><br></p>
    `.trim();
  }

  function insertPageImageAtCursor(src, options = {}) {
    if (!els.pageBodyInput) {
      return false;
    }

    const imageId = buildPageImageId();
    const html = buildPageImageHtml(src, { ...options, id: imageId });
    if (!html) {
      return false;
    }

    insertHtmlAtCursor(html);
    const imageBlock = els.pageBodyInput.querySelector(`[data-page-image-id="${imageId}"]`);
    if (!imageBlock) {
      return false;
    }

    const trailingParagraph = imageBlock.nextElementSibling;
    if (trailingParagraph) {
      placeCaretAtStart(trailingParagraph);
    }
    selectPageImage(imageBlock);
    return true;
  }

  function insertHtmlAtCursor(html) {
    if (!html) {
      return;
    }

    document.execCommand("insertHTML", false, html);
  }

  function createRangeFromTextOffsets(root, startOffset, endOffset) {
    const start = resolveTextPosition(root, startOffset);
    const end = resolveTextPosition(root, endOffset);
    if (!start || !end) {
      return null;
    }

    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  }

  function resolveTextPosition(root, targetOffset) {
    if (!root) {
      return null;
    }

    let remaining = Math.max(0, Number(targetOffset) || 0);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let lastTextNode = null;

    while (node) {
      const length = String(node.textContent || "").length;
      if (remaining <= length) {
        return { node, offset: remaining };
      }
      remaining -= length;
      lastTextNode = node;
      node = walker.nextNode();
    }

    if (lastTextNode) {
      return {
        node: lastTextNode,
        offset: String(lastTextNode.textContent || "").length,
      };
    }

    return { node: root, offset: root.childNodes.length };
  }

  function getCaretRect(range, fallbackNode) {
    if (range) {
      const rects = range.getClientRects();
      if (rects.length) {
        return rects[rects.length - 1];
      }
      const rect = range.getBoundingClientRect();
      if (rect.width || rect.height || rect.top || rect.left) {
        return rect;
      }
    }

    return fallbackNode?.getBoundingClientRect() || null;
  }

  function tryApplyPageListShortcut() {
    if (!els.pageBodyInput) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.isCollapsed) {
      return false;
    }

    const anchorNode = selection.anchorNode || null;
    const block =
      closestEditorTag(anchorNode, ["p", "div", "li", "blockquote"], els.pageBodyInput) ||
      els.pageBodyInput;
    const marker = String(block.textContent || "").replace(/\u00a0/g, " ").trim();

    if (!["-", "*", "1."].includes(marker)) {
      return false;
    }

    block.textContent = "";
    placeCaretAtStart(block);
    applyPageCommand(marker === "1." ? "ol" : "ul");
    return true;
  }

  function closestEditorTag(node, tagNames, root) {
    const allowed = new Set((tagNames || []).map((tag) => String(tag || "").toLowerCase()));
    let current = node;

    while (current) {
      if (current === root) {
        return null;
      }
      if (current.nodeType === Node.ELEMENT_NODE) {
        const tag = current.nodeName.toLowerCase();
        if (allowed.has(tag)) {
          return current;
        }
      }
      current = current.parentNode;
    }

    return null;
  }

  function placeCaretAtStart(node) {
    const selection = window.getSelection();
    if (!selection || !node) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function normalizePageBodyHtml(html) {
    const raw = String(html || "").trim();
    const stripped = raw
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/gi, "")
      .replace(/<div>\s*<\/div>/gi, "")
      .replace(/<p>\s*<\/p>/gi, "")
      .trim();
    return stripped ? raw : "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHtmlAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function togglePageFocusMode() {
    state.pageFocusMode = !state.pageFocusMode;
    renderCurrentView();
  }

  function exitPageFocusMode() {
    if (!state.pageFocusMode) {
      return;
    }
    state.pageFocusMode = false;
    renderCurrentView();
  }

  function buildWeekBacklogCard(task, { done = false } = {}) {
    const card = document.createElement("div");
    card.className = `week-task-card${done ? " is-done" : ""}`;
    if (!done) {
      card.draggable = true;
      card.addEventListener("dragstart", () => {
        state.weekDragTaskId = task.id;
      });
      card.addEventListener("dragend", () => {
        state.weekDragTaskId = null;
      });
    }
    card.addEventListener("click", () => openTaskDetails(task));

    const title = document.createElement("div");
    title.className = "week-task-title";
    title.textContent = task.name;
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "week-task-meta";
    meta.innerHTML = [
      statusBadge(task.status),
      priorityBadge(task.priority),
      modeBadge(task.mode),
      goalBadge(task.goal),
      task.completed_at ? `<span class="week-completed-stamp">Done ${formatDate(task.completed_at)}</span>` : "",
      task.deadline ? `<span class="goal-due">Due ${formatDate(task.deadline)}</span>` : "",
    ].filter(Boolean).join("");
    card.appendChild(meta);

    return card;
  }

  function buildWeekScheduledCard(task) {
    const card = document.createElement("div");
    const isDone = task.status === "Done";
    card.className = `week-scheduled-card${isDone ? " is-done" : ""}`;
    if (!isDone) {
      card.draggable = true;
      card.addEventListener("dragstart", () => {
        state.weekDragTaskId = task.id;
      });
      card.addEventListener("dragend", () => {
        state.weekDragTaskId = null;
      });
    }

    const title = document.createElement("div");
    title.className = "week-task-title";
    title.textContent = task.name;
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "week-task-meta";
    meta.innerHTML = [
      statusBadge(task.status),
      priorityBadge(task.priority),
      modeBadge(task.mode),
      timeBadge(task.time_estimate),
      task.completed_at ? `<span class="week-completed-stamp">Done ${formatDate(task.completed_at)}</span>` : "",
    ].filter(Boolean).join("");
    card.appendChild(meta);

    const menuButton = document.createElement("button");
    menuButton.className = "week-card-menu-btn";
    menuButton.type = "button";
    menuButton.textContent = "⋯";
    menuButton.title = "Task actions";
    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.weekCardMenuTaskId = state.weekCardMenuTaskId === task.id ? null : task.id;
      renderCurrentView();
    });
    card.appendChild(menuButton);

    if (state.weekCardMenuTaskId === task.id) {
      const menu = document.createElement("div");
      menu.className = "week-card-menu";

      if (!isDone) {
        const doneButton = document.createElement("button");
        doneButton.className = "week-card-menu-item is-done";
        doneButton.type = "button";
        doneButton.textContent = "Done";
        doneButton.addEventListener("click", (event) => {
          event.stopPropagation();
          state.weekCardMenuTaskId = null;
          markTaskDone(task.id);
        });
        menu.appendChild(doneButton);
      }

      const editButton = document.createElement("button");
      editButton.className = "week-card-menu-item";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.weekCardMenuTaskId = null;
        openWeekTaskDialog(task.scheduled_date, task.scheduled_hour, task);
      });
      menu.appendChild(editButton);

      const popButton = document.createElement("button");
      popButton.className = "week-card-menu-item";
      popButton.type = "button";
      popButton.textContent = "Pop +7d";
      popButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.weekCardMenuTaskId = null;
        popTaskToNextWeek(task.id);
      });
      menu.appendChild(popButton);

      const removeButton = document.createElement("button");
      removeButton.className = "week-card-menu-item is-remove";
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.weekCardMenuTaskId = null;
        unscheduleTask(task.id);
      });
      menu.appendChild(removeButton);

      card.appendChild(menu);
    }

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

  function popTaskToNextWeek(taskId) {
    const task = state.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    if (task.scheduled_date) {
      task.scheduled_date = shiftIsoDate(task.scheduled_date, 7);
    }
    if (task.deadline) {
      task.deadline = shiftIsoDate(task.deadline, 7);
    }

    void saveTasks({ message: "Moved to next week" });
    renderCurrentView();
  }

  function markTaskDone(taskId) {
    const task = state.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    const previousStatus = task.status;
    task.status = "Done";
    task.completed_at = nextCompletedAt(task.completed_at, previousStatus, task.status);
    void saveTasks({ message: "Task completed" });
    renderCurrentView();
  }

  function openTaskDetails(task) {
    openWeekTaskDialog(
      task.scheduled_date || "",
      task.scheduled_hour || "",
      task,
    );
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

  function shiftIsoDate(isoDate, days) {
    const normalized = normalizeIsoDate(isoDate);
    if (!normalized) {
      return "";
    }

    const [year, month, day] = normalized.split("-").map(Number);
    const shifted = new Date(year, month - 1, day);
    shifted.setDate(shifted.getDate() + days);
    return toLocalIsoDate(shifted);
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

  function getWeekNowMarker(weekDates) {
    const now = new Date();
    const todayIso = toLocalIsoDate(now);
    if (!weekDates.includes(todayIso)) {
      return { todayIso: "", hour: "", minuteOffset: 0 };
    }

    const hour = now.getHours();
    const minute = now.getMinutes();
    const hourKey = `${String(hour).padStart(2, "0")}:00`;
    if (!WEEK_HOURS.includes(hourKey)) {
      return { todayIso, hour: "", minuteOffset: 0 };
    }

    return {
      todayIso,
      hour: hourKey,
      minuteOffset: (minute / 60) * 100,
    };
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

  function ensureWeekEventsLoaded(weekStart, days, { force = false } = {}) {
    const key = `${weekStart}|${days}|${state.calendarFeedUrl}`;
    if (!state.calendarFeedUrl) {
      state.weekEvents = [];
      state.weekEventsKey = key;
      updateCalendarFeedStatus();
      return;
    }

    if ((!force && state.weekEventsKey === key) || state.loadingWeekEvents) {
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

  function refreshCalendarFeed() {
    if (!state.calendarFeedUrl) {
      updateCalendarFeedStatus("No calendar feed connected");
      return;
    }

    const weekDates = getWeekDates(state.weekStart || getStartOfWeekIso(new Date()));
    ensureWeekEventsLoaded(weekDates[0], weekDates.length, { force: true });
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

  function buildGoalCard(goal, tasks, { unassigned = false } = {}) {
    const goalName = goal?.name || "";
    const goalDescription = goal?.description || "";
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

    if (!unassigned && goalDescription) {
      card.appendChild(buildGoalDescriptionField(goalName, goalDescription));
    }

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

  function buildGoalDescriptionField(goalName, description) {
    const wrap = document.createElement("button");
    wrap.className = "goal-description-card";
    wrap.type = "button";
    wrap.title = "Edit goal description";
    wrap.addEventListener("click", () => openGoalDescriptionDialog(goalName));

    const label = document.createElement("div");
    label.className = "goal-description-label";
    label.textContent = "Description";
    wrap.appendChild(label);

    const body = document.createElement("div");
    body.className = "goal-description-body";
    body.textContent = description || "Add context, intent, OKR framing, or success criteria for this goal.";
    if (!description) {
      body.classList.add("is-empty");
    }
    wrap.appendChild(body);

    return wrap;
  }

  function buildGoalActions(goalName) {
    const actions = document.createElement("div");
    actions.className = "goal-card-actions";
    const goalIndex = state.goals.findIndex((goal) => goal.name === goalName);

    const menuButton = document.createElement("button");
    menuButton.className = "week-card-menu-btn";
    menuButton.type = "button";
    menuButton.textContent = "⋯";
    menuButton.title = "Goal actions";
    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.goalCardMenuName = state.goalCardMenuName === goalName ? null : goalName;
      state.weekCardMenuTaskId = null;
      renderCurrentView();
    });
    actions.appendChild(menuButton);

    if (state.goalCardMenuName === goalName) {
      const menu = document.createElement("div");
      menu.className = "week-card-menu goal-card-menu";

      const addTaskButton = document.createElement("button");
      addTaskButton.className = "week-card-menu-item";
      addTaskButton.type = "button";
      addTaskButton.textContent = "+ Task";
      addTaskButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.goalCardMenuName = null;
        openGoalTaskDialog(goalName);
      });
      menu.appendChild(addTaskButton);

      const editDescriptionButton = document.createElement("button");
      editDescriptionButton.className = "week-card-menu-item";
      editDescriptionButton.type = "button";
      editDescriptionButton.textContent = "Description";
      editDescriptionButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openGoalDescriptionDialog(goalName);
      });
      menu.appendChild(editDescriptionButton);

      const upButton = document.createElement("button");
      upButton.className = "week-card-menu-item";
      upButton.type = "button";
      upButton.textContent = "Move up";
      upButton.disabled = goalIndex <= 0;
      upButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.goalCardMenuName = null;
        moveGoal(goalName, -1);
      });
      menu.appendChild(upButton);

      const downButton = document.createElement("button");
      downButton.className = "week-card-menu-item";
      downButton.type = "button";
      downButton.textContent = "Move down";
      downButton.disabled = goalIndex === -1 || goalIndex >= state.goals.length - 1;
      downButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.goalCardMenuName = null;
        moveGoal(goalName, 1);
      });
      menu.appendChild(downButton);

      const renameButton = document.createElement("button");
      renameButton.className = "week-card-menu-item";
      renameButton.type = "button";
      renameButton.textContent = "Rename";
      renameButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.goalCardMenuName = null;
        renameGoal(goalName);
      });
      menu.appendChild(renameButton);

      const deleteButton = document.createElement("button");
      deleteButton.className = "week-card-menu-item is-remove";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.goalCardMenuName = null;
        deleteGoal(goalName);
      });
      menu.appendChild(deleteButton);

      actions.appendChild(menu);
    }

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

    const menuButton = document.createElement("button");
    menuButton.className = "week-card-menu-btn";
    menuButton.type = "button";
    menuButton.textContent = "⋯";
    menuButton.title = "Task actions";
    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.weekCardMenuTaskId = state.weekCardMenuTaskId === task.id ? null : task.id;
      renderCurrentView();
    });
    row.appendChild(menuButton);

    if (state.weekCardMenuTaskId === task.id) {
      const menu = document.createElement("div");
      menu.className = "week-card-menu";

      if (task.status !== "Done") {
        const doneButton = document.createElement("button");
        doneButton.className = "week-card-menu-item is-done";
        doneButton.type = "button";
        doneButton.textContent = "Done";
        doneButton.addEventListener("click", (event) => {
          event.stopPropagation();
          state.weekCardMenuTaskId = null;
          markTaskDone(task.id);
        });
        menu.appendChild(doneButton);
      }

      const editButton = document.createElement("button");
      editButton.className = "week-card-menu-item";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.weekCardMenuTaskId = null;
        openWeekTaskDialog(
          task.scheduled_date || getStartOfWeekIso(new Date()),
          task.scheduled_hour || WEEK_HOURS[0],
          task,
        );
      });
      menu.appendChild(editButton);

      row.appendChild(menu);
    }

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
    const fromIndex = state.goals.findIndex((goal) => goal.name === goalName);
    const toIndex = fromIndex + direction;
    if (fromIndex === -1 || toIndex < 0 || toIndex >= state.goals.length) {
      return;
    }

    const reordered = [...state.goals];
    const [movedGoal] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedGoal);
    state.goals = reordered;
    void saveTasks({ message: "Goal order updated" });
    renderCurrentView();
  }

  function renameGoal(goalName) {
    const nextName = window.prompt("Rename goal", goalName)?.trim();
    if (!nextName || nextName === goalName) {
      return;
    }

    if (goalNames().includes(nextName)) {
      toast("Goal name already exists");
      return;
    }

    state.tasks.forEach((task) => {
      if (task.goal === goalName) {
        task.goal = nextName;
      }
    });

    const nextGoals = state.goals.map((goal) =>
      goal.name === goalName ? { ...goal, name: nextName } : goal,
    );
    state.goals = normalizeGoals(nextGoals, state.tasks);
    void saveTasks({ message: "Goal renamed" });
    renderCurrentView();
  }

  async function updateGoalDescription(goalName, description) {
    const goal = findGoal(goalName);
    if (!goal) {
      return;
    }

    const nextDescription = String(description || "").trim();
    if ((goal.description || "") === nextDescription) {
      return;
    }

    goal.description = nextDescription;
    await saveTasks({ message: "Goal updated" });
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
    state.goals = state.goals.filter((goal) => goal.name !== goalName);
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
    cell.colSpan = getBoardColumnCount();
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
      ${teamName ? `
        <div class="team-actions">
          <button class="team-action-btn team-style-btn" type="button" title="Change area colors">Colors</button>
          <button class="team-action-btn" type="button" title="Rename area">Rename</button>
        </div>
      ` : ""}
    </div>`;
    const filterButton = cell.querySelector(".team-filter-btn");
    if (filterButton) {
      filterButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleTeamFilter(teamName);
      });
    }
    const actionButton = cell.querySelector(".team-action-btn:not(.team-style-btn)");
    if (actionButton) {
      actionButton.addEventListener("click", (event) => {
        event.stopPropagation();
        renameArea(teamName);
      });
    }
    const styleButton = cell.querySelector(".team-style-btn");
    if (styleButton) {
      styleButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openTeamStyleDialog(teamName);
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

    if (state.teamStyles[teamName]) {
      if (!state.teamStyles[nextName]) {
        state.teamStyles[nextName] = { ...state.teamStyles[teamName] };
      }
      delete state.teamStyles[teamName];
    }

    state.teams = state.teams.map((team) => (team === teamName ? nextName : team));
    state.teams = normalizeTeams(state.teams, state.tasks);
    syncTeamStylesWithTeams();

    if (els.fTeam && els.fTeam.value === teamName) {
      els.fTeam.value = nextName;
    }

    rebuildTeamFilter();
    void saveTasks({ message: "Area renamed" });
    renderCurrentView();
  }

  function buildRow(task) {
    const row = document.createElement("tr");
    const manualMode = isManualBoardOrderMode();
    row.dataset.id = task.id;
    row.draggable = manualMode;
    row.classList.toggle("drag-disabled", !manualMode);
    if (manualMode) {
      row.addEventListener("dragstart", (event) => onDragStart(event, task.id));
      row.addEventListener("dragend", onDragEnd);
      row.addEventListener("dragover", (event) => onDragOver(event, task.id));
      row.addEventListener("drop", (event) => onDrop(event, task.id));
    }

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
    row.appendChild(buildCreatedCell(task));
    row.appendChild(
      buildSelectCell(task, "goal", "col-goal", ["", ...goalNames()], () => goalBadge(task.goal)),
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
    cell.colSpan = getBoardColumnCount();
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
    if (!deadline) {
      inner.innerHTML = '<span style="color:var(--muted)">Set date…</span>';
      cell.replaceChildren(inner);
      return;
    }

    const overdue = (daysUntil(deadline) ?? 0) < 0;
    inner.innerHTML = `
      <span class="deadline-badge${overdue ? " is-overdue" : ""}">
        <span class="deadline-text">${formatDate(deadline)}</span>
      </span>
    `;
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
    clearBoardFilters({ render: false });
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
    const label =
      status === "In development" ? "Prog" : status === "Not started" ? "Todo" : status;
    return `<span class="badge ${className}" title="${escapeHtml(status)}">${label}</span>`;
  }

  function teamBadgeHtml(team) {
    if (!team) {
      return "";
    }

    const [color, background] = teamColor(team);
    return `<span class="team-badge" style="background:${background};color:${color}" title="${escapeHtml(team)}">${compactAreaLabel(team)}</span>`;
  }

  function goalBadge(goal) {
    if (!goal) {
      return "";
    }

    return `<span class="badge g-goal" title="${escapeHtml(goal)}">${compactGoalLabel(goal)}</span>`;
  }

  function modeBadge(mode) {
    if (!mode) {
      return "";
    }

    const className = mode === "Change" ? "m-change" : "m-run";
    const label = mode === "Change" ? "Chg" : mode;
    return `<span class="badge ${className}" title="${escapeHtml(mode)}">${label}</span>`;
  }

  function ownerBadge(owner) {
    if (!owner) {
      return "";
    }

    const className = owner === "Me" ? "o-me" : "o-delegate";
    const label = owner === "Delegate" ? "Del" : owner;
    return `<span class="badge ${className}" title="${escapeHtml(owner)}">${label}</span>`;
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
    const label = priority === "Needs refinement" ? "Ref." : priority;
    return `<span class="badge ${className}" title="${escapeHtml(priority)}">${label}</span>`;
  }

  function timeBadge(timeEstimate) {
    if (!timeEstimate) {
      return "";
    }

    const className = timeEstimate === "<5m" ? "t-quick" : "t-block";
    const label = timeEstimate;
    return `<span class="badge ${className}">${label}</span>`;
  }

  function compactGoalLabel(goal) {
    const words = String(goal || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) {
      return "";
    }

    if (words.length === 1) {
      return words[0];
    }

    const shortWords = words.filter((word) => word.length > 3);
    if (shortWords.length >= 2) {
      return `${shortWords[0]} ${shortWords[1]}`;
    }

    if (words.length >= 3) {
      return words
        .slice(0, 3)
        .map((word) => word[0]?.toUpperCase() || "")
        .join("");
    }

    return words.slice(0, 2).join(" ");
  }

  function compactAreaLabel(team) {
    const value = String(team || "").trim();
    if (!value) {
      return "";
    }

    if (value.length <= 4) {
      return value;
    }

    const words = value.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return words
        .slice(0, 3)
        .map((word) => word[0]?.toUpperCase() || "")
        .join("");
    }

    return value.slice(0, 3);
  }

  function onDragStart(event, id) {
    if (state.dragTeam || !isManualBoardOrderMode()) {
      event.preventDefault();
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
    if (state.dragTeam || !isManualBoardOrderMode()) {
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
    if (state.dragTeam || !isManualBoardOrderMode()) {
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
    state.topChromePinned = loadTopChromePinnedPreference();
    state.pageCollapsedIds = loadCollapsedPagePreference();
    state.showCreatedAt = loadShowCreatedAtPreference();
    state.weekStart = getStartOfWeekIso(new Date());
    syncCreatedAtVisibility();
    wireUi();
    await loadData();
    renderCurrentView();
    window.setInterval(checkForExternalUpdates, POLL_INTERVAL_MS);
    window.setInterval(() => {
      if (currentView === "week") {
        renderCurrentView();
      }
    }, WEEK_CLOCK_TICK_MS);
  }

  void boot();
})();
