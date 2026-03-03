/* admin.js – Publish and edit writings via GitHub API */

const KEYS = {
  pat:   'ihw_pat',
  owner: 'ihw_owner',
  repo:  'ihw_repo',
};

/* Edit-mode state */
let editMode      = false;
let editWritingId = null;

/* ── Base64 helpers (Unicode-safe) ─────────────────────── */
function toB64(str)   { return btoa(unescape(encodeURIComponent(str))); }
function fromB64(str) { return decodeURIComponent(escape(atob(str.replace(/\s/g, '')))); }

/* ── Slug generator ─────────────────────────────────────── */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/* ── GitHub API ─────────────────────────────────────────── */
const ghHeaders = (pat) => ({
  'Authorization': 'token ' + pat,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
});

function contentsUrl(owner, repo) {
  return `https://api.github.com/repos/${owner}/${repo}/contents/data/writings.json`;
}

async function ghGet(url, pat) {
  const res  = await fetch(url, { headers: ghHeaders(pat) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'GitHub API error ' + res.status);
  return body;
}

async function ghPut(url, pat, payload) {
  const res  = await fetch(url, { method: 'PUT', headers: ghHeaders(pat), body: JSON.stringify(payload) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'GitHub API error ' + res.status);
  return body;
}

/* ── UI helpers ─────────────────────────────────────────── */
function showStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg show status-' + type;
}
function hideStatus(id) {
  const el = document.getElementById(id);
  if (el) el.className = 'status-msg';
}

function getSettings() {
  return {
    pat:   document.getElementById('pat').value.trim(),
    owner: document.getElementById('repo-owner').value.trim(),
    repo:  document.getElementById('repo-name').value.trim(),
  };
}

/* ── Live preview ───────────────────────────────────────── */
function updatePreview() {
  const md      = document.getElementById('content').value.trim();
  const preview = document.getElementById('preview');
  if (!preview) return;

  if (!md) {
    preview.innerHTML = '<em style="color:var(--text-light);">Preview will appear here as you type…</em>';
    return;
  }
  marked.setOptions({ breaks: true, gfm: true, html: true, headerIds: false });
  preview.innerHTML = marked.parse(md);
}

/* ── Verify GitHub connection ───────────────────────────── */
async function verifyConnection() {
  const { pat, owner, repo } = getSettings();
  if (!pat || !owner || !repo) {
    showStatus('verify-status', 'Please fill in all three fields first.', 'error');
    return;
  }

  const btn = document.getElementById('verify-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  hideStatus('verify-status');

  try {
    await ghGet(contentsUrl(owner, repo), pat);
    showStatus('verify-status', '✓ Connected — repository and file found.', 'success');
    saveSettings();
  } catch (e) {
    showStatus('verify-status', '✗ ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify Connection';
  }
}

function saveSettings() {
  const { pat, owner, repo } = getSettings();
  localStorage.setItem(KEYS.pat,   pat);
  localStorage.setItem(KEYS.owner, owner);
  localStorage.setItem(KEYS.repo,  repo);
}

/* ── Load writings list for editing ────────────────────── */
async function loadWritingsForEdit() {
  const { pat, owner, repo } = getSettings();
  if (!pat || !owner || !repo) {
    showStatus('edit-load-status', 'Fill in GitHub settings and verify first.', 'error');
    return;
  }

  const btn = document.getElementById('load-writings-btn');
  btn.disabled = true;
  btn.textContent = 'Loading…';
  hideStatus('edit-load-status');

  try {
    const fileData = await ghGet(contentsUrl(owner, repo), pat);
    const data     = JSON.parse(fromB64(fileData.content));
    renderEditList(data.writings);
    if (!data.writings.length) {
      showStatus('edit-load-status', 'No writings found yet.', 'info');
    }
  } catch (e) {
    showStatus('edit-load-status', '✗ ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Load Writings';
  }
}

function renderEditList(writings) {
  const list = document.getElementById('edit-list');
  if (!list) return;

  if (!writings.length) { list.innerHTML = ''; return; }

  const sorted = [...writings].sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  list.innerHTML = sorted.map(w => `
    <button type="button" class="edit-item" data-id="${w.id}">
      <span class="edit-item-date">${w.date}</span>
      <span class="edit-item-title">${w.title}</span>
    </button>`).join('');

  list.querySelectorAll('.edit-item').forEach(btn => {
    btn.addEventListener('click', () => {
      // Highlight active
      list.querySelectorAll('.edit-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const writing = writings.find(w => String(w.id) === btn.dataset.id);
      if (writing) populateFormForEdit(writing);
    });
  });
}

/* ── Populate form for editing ──────────────────────────── */
function populateFormForEdit(writing) {
  editMode      = true;
  editWritingId = writing.id;

  document.getElementById('title').value          = writing.title;
  document.getElementById('date-display').value   = writing.date;
  document.getElementById('date-iso').value        = writing.dateISO;
  document.getElementById('scripture-ref').value  = writing.scriptureRef;
  document.getElementById('scripture-text').value = writing.scriptureText || '';
  document.getElementById('slug').value           = writing.slug;
  document.getElementById('content').value        = writing.content;

  // Update form chrome
  document.getElementById('form-mode-label').childNodes[0].textContent = 'Edit Writing ';
  document.getElementById('edit-badge').style.display    = 'inline-block';
  document.getElementById('submit-btn').textContent      = '✦ Save Changes';
  document.getElementById('cancel-edit-btn').style.display = 'inline-flex';

  updatePreview();
  document.getElementById('writing-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Cancel edit — return to "new" mode ─────────────────── */
function cancelEdit() {
  editMode      = false;
  editWritingId = null;

  // Clear form fields
  ['title','date-display','date-iso','scripture-ref','scripture-text','slug','content']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Remove active highlight from list
  document.querySelectorAll('.edit-item').forEach(b => b.classList.remove('active'));

  // Reset form chrome
  document.getElementById('form-mode-label').childNodes[0].textContent = 'Publish a New Writing ';
  document.getElementById('edit-badge').style.display      = 'none';
  document.getElementById('submit-btn').textContent        = '✦ Publish Writing';
  document.getElementById('cancel-edit-btn').style.display = 'none';

  hideStatus('submit-status');
  updatePreview();
}

/* ── Submit (new or edit) ───────────────────────────────── */
async function submitWriting(e) {
  e.preventDefault();

  const { pat, owner, repo } = getSettings();
  const title         = document.getElementById('title').value.trim();
  const dateDisplay   = document.getElementById('date-display').value.trim();
  const dateISO       = document.getElementById('date-iso').value.trim();
  const scriptureRef  = document.getElementById('scripture-ref').value.trim();
  const scriptureText = document.getElementById('scripture-text').value.trim();
  let   slug          = document.getElementById('slug').value.trim();
  const content       = document.getElementById('content').value.trim();

  if (!pat || !owner || !repo) {
    showStatus('submit-status', 'Fill in GitHub settings and verify connection first.', 'error');
    return;
  }
  if (!title || !dateDisplay || !dateISO || !scriptureRef || !content) {
    showStatus('submit-status', 'Please fill in all required fields (marked *).', 'error');
    return;
  }
  if (!slug) slug = slugify(title);

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = editMode ? 'Saving…' : 'Publishing…';
  showStatus('submit-status', 'Connecting to GitHub…', 'info');

  try {
    const fileData = await ghGet(contentsUrl(owner, repo), pat);
    const data     = JSON.parse(fromB64(fileData.content));

    if (editMode) {
      /* ── UPDATE existing writing ── */
      const idx = data.writings.findIndex(w => w.id === editWritingId);
      if (idx === -1) throw new Error('Could not find the original writing in the data file.');

      data.writings[idx] = {
        ...data.writings[idx],   // preserve id and slug
        title,
        date:         dateDisplay,
        dateISO,
        scriptureRef,
        scriptureText,
        content,
      };

      showStatus('submit-status', 'Saving changes to GitHub…', 'info');
      await ghPut(contentsUrl(owner, repo), pat, {
        message: 'Edit writing: ' + title,
        content: toB64(JSON.stringify(data, null, 2)),
        sha:     fileData.sha,
      });

      showStatus('submit-status', '✓ "' + title + '" updated! Changes will appear on the site within ~30 seconds.', 'success');
      // Stay in edit mode so further tweaks are easy; list will refresh on next Load

    } else {
      /* ── ADD new writing ── */
      // Avoid slug collision
      if (data.writings.some(w => w.slug === slug)) {
        slug = slug + '-' + Date.now().toString(36);
      }

      const maxId = data.writings.reduce((m, w) => Math.max(m, w.id || 0), 0);
      data.writings.push({
        id: maxId + 1,
        slug,
        title,
        date:         dateDisplay,
        dateISO,
        scriptureRef,
        scriptureText,
        content,
      });

      showStatus('submit-status', 'Committing to GitHub…', 'info');
      await ghPut(contentsUrl(owner, repo), pat, {
        message: 'Add writing: ' + title,
        content: toB64(JSON.stringify(data, null, 2)),
        sha:     fileData.sha,
      });

      showStatus('submit-status', '✓ "' + title + '" published! It will appear on the site within ~30 seconds.', 'success');

      // Clear form for next entry
      ['title','date-display','date-iso','scripture-ref','scripture-text','slug','content']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      updatePreview();
    }

    saveSettings();

  } catch (err) {
    showStatus('submit-status', '✗ Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editMode ? '✦ Save Changes' : '✦ Publish Writing';
  }
}

/* ── Init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved settings
  const saved = {
    pat:   localStorage.getItem(KEYS.pat)   || '',
    owner: localStorage.getItem(KEYS.owner) || '',
    repo:  localStorage.getItem(KEYS.repo)  || '',
  };
  if (saved.pat)   document.getElementById('pat').value        = saved.pat;
  if (saved.owner) document.getElementById('repo-owner').value = saved.owner;
  if (saved.repo)  document.getElementById('repo-name').value  = saved.repo;

  // Auto-slug from title (only in new mode)
  document.getElementById('title').addEventListener('input', (e) => {
    if (!editMode) document.getElementById('slug').value = slugify(e.target.value);
  });

  // Live preview
  document.getElementById('content').addEventListener('input', updatePreview);

  // Buttons
  document.getElementById('verify-btn').addEventListener('click', verifyConnection);
  document.getElementById('load-writings-btn').addEventListener('click', loadWritingsForEdit);
  document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
  document.getElementById('writing-form').addEventListener('submit', submitWriting);
});
