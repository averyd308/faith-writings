/* app.js – Loads and renders writings for index and writing pages */

// Resolve data path relative to the HTML file location
const DATA_URL = (function () {
  const base = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : window.location.pathname.replace(/\/[^/]*$/, '/');
  // Works both locally and on GitHub Pages
  return 'data/writings.json';
})();

/* ── Utilities ────────────────────────────────────────── */

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getExcerpt(mdText, maxLen = 160) {
  const plain = mdText
    .replace(/<[^>]+>/g, '')          // strip HTML tags
    .replace(/#{1,6}\s+/g, '')        // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1')    // italic
    .replace(/^>\s+/gm, '')           // blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .trim();

  const firstPara = plain.split(/\n\n+/)[0].trim();
  if (firstPara.length <= maxLen) return firstPara;
  return firstPara.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

/* ── Data Loading ─────────────────────────────────────── */

async function loadWritings() {
  try {
    // Cache-bust so new writings appear promptly
    const res = await fetch(DATA_URL + '?v=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data.writings) ? data.writings : [];
  } catch (e) {
    console.error('Could not load writings.json:', e);
    return [];
  }
}

/* ── Index Page ───────────────────────────────────────── */

async function renderIndex() {
  const container = document.getElementById('writings-container');
  if (!container) return;

  const writings = await loadWritings();

  if (!writings.length) {
    container.innerHTML =
      '<p style="text-align:center;color:var(--text-light);font-style:italic;padding:2rem 0;">No writings yet — check back soon.</p>';
    return;
  }

  // Reverse chronological order (newest first)
  writings.sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  container.innerHTML = writings.map(w => {
    const excerpt = escHtml(getExcerpt(w.content));
    return `
      <a href="writing.html?slug=${encodeURIComponent(w.slug)}" class="writing-card">
        <div class="card-date">${escHtml(w.date)}</div>
        <h3 class="card-title">${escHtml(w.title)}</h3>
        <div class="card-scripture">
          <span>${escHtml(w.scriptureText)}</span>
          <span style="white-space:nowrap;color:var(--text-light);font-size:0.875rem;">— ${escHtml(w.scriptureRef)}</span>
        </div>
        <p class="card-excerpt">${excerpt}</p>
        <span class="read-more">Read More →</span>
      </a>`;
  }).join('');
}

/* ── Writing Page ─────────────────────────────────────── */

async function renderWriting() {
  const article = document.getElementById('writing-article');
  if (!article) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    window.location.href = 'index.html';
    return;
  }

  const writings = await loadWritings();
  const writing = writings.find(w => w.slug === slug);

  if (!writing) {
    article.innerHTML = `
      <div class="not-found">
        <h2>Writing Not Found</h2>
        <p>This writing may have moved or the link may be incorrect.</p>
        <a href="index.html" class="btn">← Back to All Writings</a>
      </div>`;
    return;
  }

  // Update page title and meta description
  document.title = writing.title + ' – In His Word';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', writing.scriptureText + ' — ' + writing.scriptureRef);

  // Configure marked
  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    html: true   // allow <div class="poem"> etc.
  });

  const renderedContent = marked.parse(writing.content);

  article.innerHTML = `
    <div class="writing-header">
      <div class="writing-date">${escHtml(writing.date)}</div>
      <h1 class="writing-title">${escHtml(writing.title)}</h1>
      <div class="main-scripture">
        <p>${escHtml(writing.scriptureText)}</p>
        <span class="scripture-ref">— ${escHtml(writing.scriptureRef)}</span>
      </div>
    </div>

    <div class="divider"><span class="divider-icon">✦</span></div>

    <div class="writing-content">
      ${renderedContent}
    </div>`;

  // Load Giscus comments after the writing is known, using the slug
  // as the specific discussion term so each writing has its own thread
  const commentsWidget = document.getElementById('comments-widget');
  if (commentsWidget) {
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.setAttribute('data-repo', 'averyd308/faith-writings');
    s.setAttribute('data-repo-id', 'R_kgDORdfs0Q');
    s.setAttribute('data-category', 'General');
    s.setAttribute('data-category-id', 'DIC_kwDORdfs0c4C3nJ7');
    s.setAttribute('data-mapping', 'specific');
    s.setAttribute('data-term', writing.slug);
    s.setAttribute('data-strict', '0');
    s.setAttribute('data-reactions-enabled', '1');
    s.setAttribute('data-emit-metadata', '0');
    s.setAttribute('data-input-position', 'bottom');
    s.setAttribute('data-theme', 'preferred_color_scheme');
    s.setAttribute('data-lang', 'en');
    s.setAttribute('crossorigin', 'anonymous');
    s.async = true;
    commentsWidget.appendChild(s);
  }
}

/* ── Init ─────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('writings-container')) renderIndex();
  if (document.getElementById('writing-article'))     renderWriting();
});
