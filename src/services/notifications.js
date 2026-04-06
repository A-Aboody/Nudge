// ── App badge ────────────────────────────────────────────

export function updateAppBadge(count) {
  if (!("setAppBadge" in navigator)) return;
  if (count > 0) {
    navigator.setAppBadge(count);
  } else {
    navigator.clearAppBadge();
  }
}

// ── Notification permission ──────────────────────────────

export function getNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "default", "granted", "denied"
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

// ── Show a notification ──────────────────────────────────

export function showNotification(title, options = {}) {
  if (Notification.permission !== "granted") return;

  const defaults = {
    icon: "/nudge-icon-192.png",
    badge: "/nudge-icon-192.png",
    tag: options.tag || "nudge-notification",
    ...options,
  };

  // Use service worker if available (works when tab is backgrounded)
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, defaults);
    });
  } else {
    new Notification(title, defaults);
  }
}

// ── Client-side reminder scheduler ───────────────────────
// Schedules setTimeout-based reminders for todos/events due soon.
// Only fires while the app tab is open. Recalculated on each app open.

const scheduledTimers = new Map();

export function clearAllScheduledReminders() {
  scheduledTimers.forEach((timerId) => clearTimeout(timerId));
  scheduledTimers.clear();
}

function scheduleReminder({ id, title, body, fireAt }) {
  if (scheduledTimers.has(id)) {
    clearTimeout(scheduledTimers.get(id));
  }

  const delay = fireAt - Date.now();

  // Only schedule if in the future and within 24 hours
  if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
    const timerId = setTimeout(() => {
      showNotification(title, { body, tag: `reminder-${id}` });
      scheduledTimers.delete(id);
    }, delay);
    scheduledTimers.set(id, timerId);
  }
}

export function scheduleAllReminders(todos, events, settings) {
  clearAllScheduledReminders();
  if (!settings.pushNotifications) return;

  const [rH, rM] = (settings.reminderTime || "09:00").split(":").map(Number);
  const reminderDays = settings.reminderDays ?? 3;

  // Schedule todo reminders (remind X days before due date)
  todos.forEach((t) => {
    if (t.completed || !t.dueDate) return;

    const due = new Date(t.dueDate + "T00:00:00");
    const remind = new Date(due);
    remind.setDate(remind.getDate() - reminderDays);
    remind.setHours(rH, rM, 0, 0);

    scheduleReminder({
      id: `todo-${t.id}`,
      title: `Task due ${reminderDays === 0 ? "today" : `in ${reminderDays} day${reminderDays > 1 ? "s" : ""}`}`,
      body: t.title || "Untitled task",
      fireAt: remind.getTime(),
    });
  });

  // Schedule event reminders (remind at reminderTime on the event day)
  events.forEach((e) => {
    if (!e.date) return;

    const eventDate = new Date(e.date + "T00:00:00");
    const remind = new Date(eventDate);
    remind.setHours(rH, rM, 0, 0);

    // If event has a start time, remind 30 minutes before instead
    if (e.startTime) {
      const [eH, eM] = e.startTime.split(":").map(Number);
      remind.setHours(eH, eM, 0, 0);
      remind.setMinutes(remind.getMinutes() - 30);
    }

    scheduleReminder({
      id: `event-${e.id}`,
      title: e.startTime ? "Event starting soon" : "Event today",
      body: e.title || "Untitled event",
      fireAt: remind.getTime(),
    });
  });
}
