/**
 * Job Clipper — Background Service Worker (Manifest V3)
 * Manages persistent chrome.storage.local defaults and REAL deadline reminders
 * using chrome.alarms and chrome.notifications.
 */
'use strict';

const ALARM_PREFIX = 'job-reminder:';

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  defaultReminderDaysBefore: 1 // 0 = morning of deadline, 1 = 1 day before, etc.
};

async function ensureDefaults() {
  const data = await chrome.storage.local.get(['jobs', 'settings', 'notifiedKeys']);
  const toSet = {};
  if (!Array.isArray(data.jobs)) toSet.jobs = [];
  if (!data.settings) toSet.settings = DEFAULT_SETTINGS;
  if (!data.notifiedKeys || typeof data.notifiedKeys !== 'object') toSet.notifiedKeys = {};
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }
}

/**
 * Compute reminder timestamp (9:00 AM local time on (deadline - daysBefore)).
 * Returns { status: 'scheduled'|'immediate'|'expired'|'none', whenMs?: number, alarmKey?: string }
 */
function computeReminderSchedule(job, defaultDaysBefore) {
  if (!job || !job.deadline) return { status: 'none' };

  const parts = String(job.deadline).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return { status: 'none' };
  }

  const [year, month, day] = parts;
  // End of deadline day (23:59:59 local) to check if deadline itself is expired
  const deadlineEnd = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  const now = Date.now();
  if (now > deadlineEnd) {
    return { status: 'expired' };
  }

  const daysBefore =
    job.reminderDaysBefore !== undefined && job.reminderDaysBefore !== null && job.reminderDaysBefore !== ''
      ? Number(job.reminderDaysBefore)
      : Number(defaultDaysBefore ?? 1);

  if (daysBefore < 0) return { status: 'none' };

  const targetDate = new Date(year, month - 1, day - daysBefore, 9, 0, 0, 0);
  const targetMs = targetDate.getTime();
  const alarmKey = `${job.deadline}:${daysBefore}`;

  if (targetMs > now) {
    return { status: 'scheduled', whenMs: targetMs, alarmKey };
  }

  // Reminder window already started, but deadline is still active today/future
  return { status: 'immediate', whenMs: now + 60 * 1000, alarmKey };
}

async function syncAllReminders() {
  const data = await chrome.storage.local.get(['jobs', 'settings', 'notifiedKeys']);
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
  const notifiedKeys = data.notifiedKeys || {};

  // Clear all existing job-reminder alarms first to prevent duplicates or stale schedules
  const existingAlarms = await chrome.alarms.getAll();
  for (const alarm of existingAlarms) {
    if (alarm.name.startsWith(ALARM_PREFIX)) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  if (!settings.notificationsEnabled) return;

  for (const job of jobs) {
    if (job.status === 'RESULT') continue; // Completed applications don't need reminders
    const sched = computeReminderSchedule(job, settings.defaultReminderDaysBefore);
    if (sched.status === 'scheduled' || sched.status === 'immediate') {
      if (notifiedKeys[job.id] === sched.alarmKey) {
        continue; // Already notified for this exact deadline + lead time
      }
      await chrome.alarms.create(ALARM_PREFIX + job.id, {
        when: sched.whenMs
      });
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await syncAllReminders();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await syncAllReminders();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.jobs || changes.settings)) {
    syncAllReminders();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm || !alarm.name.startsWith(ALARM_PREFIX)) return;
  const jobId = alarm.name.slice(ALARM_PREFIX.length);

  const data = await chrome.storage.local.get(['jobs', 'settings', 'notifiedKeys']);
  const settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
  if (!settings.notificationsEnabled) return;

  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const job = jobs.find((j) => j.id === jobId);
  if (!job || !job.deadline) return;

  const sched = computeReminderSchedule(job, settings.defaultReminderDaysBefore);
  if (sched.status === 'expired' || sched.status === 'none') return;

  const notifiedKeys = data.notifiedKeys || {};
  if (notifiedKeys[job.id] === sched.alarmKey) return;

  notifiedKeys[job.id] = sched.alarmKey;
  await chrome.storage.local.set({ notifiedKeys });

  chrome.notifications.create('notif-' + job.id + '-' + Date.now(), {
    type: 'basic',
    iconUrl: 'assets/icons/icon128.png',
    title: `Deadline Reminder: ${job.title}`,
    message: `${job.company} • Application deadline: ${job.deadline}`,
    priority: 2
  });
});

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'SYNC_REMINDERS') {
    syncAllReminders()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  return false;
});
