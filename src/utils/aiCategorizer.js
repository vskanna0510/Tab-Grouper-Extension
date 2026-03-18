import { sanitizeFreeText } from "./sanitization";

// NOTE: This file intentionally implements a purely local, heuristic-based
// "auto categorization" to avoid any outbound network calls or API keys.
// If you later plug in a real AI API, wire it in here and:
// - Read any secrets from a secure location (e.g. environment at build time),
// - NEVER hardcode keys in this file,
// - Update the extension CSP and permissions explicitly.

const KEYWORD_PURPOSES = [
  { keyword: "docs", purpose: "Reading documentation" },
  { keyword: "documentation", purpose: "Reading documentation" },
  { keyword: "github", purpose: "Code review / repo" },
  { keyword: "stackoverflow", purpose: "Debugging / Q&A" },
  { keyword: "jira", purpose: "Project management" },
  { keyword: "asana", purpose: "Project management" },
  { keyword: "notion", purpose: "Notes & knowledge" },
  { keyword: "drive.google.com", purpose: "Working with documents" },
  { keyword: "youtube", purpose: "Videos / tutorials" },
  { keyword: "figma", purpose: "Design review" }
];

export function guessPurposeFromTab(title, url) {
  const text = `${title || ""} ${url || ""}`.toLowerCase();
  if (!text.trim()) return "";

  for (const rule of KEYWORD_PURPOSES) {
    if (text.includes(rule.keyword)) {
      return sanitizeFreeText(rule.purpose);
    }
  }

  return "";
}

