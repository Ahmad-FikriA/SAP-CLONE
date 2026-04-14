/* ─── KTI SmartCare Admin UI — Shared Utilities ─── */

window.API_BASE = '/api';

// ══════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════

function getToken() {
  return localStorage.getItem('token') || '';
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch (e) { return null; }
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function logout() {
  clearAuth();
  window.location.href = '/pages/login.html';
}

/**
 * Check token presence and expiry (client-side decode, no signature check).
 * Redirects to login if missing or expired. Returns true if valid.
 */
function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = '/pages/login.html';
    return false;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearAuth();
      window.location.href = '/pages/login.html';
      return false;
    }
  } catch (e) {
    clearAuth();
    window.location.href = '/pages/login.html';
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════
// HTTP HELPERS
// ══════════════════════════════════════════════════

async function apiFetch(path, options = {}) {
  const res = await fetch(`${window.API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/pages/login.html';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
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
// SIDEBAR NAV — single source of truth
// ══════════════════════════════════════════════════

const _NAV = [
  { href: '/',                              label: 'Dashboard',       icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
  { href: '/pages/spk.html',               label: 'SPK',             icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 13h6|M9 17h6' },
  { href: '/pages/spk-import.html', label: 'Import SAP', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12' },
  { href: '/pages/lembar-kerja.html',      label: 'Lembar Kerja',    icon: 'M9 11l3 3L22 4|M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { divider: true },
  { href: '/pages/equipment.html',         label: 'Equipment',       icon: 'circle:12,12,3|M19.07 4.93a10 10 0 0 1 0 14.14|M4.93 4.93a10 10 0 0 0 0 14.14' },
  { href: '/pages/task-lists.html',        label: 'Task Lists',      icon: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01' },
  { href: '/pages/maps.html',              label: 'Maps',            icon: 'M1 6l7-4 8 4 7-4v16l-7 4-8-4-7 4V6z|M8 2v16|M16 6v16' },
  { href: '/pages/users.html',             label: 'Users',           icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|circle:9,7,4|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75' },
  { href: '/pages/equipment-mappings.html',label: 'Task Mapping',    icon: 'M9 17H7A5 5 0 0 1 7 7h2|M15 7h2a5 5 0 0 1 0 10h-2|M8 12h8' },
  { href: '/pages/interval-planner.html',  label: 'Interval Planner',icon: 'rect:3,4,18,18,2|M16 2v4|M8 2v4|M3 10h18' },
  { divider: true },
  { href: '/pages/submissions.html',       label: 'Submissions',     icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
];

function _buildSidebar() {
  const navEl = document.querySelector('.sidebar__nav');
  if (!navEl) return;
  navEl.textContent = '';

  const path = window.location.pathname;

  _NAV.forEach(function(item) {
    if (item.divider) {
      const div = document.createElement('div');
      div.className = 'sidebar__divider';
      navEl.appendChild(div);
      return;
    }

    const a = document.createElement('a');
    a.href = item.href;
    a.className = 'nav-item';

    // Active: exact match for root, endsWith for pages
    const isActive = item.href === '/'
      ? (path === '/' || path === '/index.html')
      : path.endsWith(item.href.replace('/pages/', ''));
    if (isActive) a.classList.add('active');

    // SVG icon — built from a mini descriptor string
    a.appendChild(_makeNavIcon(item.icon));

    const span = document.createElement('span');
    span.textContent = item.label;
    a.appendChild(span);

    navEl.appendChild(a);
  });
}

function _makeNavIcon(descriptor) {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');

  descriptor.split('|').forEach(function(seg) {
    if (seg.startsWith('circle:')) {
      const parts = seg.slice(7).split(',');
      const el = document.createElementNS(ns, 'circle');
      el.setAttribute('cx', parts[0]); el.setAttribute('cy', parts[1]); el.setAttribute('r', parts[2]);
      svg.appendChild(el);
    } else if (seg.startsWith('rect:')) {
      const parts = seg.slice(5).split(',');
      const el = document.createElementNS(ns, 'rect');
      el.setAttribute('x', parts[0]); el.setAttribute('y', parts[1]);
      el.setAttribute('width', parts[2]); el.setAttribute('height', parts[3]);
      if (parts[4]) { el.setAttribute('rx', parts[4]); el.setAttribute('ry', parts[4]); }
      svg.appendChild(el);
    } else if (seg.startsWith('M') || seg.startsWith('m')) {
      const el = document.createElementNS(ns, 'path');
      el.setAttribute('d', seg);
      svg.appendChild(el);
    } else {
      // Treat as individual lines separated by commas: x1,y1,x2,y2
      const el = document.createElementNS(ns, 'line');
      const p  = seg.split(',');
      el.setAttribute('x1', p[0]); el.setAttribute('y1', p[1]);
      el.setAttribute('x2', p[2]); el.setAttribute('y2', p[3]);
      svg.appendChild(el);
    }
  });

  return svg;
}

// ══════════════════════════════════════════════════
// SIDEBAR TOGGLE + AUTH GUARD + SHELL BAR
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Skip auth guard on the login page itself
  const isLoginPage = window.location.pathname.endsWith('/login.html');
  if (!isLoginPage) {
    if (!requireAuth()) return; // redirects if not authed
    _buildSidebar();
    _populateShellBar();
  }

  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar   = document.getElementById('sidebar');
  const layout    = document.getElementById('layout');
  const msgStrip  = document.getElementById('messageStrip');

  const COLLAPSED_KEY = 'sidebar_collapsed';
  if (sidebar && layout && localStorage.getItem(COLLAPSED_KEY) === '1') {
    sidebar.classList.add('collapsed');
    layout.classList.add('sidebar-collapsed');
    if (msgStrip) msgStrip.style.left = 'var(--sidebar-collapsed)';
  }

  if (toggleBtn && sidebar && layout) {
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

function _populateShellBar() {
  const user      = getUser();
  const actionsEl = document.querySelector('.shell-bar__actions');
  if (!actionsEl) return;

  actionsEl.textContent = '';

  if (user) {
    // Name label
    const nameEl       = document.createElement('span');
    nameEl.style.cssText = 'font-size:12px;color:rgba(255,255,255,.75);margin-right:4px;white-space:nowrap';
    nameEl.textContent = user.name || user.nik || '';
    actionsEl.appendChild(nameEl);

    // Avatar with initials
    const avatarEl       = document.createElement('div');
    avatarEl.className   = 'shell-bar__avatar';
    const initials = (user.name || user.nik || 'U')
      .split(' ').slice(0, 2).map(function(w) { return w[0]; }).join('').toUpperCase();
    avatarEl.textContent = initials;
    actionsEl.appendChild(avatarEl);
  }

  // Logout button
  const logoutBtn       = document.createElement('button');
  logoutBtn.title       = 'Logout';
  logoutBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:rgba(255,255,255,.7);padding:4px 6px;border-radius:4px;display:flex;align-items:center;transition:color .15s';
  logoutBtn.addEventListener('mouseenter', function() { this.style.color = '#fff'; });
  logoutBtn.addEventListener('mouseleave', function() { this.style.color = 'rgba(255,255,255,.7)'; });
  logoutBtn.addEventListener('click', logout);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p1.setAttribute('d', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4');
  const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  p2.setAttribute('points', '16 17 21 12 16 7');
  const p3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  p3.setAttribute('x1', '21'); p3.setAttribute('y1', '12'); p3.setAttribute('x2', '9'); p3.setAttribute('y2', '12');
  svg.appendChild(p1); svg.appendChild(p2); svg.appendChild(p3);
  logoutBtn.appendChild(svg);
  actionsEl.appendChild(logoutBtn);
}

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

