# Testing Checklist — Job Clipper

> **Environment Note:** Automated Manifest V3 validation, JavaScript syntax checks (`node --check`), asset path verification, and Node.js unit tests for `chrome.alarms`, `chrome.notifications`, duplicate suppression, and expired deadline handling were executed in the build sandbox. Live browser tests against public websites (LinkedIn, Indeed, Wellfound), drag-and-drop UI, CSV file download, and Chrome restart persistence require testing in Google Chrome or Brave because the sandbox has no outbound internet access.

| # | Test Scenario | Status | Verification Details |
|---|---------------|--------|----------------------|
| 1 | Extension installs successfully | **Verified (Manifest V3 & Assets)** / Pending Chrome Load | Validated `manifest.json` (MV3), declared permissions (`storage`, `activeTab`, `alarms`, `notifications`), and all referenced icon/script/HTML paths. |
| 2 | Popup opens correctly | **Verified (Syntax & HTML)** / Pending Chrome Load | `popup.html`, `popup.css`, and `popup.js` syntax and DOM bindings verified. |
| 3 | Manual job entry works | **Verified (Logic & Validation)** / Pending Chrome Load | Role, Company, and `http/https` URL validation + `chrome.storage.local` save implemented in `popup.js` and `dashboard.js`. |
| 4 | Job details detected on 3 public job sites (LinkedIn, Indeed, Wellfound) | **Pending Live Browser Verification** | Selectors + JSON-LD `JobPosting` parser implemented in `content.js`; requires live testing on public listings in Chrome/Brave. |
| 5 | Manual fallback works when detection fails | **Verified (Logic)** / Pending Chrome Load | Editable form remains open and un-prefilled fields stay blank (no fabricated data) when detection returns partial/empty fields. |
| 6 | All fields can be edited | **Verified (Code Audit)** / Pending Chrome Load | Edit modal in `dashboard.html` / `dashboard.js` supports editing Title, Company, URL, Deadline, Reminder, Status, Location, Type, Description, and Notes. |
| 7 | Jobs can be dragged across all 4 columns | **Pending Live Browser Verification** | HTML5 drag-and-drop (`dragstart`, `dragover`, `drop`) across `SAVED`, `APPLIED`, `INTERVIEW`, `RESULT` implemented in `dashboard.js`. |
| 8 | Search and filters work | **Verified (Filter Logic)** / Pending Chrome Load | Search across Title, Company, Location, Notes + Status filter pills implemented in `dashboard.js`. |
| 9 | Deadline notification actually appears | **Passed (Automated Mock)** / Pending Live Chrome Test | Verified `chrome.alarms.onAlarm` triggers `chrome.notifications.create` with job title & deadline, and suppresses duplicates via `notifiedKeys`. |
| 10 | Editing a deadline updates its reminder | **Verified (Alarm Sync Logic)** / Pending Live Chrome Test | `syncAllReminders()` clears existing `job-reminder:*` alarms and reschedules whenever `chrome.storage.onChanged` detects job/setting edits. |
| 11 | Data survives browser restart | **Pending Live Chrome Verification** | All state is persisted in `chrome.storage.local` and re-synced via `chrome.runtime.onStartup`. |
| 12 | CSV downloads and opens correctly in spreadsheet | **Verified (RFC 4180 Logic)** / Pending Live Download Test | `buildCsvContent()` escapes commas, quotes (`""`), and newlines with UTF-8 BOM (`Job-Clipper-Applications.csv`). |
| 13 | Delete confirmation works | **Verified (Code Audit)** / Pending Live Chrome Test | `deleteJob()` prompts `confirm(...)` before removing job and resyncing alarms. |
