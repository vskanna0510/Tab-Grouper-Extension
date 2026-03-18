import { loadTabIntents, saveTabIntents, normalizeTabRecord } from "../utils/storage";
import { MESSAGE_TYPES, isValidMessage, validateMarkDonePayload, validateUpdatePurposePayload } from "../utils/messaging";
import { sanitizeFreeText } from "../utils/sanitization";
import { REMINDER_INTERVAL_MINUTES } from "../utils/config";
import { guessPurposeFromTab } from "../utils/aiCategorizer";

// Alarm / notification configuration with basic rate limiting.
// The cooldown helps prevent notification spam and abuse.
const REMINDER_ALARM_NAME = "tabsense_reminder_alarm";
const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;
let lastNotificationAt = 0;

// In-memory cache of tab intents for quick access; source of truth is chrome.storage.local.
let tabIntentsCache = {};

async function init() {
  tabIntentsCache = await loadTabIntents();

  chrome.alarms.get(REMINDER_ALARM_NAME, (existing) => {
    if (!existing) {
      chrome.alarms.create(REMINDER_ALARM_NAME, {
        periodInMinutes: REMINDER_INTERVAL_MINUTES
      });
    }
  });
}

init();

chrome.runtime.onInstalled.addListener(() => {
  init();
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab || typeof tab.id !== "number") return;

  const now = Date.now();
  const record = normalizeTabRecord(tab.id, {
    tabId: tab.id,
    title: tab.title || "",
    url: tab.url || "",
    createdAt: now,
    lastAccessed: now,
    // Best-effort local, non-networked "AI" guess so we never
    // call external services from here by default.
    purpose: guessPurposeFromTab(tab.title || "", tab.url || ""),
    status: "open"
  });

  if (!record) return;

  tabIntentsCache[String(tab.id)] = record;
  await saveTabIntents(tabIntentsCache);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab || typeof tabId !== "number") return;
  const key = String(tabId);
  const existing = tabIntentsCache[key];

  if (!existing && !changeInfo.url && !changeInfo.title) {
    return;
  }

  const updated = normalizeTabRecord(tabId, {
    ...(existing || {}),
    tabId,
    title: changeInfo.title || tab.title || existing?.title || "",
    url: changeInfo.url || tab.url || existing?.url || "",
    // Only overwrite purpose when we don't already have a user-provided one.
    purpose:
      existing?.purpose ||
      guessPurposeFromTab(
        changeInfo.title || tab.title || existing?.title || "",
        changeInfo.url || tab.url || existing?.url || ""
      ),
    lastAccessed: Date.now()
  });

  if (!updated) return;

  tabIntentsCache[key] = updated;
  await saveTabIntents(tabIntentsCache);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tabId = activeInfo?.tabId;
  if (typeof tabId !== "number") return;
  const key = String(tabId);
  const existing = tabIntentsCache[key];
  if (!existing) return;

  existing.lastAccessed = Date.now();
  tabIntentsCache[key] = existing;
  await saveTabIntents(tabIntentsCache);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const key = String(tabId);
  if (!tabIntentsCache[key]) return;

  delete tabIntentsCache[key];
  await saveTabIntents(tabIntentsCache);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== REMINDER_ALARM_NAME) return;

  const now = Date.now();
  if (now - lastNotificationAt < NOTIFICATION_COOLDOWN_MS) {
    return;
  }

  tabIntentsCache = await loadTabIntents();
  const unfinished = Object.values(tabIntentsCache).filter(
    (t) => t.status === "open" && sanitizeFreeText(t.purpose).length > 0
  );

  if (unfinished.length === 0) return;

  lastNotificationAt = now;

  const count = unfinished.length;
  const options = {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "TabSense reminder",
    message: `You have ${count} unfinished tab${count > 1 ? "s" : ""}. Open TabSense to review them.`,
    priority: 0
  };

  chrome.notifications.create("", options);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!isValidMessage(request)) {
    return;
  }

  const { type, payload } = request;

  if (type === MESSAGE_TYPES.GET_STATE) {
    (async () => {
      tabIntentsCache = await loadTabIntents();
      sendResponse({ ok: true, data: tabIntentsCache });
    })();
    return true;
  }

  if (type === MESSAGE_TYPES.UPDATE_PURPOSE) {
    const valid = validateUpdatePurposePayload(payload);
    if (!valid) {
      sendResponse({ ok: false, error: "Invalid payload" });
      return;
    }

    (async () => {
      const { tabId, purpose } = valid;
      const key = String(tabId);
      const existing = tabIntentsCache[key] || {
        tabId,
        title: "",
        url: "",
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        purpose: "",
        status: "open"
      };

      const sanitizedPurpose = sanitizeFreeText(purpose);

      const updated = normalizeTabRecord(key, {
        ...existing,
        purpose: sanitizedPurpose,
        lastAccessed: Date.now()
      });

      if (!updated) {
        sendResponse({ ok: false, error: "Unable to normalize record" });
        return;
      }

      tabIntentsCache[key] = updated;
      await saveTabIntents(tabIntentsCache);
      sendResponse({ ok: true, data: updated });
    })();
    return true;
  }

  if (type === MESSAGE_TYPES.MARK_DONE) {
    const valid = validateMarkDonePayload(payload);
    if (!valid) {
      sendResponse({ ok: false, error: "Invalid payload" });
      return;
    }

    (async () => {
      const { tabId } = valid;
      const key = String(tabId);
      const existing = tabIntentsCache[key];
      if (!existing) {
        sendResponse({ ok: false, error: "Unknown tab" });
        return;
      }
      const updated = {
        ...existing,
        status: "done",
        lastAccessed: Date.now()
      };
      tabIntentsCache[key] = updated;
      await saveTabIntents(tabIntentsCache);
      sendResponse({ ok: true, data: updated });
    })();
    return true;
  }

  if (type === MESSAGE_TYPES.CLEAR_ALL) {
    (async () => {
      tabIntentsCache = {};
      await saveTabIntents(tabIntentsCache);
      sendResponse({ ok: true });
    })();
    return true;
  }
});

