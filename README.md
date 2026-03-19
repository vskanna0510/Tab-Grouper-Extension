# TabZen (Chrome Extension - Manifest V3)

TabZen is a **security-first, context-aware tab manager** that helps users remember **why** they opened each tab, organize tabs by intent, and receive gentle reminders to reduce tab overload.

---

## Problem Statement

Modern browsing creates tab overload:

- **Context loss**: users forget what a tab was for after switching tasks.
- **Attention fragmentation**: tabs accumulate across work streams and personal tasks.
- **Inefficient follow-through**: important tabs remain open without a clear next action.

Traditional tab managers focus on *quantity* (close/suspend) rather than *purpose* (why the tab exists).

---

## Why This Solution

TabZen addresses tab overload by capturing **user intent** at the moment it matters:

- **Intent capture**: “Why did you open this tab?” is saved per tab.
- **Purpose-first grouping**: tabs are organized by intent, not just domain.
- **Smart reminders**: nudges users to finish or close tabs they intentionally kept open.

The design is **production-oriented**:

- Chrome Extension **Manifest V3** architecture
- Minimal permissions
- Strong data validation and sanitization
- Strict Content Security Policy (CSP)

---

## Key Features

### 1) Tab Tracking (Chrome Tabs API)

TabZen listens for tab lifecycle events and stores metadata:

- `tabId`
- `title`
- `url`
- `createdAt`
- `lastAccessed`

Tracked events:

- **Tab created** (`chrome.tabs.onCreated`)
- **Tab updated** (title / URL changes via `chrome.tabs.onUpdated`)
- **Tab activated** (`chrome.tabs.onActivated`)
- **Tab removed** (`chrome.tabs.onRemoved`)

### 2) User Intent Capture (Popup UI)

In the popup:

- You write a short “purpose” for the **currently active tab**
- You can update it anytime

### 3) Tab Organization

Tabs are grouped by `purpose` in the popup dashboard:

- Each purpose becomes a group card
- Tabs are listed with a status badge (`Open` / `Done`)
- You can mark a tab as **Done**

### 4) Smart Reminder System (Chrome Alarms + Notifications)

TabZen uses:

- `chrome.alarms` to periodically evaluate unfinished tabs
- `chrome.notifications` to nudge the user if they have unfinished “open” tabs with a purpose

Includes **rate limiting** to prevent notification spam.

### 5) Optional “AI” Auto-Categorization (Local Only)

TabZen includes a safe abstraction (`src/utils/aiCategorizer.js`) that performs a **local heuristic guess** based on title/URL keywords.

- No network calls
- No API keys
- No external services

If you later plug in a real AI provider, do it in that module and update CSP/permissions intentionally.

---

## How It Works (System Design)

### Architecture Overview

- **Background service worker** (`src/background/index.js`)
  - Watches tab events
  - Updates and persists tab state
  - Runs alarm-based reminder checks
  - Owns message handling / state updates
- **Popup React UI** (`src/popup/*`)
  - Reads state from background via `chrome.runtime.sendMessage`
  - Lets user save “purpose”
  - Groups and displays tabs by purpose
  - Provides “Go to tab” action via `chrome.tabs.update`
- **Storage & validation layer** (`src/utils/storage.js`)
  - Provides `loadTabIntents()` / `saveTabIntents()`
  - Normalizes and sanitizes all stored records
- **Security utilities** (`src/utils/sanitization.js`, `src/utils/messaging.js`)
  - Input sanitization
  - URL validation
  - Message schema validation


### Popup-to-Background Messaging

The popup never writes to storage directly. It sends validated messages:

- `GET_STATE`: fetch the latest tab intent map
- `UPDATE_PURPOSE`: update a tab’s purpose
- `MARK_DONE`: mark a tab as finished
- `CLEAR_ALL`: reset all stored intents

The background validates:

- message `type` is allow-listed
- payload structure is correct (`tabId` is a number, etc.)

### Navigating to a Tab

The popup uses **tab activation** (safe) rather than URL navigation:

- `chrome.windows.update(windowId, { focused: true })`
- `chrome.tabs.update(tabId, { active: true })`

This avoids opening arbitrary URLs from user-controlled storage.

---

## Security Model (What We Enforce)

### Content Security Policy (CSP)

In `public/manifest.json`:

- **No inline scripts**
- Only `script-src 'self'`
- Only `style-src 'self'`
- `connect-src 'self'` (blocks accidental outbound network calls)

### Data Protection & XSS Resistance

- User input is sanitized (`sanitizeFreeText`) before storage
- Stored data is normalized on load (`normalizeTabRecord`)
- React renders text content safely (no `dangerouslySetInnerHTML`)

### Permissions Minimization

Only:

- `tabs`
- `storage`
- `alarms`
- `notifications`

No `host_permissions`.

### Safe Messaging

All messages are validated and allow-listed in `src/utils/messaging.js`.

### Storage Safety / Corruption Handling

- On load, malformed storage entries are dropped
- Entire storage map falls back to `{}` if corrupted

### URL Handling Safety

TabZen stores and displays URLs but does **not** execute them.

- Blocks dangerous protocols (`javascript:`, `data:`, `file:`)
- Allows common tab protocols (e.g. `https:`, `chrome:`) so internal pages remain identifiable

### Notification Safety (Rate Limiting)

Reminders are rate-limited to prevent spam and abuse.

---

## Installation & Build

### Prerequisites

- Node.js (LTS recommended)
- Chrome (or Chromium-based browser)

### Install dependencies

```bash
npm install
```

### Build (webpack + tailwind)

```bash
npm run build:all
```

This outputs:

- `public/popup.js`
- `public/background.js`
- `public/popup.css`

### Load into Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the folder: `TabZen-extension/public`
---

## How to Use (End User)

### Save a purpose for the active tab

1. Click the TabZen toolbar icon
2. Type a purpose into **Current tab purpose**
3. Click **Save purpose**

### Review grouped dashboard

- Open the popup to see tabs grouped by purpose
- Click **Go to tab** to jump to a specific tab
- Click **Mark done** when finished

### Clear all saved intents

- Click **Clear all** (requires confirmation)

---

## Testing Guide (Functional + Edge Cases)

### Core flows

- **Tab tracking**: open new tabs; reload popup; confirm they appear
- **Purpose saving**: set a purpose; close/reopen popup; confirm persistence
- **Grouping**: assign same purpose to multiple tabs; verify grouped counts
- **Navigation**: use **Go to tab**; confirm tab is focused and active
- **Reminders**: leave some tabs `open` with a purpose and wait for notifications

### Edge cases

- **20+ tabs**: create many tabs across multiple purposes; verify UI remains usable
- **Empty purpose**: save an empty purpose; confirm it groups under “Uncategorized”
- **Storage reset**: use **Clear all**; verify state resets cleanly
- **Internal pages**: visit `chrome://settings`; confirm it remains identifiable (URL shown, title fallback)

---
