import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

// ── helpers ──────────────────────────────────────────────

function userDoc(uid, docName) {
  return doc(db, "users", uid, "data", docName);
}

async function readArray(uid, docName) {
  const snap = await getDoc(userDoc(uid, docName));
  if (snap.exists()) {
    const data = snap.data();
    return Array.isArray(data.items) ? data.items : [];
  }
  return [];
}

async function writeArray(uid, docName, items) {
  await setDoc(userDoc(uid, docName), { items }, { merge: true });
}

async function readObj(uid, docName) {
  const snap = await getDoc(userDoc(uid, docName));
  return snap.exists() ? snap.data() : {};
}

async function writeObj(uid, docName, data) {
  await setDoc(userDoc(uid, docName), data, { merge: true });
}

// ── Todos ────────────────────────────────────────────────

export const loadTodos = (uid) => readArray(uid, "todos");
export const saveTodos = (uid, todos) => writeArray(uid, "todos", todos);

// ── Events (Calendar) ───────────────────────────────────

export const loadEvents = (uid) => readArray(uid, "events");
export const saveEvents = (uid, events) => writeArray(uid, "events", events);

// ── Notes ────────────────────────────────────────────────

export const loadNotes = (uid) => readArray(uid, "notes");
export const saveNotes = (uid, notes) => writeArray(uid, "notes", notes);

// ── Bookmarks ────────────────────────────────────────────

export const loadBookmarks = (uid) => readArray(uid, "bookmarks");
export const saveBookmarks = (uid, bookmarks) => writeArray(uid, "bookmarks", bookmarks);

// ── Categories ───────────────────────────────────────────

export async function loadCategories(uid, type) {
  const data = await readObj(uid, "categories");
  return Array.isArray(data[type]) ? data[type] : [];
}

export async function saveCategories(uid, type, categories) {
  await writeObj(uid, "categories", { [type]: categories });
}

// ── Settings (widget order, user name, etc.) ─────────────

export async function loadSettings(uid) {
  return readObj(uid, "settings");
}

export async function saveSettings(uid, settings) {
  await writeObj(uid, "settings", settings);
}

// ── One-time migration from localStorage → Firestore ────

export async function migrateLocalStorageToFirestore(uid) {
  // Only migrate if user has local data AND Firestore is empty
  const existing = await getDoc(userDoc(uid, "todos"));
  if (existing.exists()) return; // already has cloud data, skip

  const promises = [];

  const tryParse = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return null;
  };

  const todos = tryParse("nudge-todos");
  if (todos) promises.push(saveTodos(uid, todos));

  const events = tryParse("nudge-calendar");
  if (events) promises.push(saveEvents(uid, events));

  const notes = tryParse("nudge-notes");
  if (notes) promises.push(saveNotes(uid, notes));

  const bookmarks = tryParse("nudge-bookmarks");
  if (bookmarks) promises.push(saveBookmarks(uid, bookmarks));

  // Categories
  const todoCategories = tryParse("nudge-todo-categories");
  const noteCategories = tryParse("nudge-categories");
  const calendarCategories = tryParse("nudge-calendar-categories");
  if (todoCategories || noteCategories || calendarCategories) {
    const cats = {};
    if (todoCategories) cats.todo = todoCategories;
    if (noteCategories) cats.note = noteCategories;
    if (calendarCategories) cats.calendar = calendarCategories;
    promises.push(writeObj(uid, "categories", cats));
  }

  // Settings
  const settings = {};
  const userName = localStorage.getItem("nudge-user-name");
  if (userName) settings.userName = userName;

  const tryParseWidgetOrder = tryParse("nudge-widget-order");
  if (tryParseWidgetOrder) settings.widgetOrder = tryParseWidgetOrder;

  if (Object.keys(settings).length > 0) {
    promises.push(saveSettings(uid, settings));
  }

  await Promise.all(promises);
}
