import { sanitizeFreeText, sanitizeUrl, safeJsonParse } from "./sanitization";

const STORAGE_KEY = "tabsense_tab_intents_v1";

/**
 * Shape:
 * {
 *   [tabId: string]: {
 *     tabId: number;
 *     title: string;
 *     url: string;
 *     createdAt: number;
 *     lastAccessed: number;
 *     purpose: string;
 *     status: "open" | "done";
 *   }
 * }
 */

export async function loadTabIntents() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const raw = result?.[STORAGE_KEY];
      if (!raw) {
        resolve({});
        return;
      }

      // Validate stored structure to guard against corruption or tampering
      const parsed = typeof raw === "string" ? safeJsonParse(raw, {}) : raw;
      if (!parsed || typeof parsed !== "object") {
        resolve({});
        return;
      }

      const sanitized = {};
      for (const [key, value] of Object.entries(parsed)) {
        const normalized = normalizeTabRecord(key, value);
        if (normalized) {
          sanitized[key] = normalized;
        }
      }

      resolve(sanitized);
    });
  });
}

export async function saveTabIntents(map) {
  const safe = {};
  for (const [key, value] of Object.entries(map || {})) {
    const normalized = normalizeTabRecord(key, value);
    if (normalized) {
      safe[key] = normalized;
    }
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        [STORAGE_KEY]: safe
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      }
    );
  });
}

export function normalizeTabRecord(key, value) {
  if (!value || typeof value !== "object") return null;

  const tabIdNum = Number(value.tabId ?? key);
  if (!Number.isFinite(tabIdNum)) return null;

  // Always store `url` as a string to keep UI rendering predictable.
  // If the URL is unavailable or blocked by sanitization, store "".
  const url = sanitizeUrl(value.url || "") || "";
  const title = sanitizeFreeText(value.title || "", 300);
  const purpose = sanitizeFreeText(value.purpose || "", 500);

  return {
    tabId: tabIdNum,
    title,
    url,
    purpose,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    lastAccessed:
      typeof value.lastAccessed === "number" ? value.lastAccessed : Date.now(),
    status: value.status === "done" ? "done" : "open"
  };
}

