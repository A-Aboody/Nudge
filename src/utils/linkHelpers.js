// Shared read/write/link helpers for cross-entity sync
// These now use Firestore via db.js, but the cross-link functions still
// operate on arrays (fetched first, then saved back).

import {
  loadEvents, saveEvents,
  loadTodos, saveTodos,
  loadNotes, saveNotes,
} from "../services/db";

// Re-export read helpers for components that just need to read
export { loadEvents as readEvents, loadTodos as readTodos, loadNotes as readNotes };

// Re-export write helpers
export { saveEvents as writeEvents, saveTodos as writeTodos, saveNotes as writeNotes };

export async function createTodoFromEvent(uid, event) {
  const now = new Date().toISOString();
  const newTodo = {
    id: Date.now(),
    title: event.title || "Untitled",
    description: event.description || "",
    dueDate: event.date || "",
    category: event.category || "",
    recurring: "none",
    completed: false,
    completedAt: "",
    linkedNoteId: null,
    linkedEventId: event.id,
    checklist: [],
    createdAt: now,
    updatedAt: now,
  };

  const todos = await loadTodos(uid);
  todos.unshift(newTodo);
  await saveTodos(uid, todos);

  const events = await loadEvents(uid);
  const updated = events.map((e) =>
    e.id === event.id ? { ...e, linkedTodoId: newTodo.id, updatedAt: now } : e
  );
  await saveEvents(uid, updated);

  return newTodo;
}

export async function createEventFromTodo(uid, todo) {
  const now = new Date().toISOString();
  const newEvent = {
    id: Date.now(),
    title: todo.title || "Untitled",
    description: todo.description || "",
    date: todo.dueDate || new Date().toISOString().split("T")[0],
    startTime: "",
    endTime: "",
    allDay: true,
    category: todo.category || "",
    color: "teal",
    recurring: "none",
    location: "",
    linkedTodoId: todo.id,
    linkedNoteId: null,
    createdAt: now,
    updatedAt: now,
  };

  const events = await loadEvents(uid);
  events.unshift(newEvent);
  await saveEvents(uid, events);

  const todos = await loadTodos(uid);
  const updated = todos.map((t) =>
    t.id === todo.id ? { ...t, linkedEventId: newEvent.id, updatedAt: now } : t
  );
  await saveTodos(uid, updated);

  return newEvent;
}

export async function linkNoteToEvent(uid, noteId, eventId) {
  const now = new Date().toISOString();

  const notes = await loadNotes(uid);
  const updatedNotes = notes.map((n) => {
    if (n.id === noteId) {
      const ids = n.linkedEventIds || [];
      if (!ids.includes(eventId)) {
        return { ...n, linkedEventIds: [...ids, eventId], updatedAt: now };
      }
    }
    return n;
  });
  await saveNotes(uid, updatedNotes);

  const events = await loadEvents(uid);
  const updatedEvents = events.map((e) =>
    e.id === eventId ? { ...e, linkedNoteId: noteId, updatedAt: now } : e
  );
  await saveEvents(uid, updatedEvents);
}

export async function linkNoteToTodo(uid, noteId, todoId) {
  const now = new Date().toISOString();

  const notes = await loadNotes(uid);
  const updatedNotes = notes.map((n) => {
    if (n.id === noteId) {
      const ids = n.linkedTodoIds || [];
      if (!ids.includes(todoId)) {
        return { ...n, linkedTodoIds: [...ids, todoId], updatedAt: now };
      }
    }
    return n;
  });
  await saveNotes(uid, updatedNotes);

  const todos = await loadTodos(uid);
  const updatedTodos = todos.map((t) =>
    t.id === todoId ? { ...t, linkedNoteId: noteId, updatedAt: now } : t
  );
  await saveTodos(uid, updatedTodos);
}
