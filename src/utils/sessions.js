import { sanitizeFreeText, sanitizeUrl, safeJsonParse } from "./sanitization";

const STORAGE_KEY = "tabsense_sessions_v1";

/**
 * Session shape:
 * {
 *   id: string (timestamp-based),
 *   name: string,
 *   createdAt: number,
 *   tabs: Array<{ url: string, title: string, purpose: string }>
 * }
 * Only http(s) URLs are stored so restore can open them safely.
 */

export async function loadSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const raw = result?.[STORAGE_KEY];
      if (!raw) {
        resolve([]);
        return;
      }
      const parsed = typeof raw === "string" ? safeJsonParse(raw, []) : raw;
      if (!Array.isArray(parsed)) {
        resolve([]);
        return;
      }
      const out = [];
      for (const s of parsed) {
        const norm = normalizeSession(s);
        if (norm) out.push(norm);
      }
      out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(out);
    });
  });
}

export async function saveSessions(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const safe = list.map(normalizeSession).filter(Boolean);
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: safe }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

export function normalizeSession(session) {
  if (!session || typeof session !== "object") return null;
  const name = sanitizeFreeText(session.name || "Unnamed session", 100);
  const createdAt =
    typeof session.createdAt === "number" ? session.createdAt : Date.now();
  const id =
    typeof session.id === "string" && session.id
      ? session.id
      : `session_${createdAt}`;
  const rawTabs = Array.isArray(session.tabs) ? session.tabs : [];
  const tabs = [];
  for (const t of rawTabs) {
    const url = sanitizeUrl(t?.url || "");
    if (!url || !url.startsWith("http")) continue;
    tabs.push({
      url,
      title: sanitizeFreeText(t.title || "", 300),
      purpose: sanitizeFreeText(t.purpose || "", 500)
    });
  }
  return { id, name, createdAt, tabs };
}
