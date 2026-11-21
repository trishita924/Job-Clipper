# Job Clipper — Job & Internship Application Tracker

**Job Clipper** is a local-first, Manifest V3 Chrome & Brave extension that lets you clip job and internship listings in one click, manage your applications on a 4-column Kanban board, receive real desktop deadline reminders, and export your applications to CSV.

---

## Features

- **One-Click Job Clipping**: Auto-detects Role Title, Company Name, Location, Employment Type, Deadline, Description, and URL from public job pages (JSON-LD `JobPosting`, LinkedIn, Indeed, Wellfound, and generic pages), with full manual editing before saving.
- **4-Column Kanban Application Board**: Drag and drop cards across **SAVED**, **APPLIED**, **INTERVIEW**, and **RESULT**—status changes save automatically.
- **Editable Job Details & Notes**: Edit any field, add personal notes, and validate URLs/dates.
- **Real Deadline Reminders**: Uses `chrome.alarms` and `chrome.notifications` to alert you before an application deadline—even when the popup is closed.
- **Search & Status Filters**: Search by role, company, location, or notes, and filter by column status.
- **RFC 4180 CSV Export**: Downloads `Job-Clipper-Applications.csv` formatted cleanly for Microsoft Excel and Google Sheets.
- **100% Local & Private**: Powered by `chrome.storage.local` with no backend, login, or external API.

---

## Technology Used

- **Chrome Extension Manifest V3**
- **HTML5, CSS3, Vanilla JavaScript**
- **Chrome APIs**: `chrome.storage.local`, `chrome.alarms`, `chrome.notifications`, `chrome.tabs`, `chrome.runtime`

---

## Project Folder Structure

```text
Job-Clipper/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.css
├── popup.js
├── dashboard.html
├── dashboard.css
├── dashboard.js
├── README.md
├── TESTING-CHECKLIST.md
├── PRIVACY.md
└── assets/
    ├── icons/
    │   ├── icon16.png
    │   ├── icon48.png
    │   └── icon128.png
    └── images/
```

---

## Installation Guide (Google Chrome & Brave)

1. **Download & Extract the ZIP**: Download `Job-Clipper.zip` and extract it so you see the `Job-Clipper` folder containing `manifest.json`.
2. **Open Extensions Page**:
   - In **Google Chrome**: open `chrome://extensions/`
   - In **Brave**: open `brave://extensions/`
3. **Enable Developer Mode**: Turn **ON** the **Developer mode** toggle in the top-right corner.
4. **Load Unpacked**: Click **Load unpacked** and select the extracted **`Job-Clipper`** folder (the folder containing `manifest.json`).
5. **Pin the Extension**: Click the **Extensions (🧩)** icon in the toolbar and click **Pin (📌)** next to **Job Clipper**.
6. **Start Using Job Clipper**: Visit any job listing or click the toolbar icon to save jobs!

---

## How to Use

- **Open the Popup & Clip a Job**: Click the **Job Clipper** icon in your toolbar, then click **Save This Job (Auto-Detect)**. Review or fill in any missing fields, and click **Save to Tracking Board**.
- **Save a Job Manually**: Open the popup (or click **+ Add Job** on the Dashboard), fill in Role, Company, URL, and optional details, and save.
- **Open the Full Dashboard**: Click **Board ↗** in the popup header.
- **Use Drag-and-Drop**: Drag any job card between **SAVED**, **APPLIED**, **INTERVIEW**, and **RESULT** to update its status automatically.
- **Set Deadline Reminders**: Set a **Deadline Date** and **Reminder** timing when saving or editing a job. Configure global notification defaults via **⚙ Reminders** on the Dashboard.
- **Export CSV**: Click **⬇ Export CSV** on the Dashboard to download `Job-Clipper-Applications.csv`.

---

## Troubleshooting Common Errors

- **Auto-detect says unavailable**: Extensions cannot read `chrome://` internal pages or the Chrome Web Store. Open a normal `https://` job page, or enter the job details manually.
- **Notifications not appearing**: Ensure OS-level notifications are enabled for Chrome/Brave and that **Enable Deadline Notifications** is checked under **⚙ Reminders**.
- **"Manifest file is missing or unreadable"**: Make sure you selected the inner `Job-Clipper` folder that directly contains `manifest.json`.
