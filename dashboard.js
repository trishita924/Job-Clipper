/**
 * Job Clipper — Dashboard Kanban Board Controller
 * Manages 4-column drag-and-drop, search/filters, Add/Edit modal,
 * Reminder Settings, Delete confirmation, and RFC 4180 CSV export.
 */
(function () {
  'use strict';

  const STATUSES = ['SAVED', 'APPLIED', 'INTERVIEW', 'RESULT'];
  let allJobs = [];
  let activeFilter = 'ALL';
  let draggedJobId = null;

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function isValidHttpUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function getDeadlineBadge(deadlineStr) {
    if (!deadlineStr) return null;
    const parts = deadlineStr.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    const deadlineEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
    const now = new Date();
    const diffDays = Math.ceil((deadlineEnd.getTime() - now.getTime()) / 86400000);

    if (diffDays < 0) {
      return { cls: 'expired', label: `Expired (${deadlineStr})` };
    }
    if (diffDays <= 2) {
      return { cls: 'soon', label: `Due ${deadlineStr}` };
    }
    return { cls: 'normal', label: `Due ${deadlineStr}` };
  }

  async function loadJobsAndRender() {
    const data = await chrome.storage.local.get(['jobs']);
    allJobs = Array.isArray(data.jobs) ? data.jobs : [];
    renderBoard();
  }

  function renderBoard() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    document.getElementById('board-summary').textContent =
      `${allJobs.length} application${allJobs.length === 1 ? '' : 's'} tracked`;

    const filtered = allJobs.filter((job) => {
      const matchStatus = activeFilter === 'ALL' || job.status === activeFilter;
      const matchQuery = !query ||
        (job.title && job.title.toLowerCase().includes(query)) ||
        (job.company && job.company.toLowerCase().includes(query)) ||
        (job.location && job.location.toLowerCase().includes(query)) ||
        (job.notes && job.notes.toLowerCase().includes(query));
      return matchStatus && matchQuery;
    });

    STATUSES.forEach((status) => {
      const colEl = document.getElementById('col-' + status);
      const countEl = document.getElementById('count-' + status);
      const colJobs = filtered.filter((j) => (j.status || 'SAVED') === status);

      countEl.textContent = String(colJobs.length);
      colEl.innerHTML = '';

      if (colJobs.length === 0) {
        colEl.innerHTML = '<div class="col-empty">No jobs here yet.<br/>Drag a card here or add one.</div>';
        return;
      }

      colJobs.forEach((job) => {
        const card = document.createElement('article');
        card.className = 'job-card';
        card.draggable = true;
        card.dataset.id = job.id;

        const dl = getDeadlineBadge(job.deadline);
        card.innerHTML = `
          <h3 class="card-title">${escapeHTML(job.title)}</h3>
          <div class="card-company">${escapeHTML(job.company)}</div>
          <div class="card-meta">
            ${job.location ? `<span class="meta-tag">📍 ${escapeHTML(job.location)}</span>` : ''}
            ${job.employmentType ? `<span class="meta-tag">${escapeHTML(job.employmentType)}</span>` : ''}
            ${dl ? `<span class="deadline-tag ${dl.cls}">⏰ ${escapeHTML(dl.label)}</span>` : ''}
          </div>
          <div class="card-actions">
            <a href="${escapeHTML(job.url)}" target="_blank" rel="noopener noreferrer" class="card-link">Open Link ↗</a>
            <div class="card-btns">
              <button type="button" class="card-icon-btn edit-btn">Edit</button>
              <button type="button" class="card-icon-btn danger del-btn">Delete</button>
            </div>
          </div>
        `;

        card.addEventListener('dragstart', (e) => {
          draggedJobId = job.id;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', job.id);
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          draggedJobId = null;
          document.querySelectorAll('.col-body').forEach((c) => c.classList.remove('drag-over'));
        });

        card.querySelector('.edit-btn').addEventListener('click', () => openJobModal(job));
        card.querySelector('.del-btn').addEventListener('click', () => deleteJob(job));

        colEl.appendChild(card);
      });
    });
  }

  // ==================== DRAG & DROP ====================
  function setupDragAndDrop() {
    document.querySelectorAll('.col-body').forEach((colBody) => {
      colBody.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        colBody.classList.add('drag-over');
      });

      colBody.addEventListener('dragleave', () => {
        colBody.classList.remove('drag-over');
      });

      colBody.addEventListener('drop', async (e) => {
        e.preventDefault();
        colBody.classList.remove('drag-over');
        const id = draggedJobId || e.dataTransfer.getData('text/plain');
        const newStatus = colBody.dataset.status;
        if (!id || !STATUSES.includes(newStatus)) return;

        const target = allJobs.find((j) => j.id === id);
        if (!target || target.status === newStatus) return;

        target.status = newStatus;
        await chrome.storage.local.set({ jobs: allJobs });
        chrome.runtime.sendMessage({ type: 'SYNC_REMINDERS' }).catch(() => {});
        renderBoard();
        showToast(`Moved "${target.title}" to ${newStatus}`);
      });
    });
  }

  // ==================== ADD / EDIT / DELETE ====================
  function openJobModal(job) {
    const modal = document.getElementById('modal-job');
    const titleEl = document.getElementById('modal-job-title');

    if (job) {
      titleEl.textContent = 'Edit Job Details';
      document.getElementById('edit-job-id').value = job.id;
      document.getElementById('edit-title').value = job.title || '';
      document.getElementById('edit-company').value = job.company || '';
      document.getElementById('edit-url').value = job.url || '';
      document.getElementById('edit-deadline').value = job.deadline || '';
      document.getElementById('edit-reminder').value =
        job.reminderDaysBefore !== undefined && job.reminderDaysBefore !== null ? String(job.reminderDaysBefore) : '1';
      document.getElementById('edit-status').value = job.status || 'SAVED';
      document.getElementById('edit-location').value = job.location || '';
      document.getElementById('edit-type').value = job.employmentType || '';
      document.getElementById('edit-description').value = job.description || '';
      document.getElementById('edit-notes').value = job.notes || '';
    } else {
      titleEl.textContent = 'Add New Job';
      document.getElementById('job-form').reset();
      document.getElementById('edit-job-id').value = '';
      document.getElementById('edit-status').value = 'SAVED';
      document.getElementById('edit-reminder').value = '1';
    }

    modal.classList.remove('hidden');
    document.getElementById('edit-title').focus();
  }

  function closeJobModal() {
    document.getElementById('modal-job').classList.add('hidden');
  }

  async function deleteJob(job) {
    if (!confirm(`Delete "${job.title}" at ${job.company}?`)) return;
    allJobs = allJobs.filter((j) => j.id !== job.id);
    await chrome.storage.local.set({ jobs: allJobs });
    chrome.runtime.sendMessage({ type: 'SYNC_REMINDERS' }).catch(() => {});
    renderBoard();
    showToast('Job deleted.');
  }

  // ==================== CSV EXPORT (RFC 4180) ====================
  function escapeCsvCell(val) {
    const str = String(val ?? '');
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function buildCsvContent(jobs) {
    const headers = [
      'Job Title',
      'Company',
      'URL',
      'Deadline',
      'Location',
      'Description',
      'Notes',
      'Status',
      'Date Added'
    ];
    const rows = [headers.map(escapeCsvCell).join(',')];

    jobs.forEach((j) => {
      const row = [
        j.title || '',
        j.company || '',
        j.url || '',
        j.deadline || '',
        j.location || '',
        j.description || '',
        j.notes || '',
        j.status || 'SAVED',
        j.createdAt ? new Date(j.createdAt).toLocaleDateString('en-CA') : ''
      ];
      rows.push(row.map(escapeCsvCell).join(','));
    });

    return '\uFEFF' + rows.join('\r\n');
  }

  function exportCsv() {
    if (allJobs.length === 0) {
      showToast('No jobs to export yet. Save a job first!');
      return;
    }
    const csv = buildCsvContent(allJobs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Job-Clipper-Applications.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast('Exported Job-Clipper-Applications.csv');
  }

  // ==================== SETTINGS MODAL ====================
  async function openSettingsModal() {
    const data = await chrome.storage.local.get(['settings']);
    const s = Object.assign({ notificationsEnabled: true, defaultReminderDaysBefore: 1 }, data.settings || {});
    document.getElementById('setting-notif-enabled').checked = Boolean(s.notificationsEnabled);
    document.getElementById('setting-default-days').value = String(s.defaultReminderDaysBefore ?? 1);
    document.getElementById('modal-settings').classList.remove('hidden');
  }

  function closeSettingsModal() {
    document.getElementById('modal-settings').classList.add('hidden');
  }

  // ==================== BOOTSTRAP ====================
  document.addEventListener('DOMContentLoaded', async () => {
    setupDragAndDrop();
    await loadJobsAndRender();

    document.getElementById('search-input').addEventListener('input', renderBoard);

    document.querySelectorAll('.pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderBoard();
      });
    });

    document.getElementById('btn-add-job').addEventListener('click', () => openJobModal(null));
    document.getElementById('modal-job-close').addEventListener('click', closeJobModal);
    document.getElementById('modal-job-cancel').addEventListener('click', closeJobModal);

    document.getElementById('job-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-job-id').value;
      const title = document.getElementById('edit-title').value.trim();
      const company = document.getElementById('edit-company').value.trim();
      const url = document.getElementById('edit-url').value.trim();
      const deadline = document.getElementById('edit-deadline').value.trim();
      const reminderDaysBefore = Number(document.getElementById('edit-reminder').value);
      const status = document.getElementById('edit-status').value;
      const location = document.getElementById('edit-location').value.trim();
      const employmentType = document.getElementById('edit-type').value.trim();
      const description = document.getElementById('edit-description').value.trim();
      const notes = document.getElementById('edit-notes').value.trim();

      if (!title || !company) {
        showToast('Job Title and Company Name are required.');
        return;
      }
      if (!isValidHttpUrl(url)) {
        showToast('Please enter a valid http:// or https:// URL.');
        return;
      }

      if (id) {
        const idx = allJobs.findIndex((j) => j.id === id);
        if (idx !== -1) {
          allJobs[idx] = Object.assign({}, allJobs[idx], {
            title,
            company,
            url,
            deadline,
            reminderDaysBefore,
            status,
            location,
            employmentType,
            description,
            notes
          });
        }
        showToast('Job updated!');
      } else {
        allJobs.unshift({
          id: 'job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          title,
          company,
          url,
          deadline,
          reminderDaysBefore,
          status,
          location,
          employmentType,
          description,
          notes,
          createdAt: new Date().toISOString()
        });
        showToast('Job added to board!');
      }

      await chrome.storage.local.set({ jobs: allJobs });
      chrome.runtime.sendMessage({ type: 'SYNC_REMINDERS' }).catch(() => {});
      closeJobModal();
      renderBoard();
    });

    document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
    document.getElementById('btn-open-settings').addEventListener('click', openSettingsModal);
    document.getElementById('modal-settings-close').addEventListener('click', closeSettingsModal);
    document.getElementById('modal-settings-cancel').addEventListener('click', closeSettingsModal);

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const settings = {
        notificationsEnabled: document.getElementById('setting-notif-enabled').checked,
        defaultReminderDaysBefore: Number(document.getElementById('setting-default-days').value)
      };
      await chrome.storage.local.set({ settings });
      chrome.runtime.sendMessage({ type: 'SYNC_REMINDERS' }).catch(() => {});
      closeSettingsModal();
      showToast('Reminder settings saved.');
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.jobs) {
        allJobs = Array.isArray(changes.jobs.newValue) ? changes.jobs.newValue : [];
        renderBoard();
      }
    });
  });
})();
