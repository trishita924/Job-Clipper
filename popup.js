/**
 * Job Clipper — Popup Controller
 * Handles one-click DOM job detection, manual fallback editing,
 * URL/date validation, duplicate checks, and persistent storage.
 */
(function () {
  'use strict';

  function normalizeUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      u.hash = '';
      return u.toString().replace(/\/+$/, '');
    } catch (e) {
      return (rawUrl || '').trim();
    }
  }

  function isValidHttpUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function showFeedback(message, type) {
    const el = document.getElementById('popup-feedback');
    el.textContent = message;
    el.className = 'feedback ' + (type || 'success');
  }

  async function refreshCount() {
    const data = await chrome.storage.local.get(['jobs']);
    const count = Array.isArray(data.jobs) ? data.jobs.length : 0;
    document.getElementById('popup-saved-count').textContent = `${count} saved job${count === 1 ? '' : 's'}`;
  }

  async function detectCurrentTabJob() {
    const statusEl = document.getElementById('detect-status');
    statusEl.textContent = 'Scanning current page...';

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab || !tab.url || !tab.url.startsWith('http')) {
        statusEl.textContent = 'Not a web page. Enter job details manually below.';
        return;
      }

      document.getElementById('job-url').value = tab.url;

      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB_DETAILS' });
      if (resp && resp.ok && resp.data) {
        const d = resp.data;
        if (d.title) document.getElementById('job-title').value = d.title;
        if (d.company) document.getElementById('job-company').value = d.company;
        if (d.url) document.getElementById('job-url').value = d.url;
        if (d.deadline) document.getElementById('job-deadline').value = d.deadline;
        if (d.location) document.getElementById('job-location').value = d.location;
        if (d.employmentType) document.getElementById('job-type').value = d.employmentType;
        if (d.description) document.getElementById('job-description').value = d.description;

        const foundCount = [d.title, d.company, d.location, d.deadline].filter(Boolean).length;
        statusEl.textContent = foundCount > 0
          ? `Detected ${foundCount} field(s). Review or fill any missing details below.`
          : 'Could not auto-detect job fields. Please enter them manually below.';
      } else {
        statusEl.textContent = 'Could not auto-detect fields. Please enter them manually below.';
      }
    } catch (e) {
      statusEl.textContent = 'Auto-detect unavailable on this page. Enter details manually below.';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await refreshCount();

    document.getElementById('btn-open-dashboard').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    });

    document.getElementById('btn-detect-job').addEventListener('click', detectCurrentTabJob);

    document.getElementById('popup-job-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('job-title').value.trim();
      const company = document.getElementById('job-company').value.trim();
      const url = document.getElementById('job-url').value.trim();
      const deadline = document.getElementById('job-deadline').value.trim();
      const status = document.getElementById('job-status').value;
      const location = document.getElementById('job-location').value.trim();
      const employmentType = document.getElementById('job-type').value.trim();
      const description = document.getElementById('job-description').value.trim();
      const notes = document.getElementById('job-notes').value.trim();

      if (!title) {
        showFeedback('Please enter a Job / Internship Role.', 'error');
        document.getElementById('job-title').focus();
        return;
      }
      if (!company) {
        showFeedback('Please enter a Company Name.', 'error');
        document.getElementById('job-company').focus();
        return;
      }
      if (!isValidHttpUrl(url)) {
        showFeedback('Please enter a valid http:// or https:// URL.', 'error');
        document.getElementById('job-url').focus();
        return;
      }

      const data = await chrome.storage.local.get(['jobs', 'settings']);
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      const settings = data.settings || { defaultReminderDaysBefore: 1 };

      const normUrl = normalizeUrl(url);
      if (jobs.some((j) => normalizeUrl(j.url) === normUrl)) {
        showFeedback('This job URL is already saved on your board.', 'warning');
        return;
      }

      const newJob = {
        id: 'job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        title,
        company,
        url,
        deadline,
        reminderDaysBefore: settings.defaultReminderDaysBefore ?? 1,
        location,
        employmentType,
        description,
        notes,
        status,
        createdAt: new Date().toISOString()
      };

      jobs.unshift(newJob);
      await chrome.storage.local.set({ jobs });
      chrome.runtime.sendMessage({ type: 'SYNC_REMINDERS' }).catch(() => {});

      await refreshCount();
      showFeedback('Saved to Tracking Board!', 'success');
      document.getElementById('popup-job-form').reset();
    });
  });
})();
