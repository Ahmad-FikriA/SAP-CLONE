/* ─── KTI SmartCare Admin UI — Shared Utilities ─── */

window.API_BASE = '/api';

// ══════════════════════════════════════════════════
// AUTH — auto-login as admin_01 so token is always fresh
// ══════════════════════════════════════════════════
function getToken() {
  return localStorage.getItem('admin_token') || '';
}
function setToken(t) {
  localStorage.setItem('admin_token', t);
}

async function fetchFreshToken() {
  try {
    const res = await fetch(`${window.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nik: '100001', password: 'password123' })
    });
    const data = await res.json();
    if (data.token) setToken(data.token);
  } catch (e) { console.error('[fetchFreshToken]', e); }
}

async function ensureToken() {
  if (!getToken()) await fetchFreshToken();
}

// ══════════════════════════════════════════════════
// HTTP HELPERS
// ══════════════════════════════════════════════════

async function apiFetch(path, options = {}, _retry = true) {
  await ensureToken();
  const res = await fetch(`${window.API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  });

  // Token expired — clear it, get a fresh one, retry once
  if (res.status === 401 && _retry) {
    localStorage.removeItem('admin_token');
    await fetchFreshToken();
    return apiFetch(path, options, false);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

function apiGet(path) { return apiFetch(path); }

function apiPost(path, body) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

function apiPut(path, body) {
  return apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
}

function apiDelete(path) {
  return apiFetch(path, { method: 'DELETE' });
}

// ══════════════════════════════════════════════════
// SIDEBAR TOGGLE
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const layout = document.getElementById('layout');
  const msgStrip = document.getElementById('messageStrip');

  const COLLAPSED_KEY = 'sidebar_collapsed';
  if (localStorage.getItem(COLLAPSED_KEY) === '1') {
    sidebar.classList.add('collapsed');
    layout.classList.add('sidebar-collapsed');
    if (msgStrip) msgStrip.style.left = 'var(--sidebar-collapsed)';
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      layout.classList.toggle('sidebar-collapsed', isCollapsed);
      if (msgStrip) {
        msgStrip.style.left = isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';
      }
      localStorage.setItem(COLLAPSED_KEY, isCollapsed ? '1' : '0');
    });
  }
});

// ══════════════════════════════════════════════════
// MESSAGE STRIP (Toast)
// ══════════════════════════════════════════════════
let _msgTimer = null;

function showMessage(text, type = 'success') {
  const strip = document.getElementById('messageStrip');
  const textEl = document.getElementById('messageText');
  if (!strip || !textEl) return;
  strip.className = `message-strip ${type} show`;
  textEl.textContent = (type === 'success' ? '✓  ' : '✕  ') + text;
  if (_msgTimer) clearTimeout(_msgTimer);
  _msgTimer = setTimeout(hideMessage, 4000);
}

function hideMessage() {
  const strip = document.getElementById('messageStrip');
  if (strip) strip.classList.remove('show');
}

// ══════════════════════════════════════════════════
// PANEL OPEN / CLOSE
// ══════════════════════════════════════════════════
function openPanel() {
  document.getElementById('overlay').classList.add('show');
  document.getElementById('panel').classList.add('show');
}

function closePanel() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('panel').classList.remove('show');
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatPeriod(start, end) {
  if (!start) return '—';
  const s = new Date(start);
  const e = new Date(end);
  const fmt = d => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}`;
}

function statusBadge(status) {
  const map = {
    pending: 'badge-pending',
    in_progress: 'badge-in_progress',
    completed: 'badge-completed',
    error: 'badge-error'
  };
  const label = {
    pending: 'On Progress', in_progress: 'On Progress',
    completed: 'Selesai', approved: 'Disetujui',
    awaiting_kasie: 'Menunggu Kasie', awaiting_kadis_perawatan: 'Menunggu Kadis Perawatan',
    awaiting_kadis: 'Menunggu Kadis', error: 'Error'
  };
  const fullMap = Object.assign({ awaiting_kasie: 'badge-in_progress', awaiting_kadis_perawatan: 'badge-in_progress', awaiting_kadis: 'badge-in_progress', approved: 'badge-completed' }, map);
  return `<span class="badge ${fullMap[status] || 'badge-pending'}">${label[status] || status}</span>`;
}

function roleBadge(role) {
  const colors = {
    teknisi: '#0070D2', planner: '#6610f2', supervisor: '#B07800',
    manager: '#1A7F4B', admin: '#BB0000'
  };
  const c = colors[role] || '#6C757D';
  return `<span class="badge" style="background:${c}22;color:${c}">${role}</span>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// NOTE: Do NOT define a custom `confirm()` here — it shadows
// the native window.confirm and causes infinite recursion.

// ══════════════════════════════════════════════════
// BULK SELECT HELPERS
// ══════════════════════════════════════════════════

/**
 * Get IDs of all checked rows.
 * @param {string} name – checkbox name attribute (default 'bulk')
 */
function getCheckedIds(name) {
  name = name || 'bulk';
  return Array.from(document.querySelectorAll('input[name="' + name + '"]:checked'))
    .map(function (cb) { return cb.value; });
}

/**
 * "Select All" checkbox handler — toggles all row checkboxes.
 */
function toggleSelectAll(source, name) {
  name = name || 'bulk';
  var cbs = document.querySelectorAll('input[name="' + name + '"]');
  cbs.forEach(function (cb) { cb.checked = source.checked; });
  updateBulkBar(name);
}

/**
 * Show / hide the floating bulk-action bar.
 * barId defaults to 'bulkBar'. Call after any checkbox changes.
 */
function updateBulkBar(name, barId) {
  name = name || 'bulk';
  barId = barId || 'bulkBar';
  var ids = getCheckedIds(name);
  var bar = document.getElementById(barId);
  if (!bar) return;
  var countEl = bar.querySelector('.bulk-bar__count');
  if (countEl) countEl.textContent = ids.length + ' dipilih';
  if (ids.length > 0) {
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
  // Update "select all" checkbox state
  var all = document.querySelectorAll('input[name="' + name + '"]');
  var selectAll = document.getElementById('selectAll');
  if (selectAll && all.length) {
    selectAll.checked = ids.length === all.length;
    selectAll.indeterminate = ids.length > 0 && ids.length < all.length;
  }
}

