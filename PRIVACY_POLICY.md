# TabSense Privacy Policy

Last updated: 2026-03-17

TabSense is a browser extension that helps users remember why they opened tabs by saving a purpose for each tab, grouping tabs by purpose, and showing reminder notifications.

## 1) Data We Collect

TabSense processes the following data inside your browser:

- Tab metadata:
  - Tab ID
  - Tab title
  - Tab URL
  - Timestamps (`createdAt`, `lastAccessed`)
- User-entered purpose text for each tab
- Tab status (`open` / `done`)
- Optional saved session data (session name, tab URLs, titles, and purposes)

## 2) How We Use Data

This data is used only to provide extension features:

- Show tabs grouped by purpose
- Save and edit tab purposes
- Mark tabs as done
- Restore saved sessions
- Trigger reminder notifications for unfinished tabs

## 3) Where Data Is Stored

- Data is stored locally in your browser using `chrome.storage.local`.
- TabSense does not require account login and does not run a backend server.
- TabSense does not send tab metadata or purpose text to the developer's servers.

## 4) Data Sharing

TabSense does not sell user data and does not share browsing data with third parties for advertising.

If you click an external link from the extension (for example, a waitlist form), any data submitted on that external site is governed by that site's own privacy policy.

## 5) Third-Party Services

Current TabSense core functionality does not rely on third-party analytics or remote AI APIs.

If future versions add optional external integrations, this policy will be updated before release.

## 6) Permissions Explained

TabSense requests only the permissions needed for its features:

- `tabs`: read/manage open tab metadata and activate tabs
- `tabGroups`: create native browser tab groups by purpose
- `storage`: persist user settings and tab intent data
- `alarms`: run periodic reminder checks
- `notifications`: display reminder notifications

## 7) Security

TabSense applies security controls including:

- Strict Content Security Policy (Manifest V3 extension pages)
- Input sanitization for user-entered purpose text
- URL validation before storage/processing
- Message validation between popup and background scripts
- Notification rate limiting

## 8) User Controls

You can control your data at any time:

- Edit or clear tab purposes in the popup
- Delete saved sessions in the popup
- Use "Clear all" to remove all tracked tab intent data
- Uninstall the extension to remove extension data from your browser profile

## 9) Children's Privacy

TabSense is not directed to children. We do not knowingly collect personal data from children.

## 10) Changes to This Policy

We may update this policy from time to time. The "Last updated" date will reflect the latest revision.

## 11) Contact

For privacy questions, contact:

- Name: Kanna
- Email: vskanna2003@gmail.com
- Project page: https://github.com/vskanna0510

