/* admin.js – Admin panel: publishes new writings to GitHub via API */

const KEYS = {
  pat:   'ihw_pat',
  owner: 'ihw_owner',
  repo:  'ihw_repo',
};

/* ── Base64 helpers (handles Unicode) ──────────────────── */
function toB64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromB64(str) {
  return decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));
}

/* ── Slug generator ────────────────────────────────────── */
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

/* ── GitHub API helpers ────────────────────────────────── */
const HEADERS = (pat) => ({
  'Authorization': 'token ' + pat,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
});

async function ghGet(url, pat) {
  const res = await fetch(url, { headers: HEADERS(pat) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'GitHub API error ' + res.status);
  return body;
}

async function ghPut(url, pat, payload) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: HEADERS(pat),
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'GitHub API error ' + res.status);
  return body;
}

function contentsUrl(owner, repo) {
  return `https://api.github.com/repos/${owner}/${repo}/contents/data/writings.json`;
}

/* ── UI helpers ────────────────────────────────────────── */
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

/* ── Live preview ──────────────────────────────────────── */
function updatePreview() {
  const content = document.getElementById('content');
  const preview = document.getElementById('preview');
  if (!content || !preview || typeof marked === 'undefined') return;

  const md = content.value.trim();
  if (!md) {
    preview.innerHTML = '<em style="color:var(--text-light);">Preview will appear here as you type…</em>';
    return;
  }

  marked.setOptions({ breaks: true, gfm: true, html: true, headerIds: false });
  preview.innerHTML = marked.parse(md);
}

/* ── Verify GitHub connection ──────────────────────────── */
async function verifyConnection() {
  const pat   = document.getElementById('pat').value.trim();
  const owner = document.getElementById('repo-owner').value.trim();
  const repo  = document.getElementById('repo-name').value.trim();

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
    showStatus('verify-status', '✓ Connected! Repository and file found.', 'success');
    // Save settings
    localStorage.setItem(KEYS.pat,   pat);
    localStorage.setItem(KEYS.owner, owner);
    localStorage.setItem(KEYS.repo,  repo);
  } catch (e) {
    showStatus('verify-status', '✗ ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify Connection';
  }
}

/* ── Submit writing ────────────────────────────────────── */
async function submitWriting(e) {
  e.preventDefault();

  const pat   = document.getElementById('pat').value.trim();
  const owner = document.getElementById('repo-owner').value.trim();
  const repo  = document.getElementById('repo-name').value.trim();

  const title        = document.getElementById('title').value.trim();
  const dateDisplay  = document.getElementById('date-display').value.trim();
  const dateISO      = document.getElementById('date-iso').value.trim();
  const scriptureRef = document.getElementById('scripture-ref').value.trim();
  const scriptureText= document.getElementById('scripture-text').value.trim();
  let   slug         = document.getElementById('slug').value.trim();
  const content      = document.getElementById('content').value.trim();

  if (!pat || !owner || !repo) {
    showStatus('submit-status', 'Please fill in GitHub settings and verify connection first.', 'error');
    return;
  }
  if (!title || !dateDisplay || !dateISO || !scriptureRef || !content) {
    showStatus('submit-status', 'Please fill in all required fields (marked with *).', 'error');
    return;
  }

  if (!slug) slug = slugify(title);

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Publishing…';
  showStatus('submit-status', 'Connecting to GitHub…', 'info');

  try {
    // 1. Fetch current writings.json
    const fileData = await ghGet(contentsUrl(owner, repo), pat);
    const current  = JSON.parse(fromB64(fileData.content));

    // 2. Check for slug collision
    if (current.writings.some(w => w.slug === slug)) {
      slug = slug + '-' + Date.now().toString(36);
    }

    // 3. Build new writing object
    const maxId = current.writings.reduce((m, w) => Math.max(m, w.id || 0), 0);
    const newWriting = {
      id: maxId + 1,
      slug,
      title,
      date:         dateDisplay,
      dateISO,
      scriptureRef,
      scriptureText: scriptureText || '',
      content,
    };

    current.writings.push(newWriting);

    // 4. Commit updated file
    showStatus('submit-status', 'Committing to GitHub…', 'info');
    await ghPut(contentsUrl(owner, repo), pat, {
      message: 'Add writing: ' + title,
      content: toB64(JSON.stringify(current, null, 2)),
      sha:     fileData.sha,
    });

    // 5. Success
    showStatus(
      'submit-status',
      '✓ "' + title + '" published! It will appear on the site within ~30 seconds.',
      'success'
    );

    // Save settings in case they weren't saved yet
    localStorage.setItem(KEYS.pat,   pat);
    localStorage.setItem(KEYS.owner, owner);
    localStorage.setItem(KEYS.repo,  repo);

    // Clear writing fields (keep settings)
    ['title','date-display','date-iso','scripture-ref','scripture-text','slug','content'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    updatePreview();

  } catch (err) {
    showStatus('submit-status', '✗ Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Publish Writing';
  }
}

/* ── Init ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved settings
  const saved = {
    pat:   localStorage.getItem(KEYS.pat)   || '',
    owner: localStorage.getItem(KEYS.owner) || '',
    repo:  localStorage.getItem(KEYS.repo)  || '',
  };
  if (saved.pat)   document.getElementById('pat').value          = saved.pat;
  if (saved.owner) document.getElementById('repo-owner').value   = saved.owner;
  if (saved.repo)  document.getElementById('repo-name').value    = saved.repo;

  // Auto-generate slug from title
  document.getElementById('title').addEventListener('input', (e) => {
    document.getElementById('slug').value = slugify(e.target.value);
  });

  // Live preview
  document.getElementById('content').addEventListener('input', updatePreview);

  // Verify button
  document.getElementById('verify-btn').addEventListener('click', verifyConnection);

  // Form submit
  document.getElementById('writing-form').addEventListener('submit', submitWriting);
});
