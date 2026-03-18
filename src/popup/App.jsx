import { useEffect, useMemo, useState } from "react";
import { MESSAGE_TYPES } from "../utils/messaging";
import { sanitizeFreeText } from "../utils/sanitization";
import { REMINDER_INTERVAL_MINUTES } from "../utils/config";

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
      </section>

      {error && (
        <div className="mb-2 text-xs text-red-400">
          {sanitizeFreeText(error, 120)}
        </div>
      )}

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

      <div className="space-y-2 overflow-y-auto max-h-72 pr-1 custom-scroll">
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
            <div className="px-2 py-1 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-300 truncate max-w-[260px]">
                {purpose || "Uncategorized"}
              </span>
              <span className="text-[10px] text-slate-500">
                {items.length} tab{items.length > 1 ? "s" : ""}
              </span>
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

      <footer className="mt-3 text-[9px] text-slate-500">
        Smart reminders run every {REMINDER_INTERVAL_MINUTES} minutes in the
        background.
      </footer>
    </div>
  );
}

