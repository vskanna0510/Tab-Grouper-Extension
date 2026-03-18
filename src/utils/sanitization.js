// Simple sanitization helpers to reduce XSS risk in React components and storage.
// We keep this minimal and focused on the threats relevant to this extension.

/**
 * Normalize and trim free-text user input before storing.
 * Removes control characters and enforces a max length to avoid abuse.
 */
export function sanitizeFreeText(input, maxLen = 500) {
  if (typeof input !== "string") {
    return "";
  }

  // Remove non-printable control characters
  const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();

  // Enforce max length to limit storage / abuse
  return cleaned.slice(0, maxLen);
}

/**
 * Validate and normalize URL values we store.
 * Returns null if invalid.
 */
export function sanitizeUrl(url) {
  if (typeof url !== "string" || url.length === 0) return null;

  try {
    const trimmed = url.trim();
    if (trimmed.length === 0) return null;

    const parsed = new URL(trimmed);

    // Disallow executable / sensitive protocols.
    // We *do* allow browser-internal pages (e.g. chrome://settings) so users can
    // still track and identify them, but we never "navigate by URL" from the UI
    // (we activate tabs by tabId instead).
    const blocked = new Set(["javascript:", "data:", "file:"]);
    if (blocked.has(parsed.protocol)) {
      return null;
    }

    // Allowlist common protocols we expect to encounter in tab URLs.
    const allowed = new Set([
      "http:",
      "https:",
      "chrome:",
      "chrome-error:",
      "chrome-extension:",
      "edge:",
      "about:"
    ]);
    if (!allowed.has(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Safe JSON parse wrapper with default fallback.
 */
export function safeJsonParse(value, defaultValue) {
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

