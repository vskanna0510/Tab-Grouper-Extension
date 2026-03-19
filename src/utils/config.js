// Central place for user-tunable, security-relevant configuration.
// Keeping it here avoids magic numbers spread across the codebase and
// simplifies auditing.

export const REMINDER_INTERVAL_MINUTES = 30;

/** Tabs not activated for this many hours are shown as "stale" in the UI. */
export const STALE_TAB_HOURS = 24;

