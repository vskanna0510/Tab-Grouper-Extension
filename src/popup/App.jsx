import { useEffect, useMemo, useState } from "react";
import { MESSAGE_TYPES } from "../utils/messaging";
import { sanitizeFreeText } from "../utils/sanitization";
import { REMINDER_INTERVAL_MINUTES, STALE_TAB_HOURS } from "../utils/config";

const STATUS_ORDER = {
  open: 0,
  done: 1
};

function groupByPurpose(tabsMap) {
  const groups = new Map();
  Object.values(tabsMap || {}).forEach((record) => {
    const purpose = sanitizeFreeText(record.purpose || "Uncategorized");
    if (!groups.has(purpose)) {
      groups.set(purpose, []);
    }
    groups.get(purpose).push(record);
  });
  return groups;
}

function sortTabs(a, b) {
  const s1 = STATUS_ORDER[a.status] ?? 0;
  const s2 = STATUS_ORDER[b.status] ?? 0;
  if (s1 !== s2) return s1 - s2;
  return (b.lastAccessed || 0) - (a.lastAccessed || 0);
}

const STALE_MS = STALE_TAB_HOURS * 60 * 60 * 1000;

function isStale(tab) {
  const last = typeof tab.lastAccessed === "number" ? tab.lastAccessed : 0;
  return last > 0 && Date.now() - last >= STALE_MS;
}

function displayTitle(tab) {
  const t = sanitizeFreeText(tab.title || "", 150);
  if (t) return t;
  const u = typeof tab.url === "string" ? tab.url : "";
  try {
    const parsed = new URL(u);
    const host = parsed.host || parsed.protocol.replace(":", "");
    if (host) return host;
  } catch {
    // ignore
  }
  return `Tab #${tab.tabId}`;
}

function useTabSenseState() {
  const [loading, setLoading] = useState(true);
  const [tabsMap, setTabsMap] = useState({});
  const [error, setError] = useState(null);

  const refresh = () => {
    setLoading(true);
    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPES.GET_STATE
      },
      (response) => {
        if (!response?.ok) {
          setError(response?.error || "Failed to load data");
        } else {
          setTabsMap(response.data || {});
          setError(null);
        }
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    refresh();
  }, []);

  return { loading, tabsMap, error, refresh, setTabsMap };
}

export default function App() {
  const { loading, tabsMap, error, refresh, setTabsMap } = useTabSenseState();
  const [activeTabId, setActiveTabId] = useState(null);
  const [activePurpose, setActivePurpose] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const current = tabs?.[0];
      if (!current || typeof current.id !== "number") return;
      const key = String(current.id);
      setActiveTabId(current.id);
      const record = tabsMap[key];
      setActivePurpose(record?.purpose || "");
    });
  }, [tabsMap]);

  const groups = useMemo(() => groupByPurpose(tabsMap), [tabsMap]);

  // Unique purposes for autocomplete (excluding "Uncategorized"), most recently used first.
  const purposeSuggestions = useMemo(() => {
    const set = new Set();
    const list = [];
    Object.values(tabsMap || {})
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      .forEach((t) => {
        const p = sanitizeFreeText(t.purpose || "", 80);
        if (p && p !== "Uncategorized" && !set.has(p)) {
          set.add(p);
          list.push(p);
          if (list.length >= 8) return;
        }
      });
    return list;
  }, [tabsMap]);

  const [sessions, setSessions] = useState([]);
  const [sessionName, setSessionName] = useState("");
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionRestoring, setSessionRestoring] = useState(null);

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.GET_SESSIONS },
      (res) => {
        if (res?.ok && Array.isArray(res.data)) setSessions(res.data);
      }
    );
  }, []);

  const handleSaveSession = () => {
    const name = sanitizeFreeText(sessionName, 80).trim();
    if (!name) return;
    setSessionSaving(true);
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.SAVE_SESSION, payload: { name } },
      (res) => {
        setSessionSaving(false);
        if (!res?.ok) return;
        setSessions((prev) => [res.data, ...prev]);
        setSessionName("");
      }
    );
  };

  const handleRestoreSession = (sessionId) => {
    setSessionRestoring(sessionId);
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.RESTORE_SESSION, payload: { sessionId } },
      (res) => {
        setSessionRestoring(null);
        if (res?.ok) {
          refresh();
          window.close();
        }
      }
    );
  };

  const handleDeleteSession = (sessionId) => {
    if (!confirm("Delete this saved session?")) return;
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.DELETE_SESSION, payload: { sessionId } },
      (res) => {
        if (!res?.ok) return;
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    );
  };

  const handleSavePurpose = () => {
    if (activeTabId == null) return;
    setSaving(true);
    const sanitized = sanitizeFreeText(activePurpose);

    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPES.UPDATE_PURPOSE,
        payload: {
          tabId: activeTabId,
          purpose: sanitized
        }
      },
      (response) => {
        setSaving(false);
        if (!response?.ok) {
          return;
        }
        const updated = response.data;
        setTabsMap((prev) => ({
          ...prev,
          [String(updated.tabId)]: updated
        }));
      }
    );
  };

  const handleMarkDone = (tabId) => {
    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPES.MARK_DONE,
        payload: { tabId }
      },
      (response) => {
        if (!response?.ok) return;
        const updated = response.data;
        setTabsMap((prev) => ({
          ...prev,
          [String(updated.tabId)]: updated
        }));
      }
    );
  };

  const handleClearAll = () => {
    if (!confirm("Clear all saved tab purposes?")) return;
    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPES.CLEAR_ALL
      },
      (response) => {
        if (!response?.ok) return;
        setTabsMap({});
      }
    );
  };

  const handleGoToTab = (tabId) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return;
      if (typeof tab.windowId === "number") {
        chrome.windows.update(tab.windowId, { focused: true }, () => {
          chrome.tabs.update(tabId, { active: true }, () => window.close());
        });
      } else {
        chrome.tabs.update(tabId, { active: true }, () => window.close());
      }
    });
  };

  const [groupingPurpose, setGroupingPurpose] = useState(null);

  const handleCreateChromeGroup = (purpose, items) => {
    const tabIds = items.map((t) => t.tabId).filter((id) => Number.isFinite(id));
    if (tabIds.length === 0) return;
    setGroupingPurpose(purpose);
    chrome.windows.getCurrent((win) => {
      const windowId = win?.id;
      if (typeof windowId !== "number") {
        setGroupingPurpose(null);
        return;
      }
      chrome.tabs.query({ windowId }, (windowTabs) => {
        const existingIds = new Set((windowTabs || []).map((t) => t.id));
        const toGroup = tabIds.filter((id) => existingIds.has(id));
        if (toGroup.length === 0) {
          setGroupingPurpose(null);
          return;
        }
        chrome.tabs.group({ tabIds: toGroup, createProperties: { windowId } }, () => {
          if (chrome.runtime.lastError) {
            setGroupingPurpose(null);
            return;
          }
          chrome.tabs.get(toGroup[0], (tab) => {
            if (tab && typeof tab.groupId === "number" && tab.groupId >= 0) {
              const title = sanitizeFreeText(purpose || "Uncategorized", 50);
              chrome.tabGroups.update(tab.groupId, { title });
            }
            setGroupingPurpose(null);
          });
        });
      });
    });
  };

  return (
    <div className="w-[420px] max-h-[580px] p-4 bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">TabSense</h1>
          <p className="text-xs text-slate-400">
            Remember why you opened each tab.
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-xs px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
        >
          Refresh
        </button>
      </header>

      <section className="mb-4">
        <h2 className="text-xs font-semibold text-slate-300 mb-1">
          Current tab purpose
        </h2>
        <textarea
          value={activePurpose}
          onChange={(e) => setActivePurpose(e.target.value)}
          maxLength={500}
          className="w-full h-16 text-xs rounded border border-slate-700 bg-slate-900 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="E.g. Researching pricing for project X"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-slate-500">
            {activePurpose.length}/500
          </span>
          <button
            onClick={handleSavePurpose}
            disabled={saving || activeTabId == null}
            className="text-xs px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save purpose"}
          </button>
        </div>
        {purposeSuggestions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="text-[9px] text-slate-500 self-center">Quick add:</span>
            {purposeSuggestions.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setActivePurpose(p)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                {p.length > 20 ? p.slice(0, 18) + "…" : p}
              </button>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="mb-2 text-xs text-red-400">
          {sanitizeFreeText(error, 120)}
        </div>
      )}

      <section className="mb-2">
        <button
          type="button"
          onClick={() => setSessionsOpen((o) => !o)}
          className="text-xs font-semibold text-slate-300 hover:text-slate-200 flex items-center gap-1 mb-1"
        >
          {sessionsOpen ? "▼" : "▶"} Saved sessions
        </button>
        {sessionsOpen && (
          <div className="mb-2 p-2 rounded border border-slate-800 bg-slate-900/60 space-y-2">
            <div className="flex gap-1">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Session name"
                maxLength={80}
                className="flex-1 text-xs rounded border border-slate-700 bg-slate-900 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleSaveSession}
                disabled={sessionSaving || !sessionName.trim()}
                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-emerald-600 disabled:opacity-50"
              >
                {sessionSaving ? "…" : "Save current"}
              </button>
            </div>
            {sessions.length === 0 ? (
              <p className="text-[10px] text-slate-500">No sessions yet. Name and save your current tabs to restore later.</p>
            ) : (
              <ul className="space-y-1 max-h-24 overflow-y-auto">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="truncate text-slate-300">{s.name}</span>
                    <span className="text-slate-500 shrink-0">{s.tabs?.length || 0} tabs</span>
                    <div className="shrink-0 flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleRestoreSession(s.id)}
                        disabled={sessionRestoring === s.id}
                        className="px-1.5 py-0.5 rounded bg-sky-700 hover:bg-sky-600 text-slate-100"
                      >
                        {sessionRestoring === s.id ? "…" : "Restore"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-red-800 text-slate-300"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-300">
          Tabs grouped by purpose
        </h2>
        <button
          onClick={handleClearAll}
          className="text-[10px] text-slate-400 hover:text-red-400"
        >
          Clear all
        </button>
      </section>

      <div className="space-y-2 overflow-y-auto max-h-56 pr-1 custom-scroll">
        {loading && (
          <div className="text-xs text-slate-400">Loading tab data...</div>
        )}
        {!loading && groups.size === 0 && (
          <div className="text-xs text-slate-400">
            No tabs tracked yet. Save a purpose for your current tab to get
            started.
          </div>
        )}

        {Array.from(groups.entries()).map(([purpose, items]) => (
          <div
            key={purpose || "uncategorized"}
            className="rounded border border-slate-800 bg-slate-900/40"
          >
            <div className="px-2 py-1 border-b border-slate-800 flex items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-emerald-300 truncate min-w-0 flex-1">
                {purpose || "Uncategorized"}
              </span>
              <span className="text-[10px] text-slate-500 shrink-0">
                {items.length} tab{items.length > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => handleCreateChromeGroup(purpose || "Uncategorized", items)}
                disabled={groupingPurpose !== null || items.length === 0}
                title="Create a Chrome tab group with this name and move these tabs into it"
                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-violet-600 text-slate-300 hover:text-white shrink-0 disabled:opacity-50"
              >
                {groupingPurpose === purpose ? "…" : "Group in Chrome"}
              </button>
            </div>
            <ul className="divide-y divide-slate-800">
              {items
                .slice()
                .sort(sortTabs)
                .map((tab) => (
                  <li
                    key={tab.tabId}
                    className="px-2 py-1.5 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-[11px]">
                        <span
                          className={
                            "inline-flex px-1.5 py-0.5 rounded-full text-[9px] border " +
                            (tab.status === "done"
                              ? "border-emerald-400 text-emerald-300"
                              : "border-amber-400 text-amber-300")
                          }
                        >
                          {tab.status === "done" ? "Done" : "Open"}
                        </span>
                        {isStale(tab) && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-400" title="Not used in 24h+">
                            24h+
                          </span>
                        )}
                        {tab.tabId === activeTabId && (
                          <span className="text-[9px] text-sky-300">
                            Active
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleGoToTab(tab.tabId)}
                        className="text-left w-full"
                        title="Go to tab"
                      >
                        <p className="text-[11px] font-medium mt-0.5 truncate hover:underline">
                          {displayTitle(tab)}
                        </p>
                      </button>
                      <p className="text-[10px] text-slate-500 truncate">
                        {typeof tab.url === "string" && tab.url.length > 0
                          ? tab.url
                          : "(URL not available)"}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col gap-1">
                      <button
                        onClick={() => handleGoToTab(tab.tabId)}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-600"
                      >
                        Go to tab
                      </button>
                      {tab.status !== "done" && (
                        <button
                          onClick={() => handleMarkDone(tab.tabId)}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <footer className="mt-3 text-[9px] text-slate-500 space-y-0.5">
        <p>
          Smart reminders run every {REMINDER_INTERVAL_MINUTES} minutes in the
          background.
        </p>
        <button
          type="button"
          onClick={() =>
            window.open("https://forms.gle/ChkQKfsoJovZtrhG8", "_blank")
          }
          className="text-[9px] text-sky-400 hover:text-sky-300 underline"
        >
          Coming soon: AI summaries &amp; sync – Join waitlist
        </button>
      </footer>
    </div>
  );
}

