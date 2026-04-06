import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Icon,
  Button,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  Select,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Switch,
  useDisclosure,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from "@chakra-ui/react";
import {
  FiPlus,
  FiSearch,
  FiCalendar,
  FiTag,
  FiTrash2,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiX,
  FiClock,
  FiMapPin,
  FiRepeat,
  FiAlignLeft,
  FiCheckSquare,
} from "react-icons/fi";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createTodoFromEvent } from "../../utils/linkHelpers";
import { loadTodos as dbLoadTodosForCal } from "../../services/db";
import { useAuth } from "../../context/AuthContext";
import { loadEvents as dbLoadEvents, saveEvents as dbSaveEvents, loadCategories as dbLoadCategories, saveCategories as dbSaveCategories } from "../../services/db";

// --- Constants ---
const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_MONTH_EVENTS = 2;

const COLOR_PRESETS = [
  { value: "sage", hex: "#6B7B6E" },
  { value: "blue", hex: "#4A90D9" },
  { value: "red", hex: "#D9534F" },
  { value: "orange", hex: "#E0924F" },
  { value: "purple", hex: "#8B6FB0" },
  { value: "teal", hex: "#4DB6AC" },
];

const RECURRING_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "weekday", label: "Every weekday (Mon \u2013 Fri)" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const RECURRENCE_UNITS = [
  { value: "day", label: "Day", labelPlural: "Days" },
  { value: "week", label: "Week", labelPlural: "Weeks" },
  { value: "month", label: "Month", labelPlural: "Months" },
  { value: "year", label: "Year", labelPlural: "Years" },
];

const DEFAULT_EVENTS = [
  {
    id: 1,
    title: "Team standup",
    description: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "09:30",
    allDay: false,
    category: "Work",
    color: "blue",
    recurring: "daily",
    location: "",
    linkedTodoId: null,
    linkedNoteId: null,
    createdAt: "2025-07-12T10:00:00.000Z",
    updatedAt: "2025-07-12T10:00:00.000Z",
  },
  {
    id: 2,
    title: "Grocery pickup",
    description: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "",
    endTime: "",
    allDay: true,
    category: "Personal",
    color: "sage",
    recurring: "none",
    location: "",
    linkedTodoId: null,
    linkedNoteId: null,
    createdAt: "2025-07-11T10:00:00.000Z",
    updatedAt: "2025-07-11T10:00:00.000Z",
  },
];

// --- (Persistence handled by Firestore via db.js) ---

// --- Helpers ---

function getColorHex(v) {
  return COLOR_PRESETS.find((c) => c.value === v)?.hex || COLOR_PRESETS[0].hex;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function dateKey(y, m, d) {
  const date = new Date(y, m, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatFullDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatHour(h) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function getWeekDays(date) {
  const d = new Date(date);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    return {
      date: cur,
      dateStr: dateKey(cur.getFullYear(), cur.getMonth(), cur.getDate()),
      label: cur.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: cur.getDate(),
      isToday: cur.toDateString() === new Date().toDateString(),
    };
  });
}

function getEventPosition(event) {
  if (!event.startTime) return null;
  const [sh, sm] = event.startTime.split(":").map(Number);
  const top = (sh + sm / 60) * HOUR_HEIGHT;
  if (!event.endTime) return { top, height: HOUR_HEIGHT * 0.5 };
  const [eh, em] = event.endTime.split(":").map(Number);
  const height = Math.max(((eh + em / 60) - (sh + sm / 60)) * HOUR_HEIGHT, HOUR_HEIGHT * 0.4);
  return { top, height };
}

function layoutEvents(events) {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return (b.endTime || b.startTime).localeCompare(a.endTime || a.startTime);
  });

  const laid = sorted.map(evt => {
    const pos = getEventPosition(evt);
    return { event: evt, top: pos?.top ?? 0, bottom: (pos?.top ?? 0) + (pos?.height ?? 0), col: 0, totalCols: 1 };
  });

  const clusters = [];
  let cluster = [laid[0]];
  let clusterEnd = laid[0].bottom;

  for (let i = 1; i < laid.length; i++) {
    if (laid[i].top < clusterEnd) {
      cluster.push(laid[i]);
      clusterEnd = Math.max(clusterEnd, laid[i].bottom);
    } else {
      clusters.push(cluster);
      cluster = [laid[i]];
      clusterEnd = laid[i].bottom;
    }
  }
  clusters.push(cluster);

  for (const group of clusters) {
    const cols = [];
    for (const item of group) {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        if (item.top >= cols[c]) {
          item.col = c;
          cols[c] = item.bottom;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.col = cols.length;
        cols.push(item.bottom);
      }
    }
    const totalCols = cols.length;
    for (const item of group) item.totalCols = totalCols;
  }

  return laid;
}

function getViewLabel(mode, date) {
  if (mode === "day") return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (mode === "week") {
    const days = getWeekDays(date);
    const s = days[0].date;
    const e = days[6].date;
    if (s.getMonth() === e.getMonth()) return `${s.toLocaleDateString("en-US", { month: "short" })} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
    return `${s.toLocaleDateString("en-US", { month: "short" })} ${s.getDate()} – ${e.toLocaleDateString("en-US", { month: "short" })} ${e.getDate()}, ${e.getFullYear()}`;
  }
  if (mode === "month") return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return String(date.getFullYear());
}

function navigateView(mode, date, dir) {
  const d = new Date(date);
  if (mode === "day") d.setDate(d.getDate() + dir);
  else if (mode === "week") d.setDate(d.getDate() + 7 * dir);
  else if (mode === "month") d.setMonth(d.getMonth() + dir);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function expandRecurringEvents(events, windowStart, windowEnd) {
  const result = [];
  const wStart = new Date(windowStart + "T00:00:00");
  const wEnd = new Date(windowEnd + "T00:00:00");

  for (const evt of events) {
    if (!evt.recurring || evt.recurring === "none") {
      result.push(evt);
      continue;
    }

    const anchor = new Date(evt.date + "T00:00:00");
    let iterations = 0;
    const MAX_ITER = 1500;

    if (evt.recurring === "custom" && evt.recurrenceRule) {
      const rule = evt.recurrenceRule;
      const ruleStart = new Date((rule.startDate || evt.date) + "T00:00:00");
      const ruleEnd = rule.endDate ? new Date(rule.endDate + "T00:00:00") : null;
      const every = Math.max(1, rule.every || 1);
      const cur = new Date(ruleStart);

      while (cur <= wEnd && iterations < MAX_ITER) {
        if (ruleEnd && cur > ruleEnd) break;
        if (cur >= wStart) {
          result.push({ ...evt, date: toDateStr(cur), _isRecurrenceInstance: true });
        }
        iterations++;
        if (rule.unit === "day") cur.setDate(cur.getDate() + every);
        else if (rule.unit === "week") cur.setDate(cur.getDate() + 7 * every);
        else if (rule.unit === "month") cur.setMonth(cur.getMonth() + every);
        else if (rule.unit === "year") cur.setFullYear(cur.getFullYear() + every);
        else break;
      }
      continue;
    }

    // Standard recurrence types
    const cur = new Date(anchor);
    while (cur <= wEnd && iterations < MAX_ITER) {
      iterations++;
      const dayOfWeek = cur.getDay();

      if (evt.recurring === "weekday") {
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && cur >= wStart) {
          result.push({ ...evt, date: toDateStr(cur), _isRecurrenceInstance: true });
        }
        cur.setDate(cur.getDate() + 1);
      } else if (evt.recurring === "daily") {
        if (cur >= wStart) {
          result.push({ ...evt, date: toDateStr(cur), _isRecurrenceInstance: true });
        }
        cur.setDate(cur.getDate() + 1);
      } else if (evt.recurring === "weekly") {
        if (cur >= wStart) {
          result.push({ ...evt, date: toDateStr(cur), _isRecurrenceInstance: true });
        }
        cur.setDate(cur.getDate() + 7);
      } else if (evt.recurring === "monthly") {
        if (cur >= wStart) {
          result.push({ ...evt, date: toDateStr(cur), _isRecurrenceInstance: true });
        }
        cur.setMonth(cur.getMonth() + 1);
      } else if (evt.recurring === "yearly") {
        if (cur >= wStart) {
          result.push({ ...evt, date: toDateStr(cur), _isRecurrenceInstance: true });
        }
        cur.setFullYear(cur.getFullYear() + 1);
      } else {
        break;
      }
    }
  }
  return result;
}

function getRecurrenceSummary(draft) {
  if (!draft) return "";
  const unitObj = RECURRENCE_UNITS.find((u) => u.value === draft.unit);
  const unitLabel = draft.every === 1 ? unitObj?.label?.toLowerCase() : unitObj?.labelPlural?.toLowerCase();
  let text = `Occurs every ${draft.every === 1 ? "" : draft.every + " "}${unitLabel}`;
  if (draft.startDate) {
    const d = new Date(draft.startDate + "T00:00:00");
    text += ` starting ${d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}`;
  }
  if (draft.endDate) {
    const d = new Date(draft.endDate + "T00:00:00");
    text += ` until ${d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}`;
  }
  return text;
}

// --- Main Component ---

const CalendarPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [storedCategories, setStoredCategories] = useState([]);
  const initialLoadDone = useRef(false);
  const [viewMode, setViewMode] = useState("month");
  const [viewDate, setViewDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeEventId, setActiveEventId] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);

  // Cached todos for calendar display
  const [calTodos, setCalTodos] = useState([]);

  // Create mode
  const [isCreating, setIsCreating] = useState(false);
  const [draftEvent, setDraftEvent] = useState(null);

  // Detail drafts
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  // Context menu
  const [contextMenu, setContextMenu] = useState(null);

  // Popover state
  const [categorySearch, setCategorySearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isCatOpen, onOpen: onCatOpen, onClose: onCatClose } = useDisclosure();
  const { isOpen: isFilterOpen, onOpen: onFilterOpen, onClose: onFilterClose } = useDisclosure();
  const { isOpen: isCustomRecOpen, onOpen: onCustomRecOpen, onClose: onCustomRecClose } = useDisclosure();

  const [customRecDraft, setCustomRecDraft] = useState({ startDate: "", every: 1, unit: "week", endDate: "" });

  const cancelRef = useRef();
  const titleRef = useRef();
  const storageSaveTimer = useRef(null);
  const timeGridRef = useRef();

  // --- Derived ---

  const activeEvent = events.find((e) => e.id === activeEventId) || null;
  const modalEvent = isCreating ? draftEvent : activeEvent;

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const allCategories = useMemo(() => {
    const cats = new Set(storedCategories);
    events.forEach((e) => { if (e.category?.trim()) cats.add(e.category.trim()); });
    return Array.from(cats).sort();
  }, [events, storedCategories]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch = !searchTerm ||
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.description && e.description.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;
      if (activeFilter === "All") return true;
      return e.category === activeFilter;
    });
  }, [events, searchTerm, activeFilter]);

  const todosAsEvents = useMemo(() => {
    const todos = calTodos;
    return todos
      .filter((t) => t.dueDate && !t.completed)
      .filter((t) => {
        if (!searchTerm && activeFilter === "All") return true;
        const matchesSearch = !searchTerm ||
          t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        if (activeFilter === "All") return true;
        return t.category === activeFilter;
      })
      .map((t) => ({
        id: `todo-${t.id}`,
        title: t.title,
        date: t.dueDate,
        startTime: "",
        endTime: "",
        allDay: true,
        color: "teal",
        category: t.category || "",
        _isTodo: true,
        _todoId: t.id,
      }));
  }, [events, searchTerm, activeFilter]);

  // Month grid (moved before viewWindow so monthRows is available)
  const monthRows = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const cells = [];
    const prevDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = 0; i < firstDay; i++) cells.push({ day: prevDays - firstDay + i + 1, isCurrentMonth: false, dateStr: dateKey(viewYear, viewMonth - 1, prevDays - firstDay + i + 1) });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, isCurrentMonth: true, dateStr: dateKey(viewYear, viewMonth, d) });
    const rem = cells.length % 7;
    if (rem > 0) for (let i = 1; i <= 7 - rem; i++) cells.push({ day: i, isCurrentMonth: false, dateStr: dateKey(viewYear, viewMonth + 1, i) });
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewYear, viewMonth]);

  // Week days
  const weekDays = useMemo(() => getWeekDays(viewDate), [viewDate]);

  // View window for recurrence expansion
  const viewWindow = useMemo(() => {
    if (viewMode === "day") {
      const ds = dateKey(viewYear, viewMonth, viewDate.getDate());
      return { start: ds, end: ds };
    }
    if (viewMode === "week") {
      return { start: weekDays[0].dateStr, end: weekDays[6].dateStr };
    }
    if (viewMode === "month") {
      const firstCell = monthRows[0][0].dateStr;
      const lastRow = monthRows[monthRows.length - 1];
      const lastCell = lastRow[lastRow.length - 1].dateStr;
      return { start: firstCell, end: lastCell };
    }
    // year
    return { start: `${viewYear}-01-01`, end: `${viewYear}-12-31` };
  }, [viewMode, viewYear, viewMonth, viewDate, weekDays, monthRows]);

  const eventsByDate = useMemo(() => {
    const expanded = expandRecurringEvents(filteredEvents, viewWindow.start, viewWindow.end);
    const map = {};
    expanded.forEach((e) => { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); });
    todosAsEvents.forEach((e) => { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); });
    return map;
  }, [filteredEvents, todosAsEvents, viewWindow]);

  // Year mini-months
  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const daysInMonth = new Date(viewYear, m + 1, 0).getDate();
      const firstDay = new Date(viewYear, m, 1).getDay();
      const cells = [];
      for (let i = 0; i < firstDay; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) cells.push(d);
      return { month: m, cells, label: new Date(viewYear, m, 1).toLocaleDateString("en-US", { month: "short" }) };
    });
  }, [viewYear]);

  // Category popover
  const filteredCategoryOptions = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    return term ? allCategories.filter((c) => c.toLowerCase().includes(term)) : allCategories;
  }, [allCategories, categorySearch]);
  const categorySearchTrimmed = categorySearch.trim();
  const showCreateOption = categorySearchTrimmed && !allCategories.some((c) => c.toLowerCase() === categorySearchTrimmed.toLowerCase());

  // Filter dropdown
  const filteredFilterOptions = useMemo(() => {
    const term = filterSearch.trim().toLowerCase();
    return term ? allCategories.filter((c) => c.toLowerCase().includes(term)) : allCategories;
  }, [allCategories, filterSearch]);

  // Current time
  const now = new Date();
  const nowTop = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
  const today = todayStr();

  // --- Effects ---

  // Load from Firestore on mount
  useEffect(() => {
    if (!user) return;
    Promise.all([dbLoadEvents(user.uid), dbLoadCategories(user.uid, "calendar"), dbLoadTodosForCal(user.uid)]).then(([e, c, t]) => {
      setEvents(e);
      setStoredCategories(c);
      setCalTodos(t);
      initialLoadDone.current = true;
    });
  }, [user]);

  useEffect(() => {
    if (!user || !initialLoadDone.current) return;
    if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current);
    storageSaveTimer.current = setTimeout(() => dbSaveEvents(user.uid, events), 500);
    return () => { if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current); };
  }, [events, user]);

  useEffect(() => {
    if (!user || !initialLoadDone.current) return;
    dbSaveCategories(user.uid, "calendar", storedCategories);
  }, [storedCategories, user]);

  useEffect(() => {
    return () => { if (storageSaveTimer.current) clearTimeout(storageSaveTimer.current); };
  }, []);

  useEffect(() => {
    if (activeEvent) {
      setDraftTitle(activeEvent.title);
      setDraftDescription(activeEvent.description || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId]);

  useEffect(() => {
    if (activeEventId && !events.find((e) => e.id === activeEventId)) {
      setActiveEventId(null);
      onDetailClose();
    }
  }, [events, activeEventId, onDetailClose]);

  // URL ?new=1
  useEffect(() => {
    const newParam = searchParams.get("new");
    if (newParam === "1") {
      setSearchParams({}, { replace: true });
      setTimeout(() => handleStartCreate(todayStr()), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll time grid to ~7 AM on view switch
  useEffect(() => {
    if ((viewMode === "week" || viewMode === "day") && timeGridRef.current) {
      timeGridRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, [viewMode]);

  // Close context menu on any click/scroll/escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  // --- Handlers ---

  const updateActiveEvent = useCallback((updates) => {
    if (!activeEventId) return;
    setEvents((prev) => prev.map((e) => e.id === activeEventId ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e));
  }, [activeEventId]);

  const handleFieldChange = useCallback((field, value) => {
    if (isCreating) {
      setDraftEvent((prev) => prev ? { ...prev, [field]: value, updatedAt: new Date().toISOString() } : prev);
    } else {
      updateActiveEvent({ [field]: value });
    }
  }, [isCreating, updateActiveEvent]);

  const handleStartCreate = useCallback((dateStr, timeStr) => {
    const nowIso = new Date().toISOString();
    const endTime = timeStr ? (() => { const [h] = timeStr.split(":").map(Number); return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:00`; })() : "";
    setDraftEvent({
      id: Date.now(), title: "", description: "", date: dateStr || todayStr(),
      startTime: timeStr || "", endTime, allDay: !timeStr,
      category: "", color: "sage", recurring: "none", recurrenceRule: null, location: "",
      linkedTodoId: null, linkedNoteId: null, createdAt: nowIso, updatedAt: nowIso,
    });
    setDraftTitle("");
    setDraftDescription("");
    setIsCreating(true);
    onDetailOpen();
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [onDetailOpen]);

  const handleCreateConfirm = () => {
    if (draftEvent) {
      setEvents((prev) => [draftEvent, ...prev]);
    }
    setDraftEvent(null);
    setIsCreating(false);
    onDetailClose();
  };

  const handleEditEvent = (event) => {
    setIsCreating(false);
    setDraftEvent(null);
    setActiveEventId(event.id);
    onDetailOpen();
  };

  const handleCloseDetail = () => {
    if (!isCreating && activeEventId) {
      const event = events.find((e) => e.id === activeEventId);
      if (event && !event.title.trim() && !event.description.trim()) {
        setEvents((prev) => prev.filter((e) => e.id !== activeEventId));
      }
    }
    setActiveEventId(null);
    setDraftEvent(null);
    setIsCreating(false);
    onDetailClose();
  };

  const handleRequestDelete = (event) => { setEventToDelete(event); onDeleteOpen(); };

  const handleDeleteConfirm = () => {
    if (!eventToDelete) return;
    const id = eventToDelete.id;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEventToDelete(null);
    onDeleteClose();
    if (id === activeEventId) { setActiveEventId(null); onDetailClose(); }
  };

  const handleContextMenu = useCallback((e, event) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item: event });
  }, []);

  // Title/description
  const handleTitleChange = (e) => {
    const v = e.target.value;
    setDraftTitle(v);
    handleFieldChange("title", v);
  };
  const handleDescriptionChange = (e) => {
    const v = e.target.value;
    setDraftDescription(v);
    handleFieldChange("description", v);
  };

  // Category
  const assignCategory = (cat) => {
    if (cat && !storedCategories.includes(cat)) setStoredCategories((prev) => [...prev, cat]);
    handleFieldChange("category", cat);
    setCategorySearch("");
    onCatClose();
  };
  const deleteCategory = (cat) => {
    setStoredCategories((prev) => prev.filter((c) => c !== cat));
    setEvents((prev) => prev.map((e) => (e.category === cat ? { ...e, category: "" } : e)));
    if (activeFilter === cat) setActiveFilter("All");
  };
  const handleFilterSelect = (key) => { setActiveFilter(key); setFilterSearch(""); onFilterClose(); };

  // Navigation
  const goToToday = () => { setViewDate(new Date()); };
  const handleNav = (dir) => { setViewDate(navigateView(viewMode, viewDate, dir)); };

  // --- Render helpers ---

  const renderEventBar = (evt, compact) => {
    if (evt._isTodo) {
      return (
        <Flex
          key={`${evt.id}-${evt.date}`}
          border="1.5px solid"
          borderColor={getColorHex(evt.color)}
          borderRadius="3px"
          px={1.5}
          py={compact ? "1px" : 0.5}
          cursor="pointer"
          overflow="hidden"
          align="center"
          gap={1}
          onClick={(e) => { e.stopPropagation(); navigate(`/todo?id=${evt._todoId}`); }}
          _hover={{ opacity: 0.85 }}
          transition="opacity 0.1s"
        >
          <Icon as={FiCheckSquare} boxSize="10px" color={getColorHex(evt.color)} flexShrink={0} />
          <Text fontSize="xs" color={getColorHex(evt.color)} fontWeight="500" noOfLines={1} lineHeight="1.3">
            {evt.title || "(No title)"}
          </Text>
        </Flex>
      );
    }
    return (
      <Box
        key={`${evt.id}-${evt.date}`}
        bg={getColorHex(evt.color)}
        borderRadius="3px"
        px={1.5}
        py={compact ? "1px" : 0.5}
        cursor="pointer"
        overflow="hidden"
        onClick={(e) => { e.stopPropagation(); handleEditEvent(evt); }}
        onContextMenu={(e) => handleContextMenu(e, evt)}
        _hover={{ opacity: 0.85 }}
        transition="opacity 0.1s"
      >
        <Text fontSize="xs" color="white" fontWeight="500" noOfLines={1} lineHeight="1.3">
          {!compact && evt.startTime && !evt.allDay ? `${formatTime12(evt.startTime)} ` : ""}{evt.title || "(No title)"}
        </Text>
      </Box>
    );
  };

  // --- RENDER ---

  return (
    <Flex direction="column" px={0} py={0} h={{ base: "calc(100vh - 52px)", md: "100vh" }} overflow="hidden">
      {/* ===== HEADER ===== */}
      <Flex align="center" justify="space-between" mb={3} flexShrink={0} flexWrap="wrap" gap={2} px={{ base: 3, md: 4 }} pt={{ base: 3, md: 4 }}>
        <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="700" color="text" letterSpacing="-0.02em">
          Calendar
        </Text>
        <HStack spacing={1}>
          {["day", "week", "month", "year"].map((m) => (
            <Button
              key={m}
              size="xs"
              variant={viewMode === m ? "solid" : "ghost"}
              bg={viewMode === m ? "primary" : "transparent"}
              color={viewMode === m ? "white" : "text.secondary"}
              _hover={{ bg: viewMode === m ? "#5a6656" : "bg.hover" }}
              fontWeight="500"
              fontSize="xs"
              borderRadius="4px"
              px={2.5}
              textTransform="capitalize"
              onClick={() => setViewMode(m)}
            >
              {m.charAt(0).toUpperCase()}
            </Button>
          ))}
        </HStack>
      </Flex>

      {/* Nav row */}
      <Flex align="center" justify="space-between" mb={3} flexShrink={0} flexWrap="wrap" gap={2} px={{ base: 3, md: 4 }}>
        <HStack spacing={1}>
          <IconButton icon={<FiChevronLeft />} variant="ghost" size="sm" color="text.secondary" _hover={{ bg: "bg.hover" }} onClick={() => handleNav(-1)} aria-label="Previous" />
          <Text fontSize="sm" fontWeight="600" color="text" minW="160px" textAlign="center">{getViewLabel(viewMode, viewDate)}</Text>
          <IconButton icon={<FiChevronRight />} variant="ghost" size="sm" color="text.secondary" _hover={{ bg: "bg.hover" }} onClick={() => handleNav(1)} aria-label="Next" />
        </HStack>
        <HStack spacing={2}>
          <Button size="sm" variant="ghost" color="text.secondary" fontWeight="400" fontSize="xs" borderRadius="6px" _hover={{ bg: "bg.hover" }} onClick={goToToday}>Today</Button>
          <Button leftIcon={<FiPlus />} onClick={() => handleStartCreate(today)} bg="primary" color="white" _hover={{ bg: "#5a6656" }} size="sm" fontWeight="500" borderRadius="6px">New</Button>
        </HStack>
      </Flex>

      {/* Search + Filter */}
      <Flex gap={3} mb={3} align="center" flexShrink={0} px={{ base: 3, md: 4 }}>
        <InputGroup size="sm" flex={1}>
          <InputLeftElement pointerEvents="none"><Icon as={FiSearch} color="text.tertiary" boxSize="14px" /></InputLeftElement>
          <Input placeholder="Search events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} borderRadius="6px" fontSize="sm" bg="bg.surface" border="1px solid" borderColor="border" _placeholder={{ color: "text.tertiary" }} />
        </InputGroup>
        <Popover isOpen={isFilterOpen} onOpen={() => { setFilterSearch(""); onFilterOpen(); }} onClose={onFilterClose} placement="bottom-end" isLazy>
          <PopoverTrigger>
            <Button size="sm" variant="ghost" bg="bg.surface" border="1px solid" borderColor="border" color="text.secondary" borderRadius="6px" fontWeight="500" fontSize="xs" px={3} flexShrink={0} _hover={{ bg: "bg.hover" }} rightIcon={<Icon as={FiChevronDown} boxSize="12px" />}>
              {activeFilter === "All" ? "All Events" : activeFilter}
            </Button>
          </PopoverTrigger>
          <PopoverContent w="240px" bg="background" borderColor="border" borderRadius="8px" shadow="0 8px 24px rgba(0,0,0,0.15)" _focus={{ outline: "none" }}>
            <PopoverBody p={2}>
              {allCategories.length > 4 && <Input placeholder="Search categories..." size="xs" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} mb={2} borderRadius="4px" fontSize="xs" autoFocus />}
              <VStack align="stretch" spacing={0} maxH="260px" overflowY="auto">
                <Flex px={2} py={1.5} cursor="pointer" borderRadius="4px" _hover={{ bg: "bg.hover" }} align="center" justify="space-between" onClick={() => handleFilterSelect("All")}>
                  <Text fontSize="xs" color="text" fontWeight={activeFilter === "All" ? "600" : "400"}>All Events</Text>
                  {activeFilter === "All" && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                </Flex>
                {filteredFilterOptions.length > 0 && <Box h="1px" bg="border" my={1.5} mx={1} />}
                {filteredFilterOptions.map((cat) => (
                  <Flex key={cat} px={2} py={1.5} cursor="pointer" borderRadius="4px" _hover={{ bg: "bg.hover" }} align="center" justify="space-between" onClick={() => handleFilterSelect(cat)}>
                    <Text fontSize="xs" color="text" fontWeight={activeFilter === cat ? "600" : "400"} noOfLines={1} flex={1}>{cat}</Text>
                    <HStack spacing={1}>
                      {activeFilter === cat && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                      <IconButton icon={<FiX />} size="xs" variant="ghost" color="text.tertiary" _hover={{ color: "red.400", bg: "transparent" }} aria-label={`Delete ${cat}`} minW="18px" h="18px" onClick={(e) => { e.stopPropagation(); deleteCategory(cat); }} />
                    </HStack>
                  </Flex>
                ))}
                {allCategories.length === 0 && <Text fontSize="xs" color="text.tertiary" px={2} py={1.5} fontStyle="italic">No categories yet</Text>}
              </VStack>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      </Flex>

      {/* ===== VIEW CONTENT ===== */}

      {/* ---------- MONTH VIEW ---------- */}
      {viewMode === "month" && (
        <Flex direction="column" flex={1} overflow="hidden" border="1px solid" borderColor="border" borderRadius="0">
          {/* Day headers */}
          <Flex flexShrink={0} borderBottom="1px solid" borderColor="border">
            {DAY_LABELS.map((l, i) => (
              <Box key={i} flex={1} py={1.5} textAlign="center">
                <Text fontSize="xs" fontWeight="500" color="text.tertiary">{l}</Text>
              </Box>
            ))}
          </Flex>
          {/* Grid rows */}
          <Flex direction="column" flex={1}>
            {monthRows.map((row, ri) => (
              <Flex key={ri} flex={1} borderTop={ri > 0 ? "1px solid" : "none"} borderColor="border" minH="0">
                {row.map((cell, ci) => {
                  const isToday = cell.dateStr === today;
                  const dayEvents = eventsByDate[cell.dateStr] || [];
                  const overflow = dayEvents.length - MAX_MONTH_EVENTS;
                  return (
                    <Flex
                      key={cell.dateStr}
                      flex={1}
                      direction="column"
                      p={1}
                      borderLeft={ci > 0 ? "1px solid" : "none"}
                      borderColor="border"
                      cursor="pointer"
                      bg={isToday ? "primary.subtle" : "transparent"}
                      _hover={{ bg: isToday ? "primary.subtle" : "bg.hover" }}
                      transition="background 0.1s"
                      overflow="hidden"
                      onClick={() => handleStartCreate(cell.dateStr)}
                    >
                      <Flex justify="center" mb={0.5} flexShrink={0}>
                        <Flex w="22px" h="22px" borderRadius="full" align="center" justify="center" bg={isToday ? "primary" : "transparent"}>
                          <Text fontSize="xs" fontWeight={isToday ? "700" : "400"} color={isToday ? "white" : cell.isCurrentMonth ? "text" : "text.tertiary"}>
                            {cell.day}
                          </Text>
                        </Flex>
                      </Flex>
                      <VStack spacing="2px" align="stretch" flex={1} overflow="hidden">
                        {dayEvents.slice(0, MAX_MONTH_EVENTS).map((evt) => renderEventBar(evt, true))}
                        {overflow > 0 && (
                          <Text
                            fontSize="xs" color="text.tertiary" pl={1} cursor="pointer" flexShrink={0}
                            onClick={(e) => { e.stopPropagation(); setViewDate(new Date(cell.dateStr + "T00:00:00")); setViewMode("day"); }}
                            _hover={{ color: "text" }}
                          >
                            +{overflow} more
                          </Text>
                        )}
                      </VStack>
                    </Flex>
                  );
                })}
              </Flex>
            ))}
          </Flex>
        </Flex>
      )}

      {/* ---------- WEEK VIEW ---------- */}
      {viewMode === "week" && (
        <Flex direction="column" flex={1} overflow="hidden" border="1px solid" borderColor="border" borderRadius="0">
          <Box ref={timeGridRef} flex={1} overflowY="auto">
            {/* Sticky day header */}
            <Flex position="sticky" top={0} zIndex={4} bg="background" borderBottom="1px solid" borderColor="border">
              <Box w="48px" flexShrink={0} />
              {weekDays.map((d) => (
                <Box key={d.dateStr} flex={1} py={1.5} textAlign="center" borderLeft="1px solid" borderColor="border">
                  <Text fontSize="xs" color="text.tertiary" textTransform="uppercase" letterSpacing="0.05em">{d.label}</Text>
                  <Flex justify="center" mt={0.5}>
                    <Flex w="28px" h="28px" borderRadius="full" align="center" justify="center" bg={d.isToday ? "primary" : "transparent"}>
                      <Text fontSize="sm" fontWeight={d.isToday ? "700" : "500"} color={d.isToday ? "white" : "text"}>{d.dayNum}</Text>
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Flex>
            {/* Sticky all-day row */}
            <Flex position="sticky" top="56px" zIndex={3} bg="background" borderBottom="1px solid" borderColor="border" minH="28px">
              <Flex w="48px" flexShrink={0} align="center" justify="center"><Text fontSize="xs" color="text.tertiary">all-day</Text></Flex>
              {weekDays.map((d) => {
                const allDay = (eventsByDate[d.dateStr] || []).filter((e) => e.allDay || !e.startTime);
                return (
                  <Box key={d.dateStr} flex={1} p={0.5} borderLeft="1px solid" borderColor="border" cursor="pointer" onClick={() => handleStartCreate(d.dateStr)}>
                    {allDay.map((evt) => renderEventBar(evt, true))}
                  </Box>
                );
              })}
            </Flex>
            {/* Time grid */}
            <Flex minH={`${24 * HOUR_HEIGHT}px`}>
              {/* Hour labels column */}
              <Box w="48px" flexShrink={0} position="relative">
                {HOURS.map((h) => {
                  if (h === 0) return null;
                  return (
                    <Text
                      key={h}
                      position="absolute"
                      top={`${h * HOUR_HEIGHT}px`}
                      w="48px"
                      textAlign="center"
                      fontSize="xs"
                      color="text.tertiary"
                      lineHeight="1"
                      transform="translateY(-5px)"
                      userSelect="none"
                    >
                      {formatHour(h)}
                    </Text>
                  );
                })}
              </Box>
              {/* Day columns */}
              {weekDays.map((d) => {
                const timedEvts = (eventsByDate[d.dateStr] || []).filter((e) => !e.allDay && e.startTime);
                return (
                  <Box
                    key={d.dateStr}
                    flex={1}
                    position="relative"
                    borderLeft="1px solid"
                    borderColor="border"
                    cursor="pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const hour = Math.min(Math.floor(y / HOUR_HEIGHT), 23);
                      handleStartCreate(d.dateStr, `${String(hour).padStart(2, "0")}:00`);
                    }}
                  >
                    {/* Hour grid lines */}
                    {HOURS.map((h) => (
                      <Box key={h} position="absolute" top={`${h * HOUR_HEIGHT}px`} left={0} right={0} h={`${HOUR_HEIGHT}px`} borderBottom="1px solid" borderColor="border" />
                    ))}
                    {/* Timed events */}
                    {layoutEvents(timedEvts).map(({ event: evt, col, totalCols }) => {
                      const pos = getEventPosition(evt);
                      if (!pos) return null;
                      const widthPct = `${100 / totalCols}%`;
                      const leftPct = `${(col / totalCols) * 100}%`;
                      return (
                        <Box
                          key={`${evt.id}-${evt.date}`} position="absolute" top={`${pos.top}px`} h={`${pos.height}px`}
                          left={leftPct} w={widthPct} bg={getColorHex(evt.color)} borderRadius="4px"
                          px={1.5} py={0.5} zIndex={1} cursor="pointer" overflow="hidden"
                          borderRight={totalCols > 1 ? "1px solid" : "none"} borderColor="whiteAlpha.300"
                          onClick={(e) => { e.stopPropagation(); handleEditEvent(evt); }}
                          onContextMenu={(e) => handleContextMenu(e, evt)}
                          _hover={{ opacity: 0.85 }} transition="opacity 0.1s"
                        >
                          <Text fontSize="xs" color="white" fontWeight="500" noOfLines={1}>{evt.title || "(No title)"}</Text>
                          {pos.height > 28 && <Text fontSize="xs" color="whiteAlpha.800" noOfLines={1}>{formatTime12(evt.startTime)}{evt.endTime ? ` – ${formatTime12(evt.endTime)}` : ""}</Text>}
                        </Box>
                      );
                    })}
                    {/* Now line */}
                    {d.isToday && (
                      <Box position="absolute" top={`${nowTop}px`} left={0} right={0} zIndex={2} pointerEvents="none">
                        <Flex align="center"><Box w="10px" h="10px" borderRadius="full" bg="red.500" ml="-5px" /><Box flex={1} h="2px" bg="red.500" /></Flex>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Flex>
          </Box>
        </Flex>
      )}

      {/* ---------- DAY VIEW ---------- */}
      {viewMode === "day" && (() => {
        const dayStr = dateKey(viewYear, viewMonth, viewDate.getDate());
        const isToday = dayStr === today;
        const allDay = (eventsByDate[dayStr] || []).filter((e) => e.allDay || !e.startTime);
        const timed = (eventsByDate[dayStr] || []).filter((e) => !e.allDay && e.startTime);
        return (
          <Flex direction="column" flex={1} overflow="hidden" border="1px solid" borderColor="border" borderRadius="0">
            {/* All-day row */}
            {allDay.length > 0 && (
              <Box flexShrink={0} borderBottom="1px solid" borderColor="border" p={2}>
                <Text fontSize="xs" color="text.tertiary" mb={1}>All Day</Text>
                <VStack spacing={1} align="stretch">
                  {allDay.map((evt) => renderEventBar(evt, false))}
                </VStack>
              </Box>
            )}
            {/* Time grid */}
            <Box ref={timeGridRef} flex={1} overflow="auto">
              <Flex>
                <VStack w="56px" flexShrink={0} spacing={0}>
                  {HOURS.map((h) => (
                    <Flex key={h} h={`${HOUR_HEIGHT}px`} align="flex-start" justify="center" pt="2px" flexShrink={0}>
                      <Text fontSize="xs" color="text.tertiary" lineHeight="1">{formatHour(h)}</Text>
                    </Flex>
                  ))}
                </VStack>
                <Box
                  flex={1} position="relative" borderLeft="1px solid" borderColor="border" cursor="pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top + (timeGridRef.current?.scrollTop || 0);
                    const hour = Math.min(Math.floor(y / HOUR_HEIGHT), 23);
                    handleStartCreate(dayStr, `${String(hour).padStart(2, "0")}:00`);
                  }}
                >
                  {HOURS.map((h) => (<Box key={h} h={`${HOUR_HEIGHT}px`} borderBottom="1px solid" borderColor="border" />))}
                  {layoutEvents(timed).map(({ event: evt, col, totalCols }) => {
                    const pos = getEventPosition(evt);
                    if (!pos) return null;
                    const widthPct = `${100 / totalCols}%`;
                    const leftPct = `${(col / totalCols) * 100}%`;
                    return (
                      <Box
                        key={`${evt.id}-${evt.date}`} position="absolute" top={`${pos.top}px`} h={`${pos.height}px`}
                        left={leftPct} w={widthPct} bg={getColorHex(evt.color)} borderRadius="4px"
                        px={2} py={1} zIndex={1} cursor="pointer" overflow="hidden"
                        borderRight={totalCols > 1 ? "1px solid" : "none"} borderColor="whiteAlpha.300"
                        onClick={(e) => { e.stopPropagation(); handleEditEvent(evt); }}
                        onContextMenu={(e) => handleContextMenu(e, evt)}
                        _hover={{ opacity: 0.85 }} transition="opacity 0.1s"
                      >
                        <Text fontSize="sm" color="white" fontWeight="500" noOfLines={1}>{evt.title || "(No title)"}</Text>
                        {pos.height > 32 && <Text fontSize="xs" color="whiteAlpha.800">{formatTime12(evt.startTime)}{evt.endTime ? ` – ${formatTime12(evt.endTime)}` : ""}</Text>}
                      </Box>
                    );
                  })}
                  {isToday && (
                    <Box position="absolute" top={`${nowTop}px`} left={0} right={0} zIndex={2} pointerEvents="none">
                      <Flex align="center"><Box w="8px" h="8px" borderRadius="full" bg="red.400" ml="-4px" /><Box flex={1} h="2px" bg="red.400" /></Flex>
                    </Box>
                  )}
                </Box>
              </Flex>
            </Box>
          </Flex>
        );
      })()}

      {/* ---------- YEAR VIEW ---------- */}
      {viewMode === "year" && (
        <Box flex={1} overflow="auto" py={2}>
          <Box display="grid" gridTemplateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" }} gap={6}>
            {yearMonths.map(({ month, cells, label }) => (
              <Box
                key={month}
                p={3}
                border="1px solid"
                borderColor="border"
                borderRadius="8px"
                cursor="pointer"
                _hover={{ bg: "bg.hover" }}
                transition="background 0.1s"
                onClick={() => { setViewDate(new Date(viewYear, month, 1)); setViewMode("month"); }}
              >
                <Text fontSize="sm" fontWeight="600" color="text" mb={2}>{label}</Text>
                {/* Mini day headers */}
                <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" mb={1}>
                  {DAY_LABELS_SHORT.map((d, i) => (
                    <Text key={i} fontSize="xs" color="text.tertiary" textAlign="center">{d}</Text>
                  ))}
                </Box>
                {/* Mini calendar grid */}
                <Box display="grid" gridTemplateColumns="repeat(7, 1fr)">
                  {cells.map((day, i) => {
                    if (day === null) return <Box key={`e-${i}`} />;
                    const dk = dateKey(viewYear, month, day);
                    const hasEvents = !!(eventsByDate[dk] && eventsByDate[dk].length > 0);
                    const isToday = dk === today;
                    return (
                      <Flex key={i} justify="center" align="center" h="22px">
                        <Flex
                          w="18px" h="18px" borderRadius="full" align="center" justify="center"
                          bg={isToday ? "primary" : "transparent"}
                        >
                          <Text fontSize="xs" color={isToday ? "white" : hasEvents ? "primary" : "text.tertiary"} fontWeight={hasEvents || isToday ? "600" : "400"}>
                            {day}
                          </Text>
                        </Flex>
                      </Flex>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* ===== EVENT DETAIL MODAL ===== */}
      <Modal isOpen={isDetailOpen} onClose={handleCloseDetail} size="xl" scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.600" />
        <ModalContent
          borderRadius={{ base: "0", md: "12px" }} mx={{ base: 0, md: 4 }}
          maxH={{ base: "100%", md: "85vh" }} minH={{ base: "100%", md: "auto" }}
          my={{ base: 0, md: "60px" }} bg="background"
        >
          <ModalCloseButton color="text.tertiary" zIndex={2} />
          <ModalBody pt={6} pb={8} px={{ base: 5, md: 8 }}>
            {modalEvent && (
              <>
                {/* Title */}
                <Box mb={5}>
                  <Input
                    ref={titleRef}
                    value={isCreating ? (draftEvent?.title || "") : draftTitle}
                    onChange={handleTitleChange}
                    placeholder={isCreating ? "New event" : "Untitled event"}
                    variant="unstyled"
                    fontSize={{ base: "xl", md: "2xl" }}
                    fontWeight="700" color="text" letterSpacing="-0.02em"
                    _placeholder={{ color: "text.tertiary" }} py={0}
                  />
                </Box>

                {/* Properties */}
                <VStack align="stretch" spacing={3} mb={5}>
                  {/* Date */}
                  <Flex align="center" gap={3}>
                    <HStack spacing={1.5} w="90px" flexShrink={0}><Icon as={FiCalendar} boxSize="13px" color="text.tertiary" /><Text fontSize="xs" color="text.tertiary" fontWeight="500">Date</Text></HStack>
                    <Input type="date" value={modalEvent.date} onChange={(e) => handleFieldChange("date", e.target.value)} size="xs" variant="flushed" fontSize="xs" color="text.secondary" w="auto" minW="130px" borderColor="border" _focus={{ borderColor: "primary" }} />
                  </Flex>
                  {/* All Day */}
                  <Flex align="center" gap={3}>
                    <HStack spacing={1.5} w="90px" flexShrink={0}><Icon as={FiClock} boxSize="13px" color="text.tertiary" /><Text fontSize="xs" color="text.tertiary" fontWeight="500">All Day</Text></HStack>
                    <Switch size="sm" isChecked={modalEvent.allDay} onChange={(e) => handleFieldChange("allDay", e.target.checked)} colorScheme="green" />
                  </Flex>
                  {/* Time inputs */}
                  {!modalEvent.allDay && (
                    <>
                      <Flex align="center" gap={3}>
                        <HStack spacing={1.5} w="90px" flexShrink={0}><Box w="13px" /><Text fontSize="xs" color="text.tertiary" fontWeight="500">Start</Text></HStack>
                        <Input type="time" value={modalEvent.startTime} onChange={(e) => handleFieldChange("startTime", e.target.value)} size="xs" variant="flushed" fontSize="xs" color="text.secondary" w="auto" minW="100px" borderColor="border" _focus={{ borderColor: "primary" }} />
                        {modalEvent.startTime && <IconButton icon={<FiX />} size="xs" variant="ghost" color="text.tertiary" _hover={{ color: "text" }} aria-label="Clear" minW="20px" h="20px" onClick={() => handleFieldChange("startTime", "")} />}
                      </Flex>
                      <Flex align="center" gap={3}>
                        <HStack spacing={1.5} w="90px" flexShrink={0}><Box w="13px" /><Text fontSize="xs" color="text.tertiary" fontWeight="500">End</Text></HStack>
                        <Input type="time" value={modalEvent.endTime} onChange={(e) => handleFieldChange("endTime", e.target.value)} size="xs" variant="flushed" fontSize="xs" color="text.secondary" w="auto" minW="100px" borderColor="border" _focus={{ borderColor: "primary" }} />
                        {modalEvent.endTime && <IconButton icon={<FiX />} size="xs" variant="ghost" color="text.tertiary" _hover={{ color: "text" }} aria-label="Clear" minW="20px" h="20px" onClick={() => handleFieldChange("endTime", "")} />}
                      </Flex>
                    </>
                  )}
                  {/* Category */}
                  <Flex align="center" gap={3}>
                    <HStack spacing={1.5} w="90px" flexShrink={0}><Icon as={FiTag} boxSize="13px" color="text.tertiary" /><Text fontSize="xs" color="text.tertiary" fontWeight="500">Category</Text></HStack>
                    <Popover isOpen={isCatOpen} onOpen={() => { setCategorySearch(""); onCatOpen(); }} onClose={onCatClose} placement="bottom-start" isLazy>
                      <PopoverTrigger>
                        <Button size="xs" variant="ghost" bg="bg.surface" border="1px solid" borderColor="border" color={modalEvent.category ? "text.secondary" : "text.tertiary"} borderRadius="4px" fontWeight="500" fontSize="xs" px={2} h="28px" _hover={{ bg: "bg.hover" }}>
                          {modalEvent.category || "None"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent w="220px" bg="background" borderColor="border" borderRadius="8px" shadow="0 8px 24px rgba(0,0,0,0.15)" _focus={{ outline: "none" }}>
                        <PopoverBody p={2}>
                          <Input placeholder="Search or create..." size="xs" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} mb={2} borderRadius="4px" fontSize="xs" autoFocus />
                          <VStack align="stretch" spacing={0} maxH="200px" overflowY="auto">
                            <Flex px={2} py={1.5} cursor="pointer" borderRadius="4px" _hover={{ bg: "bg.hover" }} align="center" justify="space-between" onClick={() => assignCategory("")}>
                              <Text fontSize="xs" color="text.tertiary" fontStyle="italic">None</Text>
                              {!modalEvent.category && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                            </Flex>
                            {filteredCategoryOptions.map((cat) => (
                              <Flex key={cat} px={2} py={1.5} cursor="pointer" borderRadius="4px" _hover={{ bg: "bg.hover" }} align="center" justify="space-between" onClick={() => assignCategory(cat)}>
                                <Text fontSize="xs" color="text" noOfLines={1}>{cat}</Text>
                                {modalEvent.category === cat && <Icon as={FiCheck} boxSize="12px" color="primary" />}
                              </Flex>
                            ))}
                            {showCreateOption && (
                              <Flex px={2} py={1.5} cursor="pointer" borderRadius="4px" _hover={{ bg: "bg.hover" }} align="center" onClick={() => assignCategory(categorySearchTrimmed)}>
                                <Icon as={FiPlus} boxSize="10px" color="primary" mr={1.5} />
                                <Text fontSize="xs" color="primary">Create &ldquo;{categorySearchTrimmed}&rdquo;</Text>
                              </Flex>
                            )}
                          </VStack>
                        </PopoverBody>
                      </PopoverContent>
                    </Popover>
                  </Flex>
                  {/* Color */}
                  <Flex align="center" gap={3}>
                    <HStack spacing={1.5} w="90px" flexShrink={0}><Box w="13px" h="13px" borderRadius="full" bg={getColorHex(modalEvent.color)} /><Text fontSize="xs" color="text.tertiary" fontWeight="500">Color</Text></HStack>
                    <HStack spacing={2}>
                      {COLOR_PRESETS.map((c) => (
                        <Box key={c.value} as="button" w="20px" h="20px" borderRadius="full" bg={c.hex} border="2px solid" borderColor={modalEvent.color === c.value ? "text" : "transparent"} _hover={{ transform: "scale(1.15)" }} transition="all 0.12s ease" onClick={() => handleFieldChange("color", c.value)} />
                      ))}
                    </HStack>
                  </Flex>
                  {/* Recurring */}
                  <Flex align="center" gap={3} flexWrap="wrap">
                    <HStack spacing={1.5} w="90px" flexShrink={0}><Icon as={FiRepeat} boxSize="13px" color="text.tertiary" /><Text fontSize="xs" color="text.tertiary" fontWeight="500">Recurring</Text></HStack>
                    <Select
                      value={modalEvent.recurring || "none"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          const existingRule = modalEvent.recurrenceRule;
                          setCustomRecDraft({
                            startDate: existingRule?.startDate || modalEvent.date,
                            every: existingRule?.every || 1,
                            unit: existingRule?.unit || "week",
                            endDate: existingRule?.endDate || "",
                          });
                          onCustomRecOpen();
                        } else {
                          handleFieldChange("recurring", val);
                          handleFieldChange("recurrenceRule", null);
                        }
                      }}
                      size="xs" variant="flushed" fontSize="xs" color="text.secondary" w="auto" minW="130px" borderColor="border" _focus={{ borderColor: "primary" }}
                    >
                      {RECURRING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                    {modalEvent.recurring === "custom" && modalEvent.recurrenceRule && (
                      <Text fontSize="xs" color="text.tertiary" fontStyle="italic" w="100%" pl="90px">
                        {getRecurrenceSummary(modalEvent.recurrenceRule)}
                      </Text>
                    )}
                  </Flex>
                  {/* Location */}
                  <Flex align="center" gap={3}>
                    <HStack spacing={1.5} w="90px" flexShrink={0}><Icon as={FiMapPin} boxSize="13px" color="text.tertiary" /><Text fontSize="xs" color="text.tertiary" fontWeight="500">Location</Text></HStack>
                    <Input value={modalEvent.location || ""} onChange={(e) => handleFieldChange("location", e.target.value)} placeholder="Add location..." size="xs" variant="flushed" fontSize="xs" color="text.secondary" borderColor="border" _focus={{ borderColor: "primary" }} _placeholder={{ color: "text.tertiary" }} />
                  </Flex>
                </VStack>

                <Box h="1px" bg="border" my={5} />

                {/* Description */}
                <Box mb={5}>
                  <HStack spacing={2} mb={3}>
                    <Icon as={FiAlignLeft} boxSize="14px" color="text.secondary" />
                    <Text fontSize="sm" fontWeight="600" color="text.secondary">Description</Text>
                  </HStack>
                  <Textarea
                    value={isCreating ? (draftEvent?.description || "") : draftDescription}
                    onChange={handleDescriptionChange}
                    placeholder="Add a description..." fontSize="sm" color="text"
                    bg="bg.surface" border="1px solid" borderColor="border" borderRadius="8px"
                    _placeholder={{ color: "text.tertiary" }} _focus={{ borderColor: "primary", bg: "background" }}
                    rows={4} resize="vertical" lineHeight="1.6"
                  />
                </Box>

                <Box h="1px" bg="border" my={5} />

                {/* Footer */}
                {isCreating ? (
                  <Flex justify="flex-end" gap={3}>
                    <Button size="sm" variant="ghost" color="text.secondary" onClick={handleCloseDetail}>Cancel</Button>
                    <Button size="sm" bg="primary" color="white" _hover={{ bg: "#5a6656" }} borderRadius="6px" fontWeight="500" onClick={handleCreateConfirm}>Create</Button>
                  </Flex>
                ) : (
                  <VStack align="stretch" spacing={3}>
                    <HStack spacing={2}>
                      {!activeEvent?.linkedTodoId ? (
                        <Button
                          size="xs" variant="ghost" color="text.secondary"
                          leftIcon={<Icon as={FiCheckSquare} boxSize="12px" />}
                          fontWeight="400" fontSize="xs" borderRadius="6px"
                          border="1px solid" borderColor="border"
                          _hover={{ bg: "bg.hover" }}
                          onClick={() => {
                            createTodoFromEvent(user.uid, activeEvent).then((newTodo) => {
                              setEvents((prev) => prev.map((e) => e.id === activeEvent.id ? { ...e, linkedTodoId: newTodo.id } : e));
                            });
                          }}
                        >
                          Create Todo
                        </Button>
                      ) : (
                        <Button
                          size="xs" variant="ghost" color="primary"
                          leftIcon={<Icon as={FiCheckSquare} boxSize="12px" />}
                          fontWeight="500" fontSize="xs" borderRadius="6px"
                          _hover={{ bg: "bg.hover" }}
                          onClick={() => navigate(`/todo?id=${activeEvent.linkedTodoId}`)}
                        >
                          View Todo
                        </Button>
                      )}
                    </HStack>
                    <Flex align="center" justify="space-between" flexWrap="wrap" gap={2}>
                      <Text fontSize="xs" color="text.tertiary">
                        Created {formatFullDate(activeEvent?.createdAt?.split("T")[0])}
                        {activeEvent?.updatedAt !== activeEvent?.createdAt && ` · Updated ${formatFullDate(activeEvent?.updatedAt?.split("T")[0])}`}
                      </Text>
                      <Button size="xs" variant="ghost" color="text.tertiary" leftIcon={<Icon as={FiTrash2} boxSize="12px" />} fontWeight="400" fontSize="xs" _hover={{ color: "red.400", bg: "bg.hover" }} onClick={() => handleRequestDelete(activeEvent)}>
                        Delete event
                      </Button>
                    </Flex>
                  </VStack>
                )}
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* ===== CONTEXT MENU ===== */}
      {contextMenu && (
        <Box
          position="fixed" left={`${contextMenu.x}px`} top={`${contextMenu.y}px`}
          zIndex={9999} bg="background" border="1px solid" borderColor="border"
          borderRadius="8px" shadow="0 8px 24px rgba(0,0,0,0.15)" py={1} minW="120px"
          onClick={(e) => e.stopPropagation()}
        >
          <Box px={3} py={2} cursor="pointer" _hover={{ bg: "bg.hover" }} transition="background 0.1s" onClick={() => { handleEditEvent(contextMenu.item); setContextMenu(null); }}>
            <Text fontSize="xs" color="text">Open</Text>
          </Box>
          <Box h="1px" bg="border" mx={2} />
          <Box px={3} py={2} cursor="pointer" _hover={{ bg: "bg.hover" }} transition="background 0.1s" onClick={() => { handleRequestDelete(contextMenu.item); setContextMenu(null); }}>
            <Text fontSize="xs" color="red.400">Delete</Text>
          </Box>
        </Box>
      )}

      {/* ===== DELETE DIALOG ===== */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="12px" mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="600" color="text">Delete Event</AlertDialogHeader>
            <AlertDialogBody color="text.secondary">
              Are you sure you want to delete &ldquo;{eventToDelete?.title || "Untitled"}&rdquo;? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* ===== CUSTOM RECURRENCE MODAL ===== */}
      <Modal isOpen={isCustomRecOpen} onClose={onCustomRecClose} size="md" isCentered>
        <ModalOverlay bg="blackAlpha.600" />
        <ModalContent borderRadius="12px" mx={4} bg="background">
          <ModalCloseButton color="text.tertiary" />
          <ModalBody pt={6} pb={6} px={6}>
            <Text fontSize="md" fontWeight="600" color="text" mb={4}>Custom Recurrence</Text>
            <VStack align="stretch" spacing={4}>
              {/* Start date */}
              <Flex align="center" gap={3}>
                <Text fontSize="xs" color="text.tertiary" fontWeight="500" w="80px" flexShrink={0}>Start</Text>
                <Input
                  type="date"
                  value={customRecDraft.startDate}
                  onChange={(e) => setCustomRecDraft((d) => ({ ...d, startDate: e.target.value }))}
                  size="sm" fontSize="xs" color="text.secondary"
                  borderColor="border" borderRadius="6px" _focus={{ borderColor: "primary" }}
                />
              </Flex>
              {/* Repeat every */}
              <Flex align="center" gap={3}>
                <Text fontSize="xs" color="text.tertiary" fontWeight="500" w="80px" flexShrink={0}>Repeat every</Text>
                <NumberInput
                  value={customRecDraft.every}
                  onChange={(_, val) => setCustomRecDraft((d) => ({ ...d, every: Math.max(1, val || 1) }))}
                  min={1} max={999} size="sm" w="80px"
                >
                  <NumberInputField fontSize="xs" borderColor="border" borderRadius="6px" _focus={{ borderColor: "primary" }} />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Select
                  value={customRecDraft.unit}
                  onChange={(e) => setCustomRecDraft((d) => ({ ...d, unit: e.target.value }))}
                  size="sm" fontSize="xs" color="text.secondary" w="120px"
                  borderColor="border" borderRadius="6px" _focus={{ borderColor: "primary" }}
                >
                  {RECURRENCE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {customRecDraft.every === 1 ? u.label : u.labelPlural}
                    </option>
                  ))}
                </Select>
              </Flex>
              {/* End date */}
              <Flex align="center" gap={3}>
                <Text fontSize="xs" color="text.tertiary" fontWeight="500" w="80px" flexShrink={0}>End</Text>
                <Input
                  type="date"
                  value={customRecDraft.endDate}
                  onChange={(e) => setCustomRecDraft((d) => ({ ...d, endDate: e.target.value }))}
                  size="sm" fontSize="xs" color="text.secondary"
                  borderColor="border" borderRadius="6px" _focus={{ borderColor: "primary" }}
                  placeholder="Never"
                />
                {customRecDraft.endDate && (
                  <IconButton
                    icon={<FiX />} size="xs" variant="ghost" color="text.tertiary"
                    _hover={{ color: "text" }} aria-label="Clear end date"
                    onClick={() => setCustomRecDraft((d) => ({ ...d, endDate: "" }))}
                  />
                )}
              </Flex>
              {/* Summary */}
              <Box bg="bg.surface" border="1px solid" borderColor="border" borderRadius="6px" px={3} py={2}>
                <Text fontSize="xs" color="text.secondary" fontStyle="italic">
                  {getRecurrenceSummary(customRecDraft)}
                </Text>
              </Box>
            </VStack>
            {/* Actions */}
            <Flex justify="flex-end" gap={3} mt={5}>
              <Button size="sm" variant="ghost" color="text.secondary" onClick={onCustomRecClose}>Cancel</Button>
              <Button
                size="sm" bg="primary" color="white" _hover={{ bg: "#5a6656" }} borderRadius="6px" fontWeight="500"
                onClick={() => {
                  handleFieldChange("recurring", "custom");
                  handleFieldChange("recurrenceRule", {
                    every: customRecDraft.every,
                    unit: customRecDraft.unit,
                    startDate: customRecDraft.startDate,
                    endDate: customRecDraft.endDate || null,
                  });
                  onCustomRecClose();
                }}
              >
                Save
              </Button>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default CalendarPage;
