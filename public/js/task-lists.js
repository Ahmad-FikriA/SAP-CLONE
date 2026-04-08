/* ─── Task Lists Page ─── */

let allTaskLists = [];

const CAT_COLORS = {
  Mekanik:  { bg: '#e8f0fe', text: '#1a56db' },
  Listrik:  { bg: '#fef3c7', text: '#92400e' },
  Sipil:    { bg: '#dcfce7', text: '#166534' },
  Otomasi:  { bg: '#fce7f3', text: '#9d174d' },
};

// ── Load ─────────────────────────────────────────────────────────────────────

async function loadTaskLists() {
  try {
    allTaskLists = await apiGet('/task-lists');
    renderTable();
  } catch (e) {
    const tbody = document.getElementById('tableBody');
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.cssText = 'text-align:center;color:var(--error,#c00);padding:24px';
    td.textContent = e.message;
    tr.appendChild(td);
    tbody.textContent = '';
    tbody.appendChild(tr);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderTable() {
  const q      = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const cat    = document.getElementById('filterCategory').value;
  const tbody  = document.getElementById('tableBody');

  const filtered = allTaskLists.filter(function(tl) {
    const matchCat = !cat || tl.category === cat;
    const matchQ   = !q || tl.taskListId.toLowerCase().includes(q) || tl.taskListName.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  document.getElementById('countBadge').textContent =
    filtered.length + ' dari ' + allTaskLists.length + ' task list';

  tbody.textContent = '';

  if (!filtered.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.cssText = 'text-align:center;color:var(--text-muted);padding:32px';
    td.textContent = allTaskLists.length === 0
      ? 'Belum ada task list — import Excel untuk memulai'
      : 'Tidak ada data yang cocok';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach(function(tl) {
    const acts  = tl.activities || [];
    const rowId = 'tl_' + tl.taskListId.replace(/[^a-z0-9]/gi, '_');
    const cc    = CAT_COLORS[tl.category] || { bg: '#f3f4f6', text: '#374151' };

    // ── Main row ──────────────────────────────────────────────────────────
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', function() { toggleDetail(rowId); });

    // chevron cell
    const tdChev = document.createElement('td');
    tdChev.style.cssText = 'width:32px;padding:8px 6px 8px 12px';
    const svg   = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id      = 'chev_' + rowId;
    svg.setAttribute('width', '12'); svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.5');
    svg.style.transition = 'transform .15s';
    const poly  = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '6 9 12 15 18 9');
    svg.appendChild(poly);
    tdChev.appendChild(svg);

    const tdId = document.createElement('td');
    tdId.style.cssText = 'font-family:monospace;font-size:12px;font-weight:600;color:var(--text-base)';
    tdId.textContent   = tl.taskListId;

    const tdName = document.createElement('td');
    tdName.style.cssText = 'font-size:13px;font-weight:500';
    tdName.textContent   = tl.taskListName;

    const tdCat   = document.createElement('td');
    const badge   = document.createElement('span');
    badge.style.cssText = 'padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;background:'
      + cc.bg + ';color:' + cc.text;
    badge.textContent = tl.category;
    tdCat.appendChild(badge);

    const tdWc = document.createElement('td');
    tdWc.style.cssText = 'font-size:12px;color:var(--text-muted)';
    tdWc.textContent   = tl.workCenter || '—';

    const tdAct = document.createElement('td');
    tdAct.style.cssText = 'font-size:12px;color:var(--text-muted)';
    tdAct.textContent   = acts.length + ' aktivitas';

    tr.appendChild(tdChev);
    tr.appendChild(tdId);
    tr.appendChild(tdName);
    tr.appendChild(tdCat);
    tr.appendChild(tdWc);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);

    // ── Activity detail row (collapsed) ──────────────────────────────────
    const detailTr = document.createElement('tr');
    detailTr.id    = rowId;
    detailTr.style.display = 'none';

    const detailTd     = document.createElement('td');
    detailTd.colSpan   = 6;
    detailTd.style.cssText = 'padding:0;background:#f8fbff;border-top:none';

    const inner = document.createElement('div');
    inner.style.cssText = 'padding:10px 16px 14px 44px';

    if (acts.length) {
      acts.forEach(function(act) {
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:10px;padding:4px 0;font-size:12px;border-bottom:1px solid #eef2ff';

        const num = document.createElement('span');
        num.style.cssText = 'color:var(--text-muted);min-width:24px;flex-shrink:0';
        num.textContent   = act.stepNumber + '.';

        const txt = document.createElement('span');
        txt.textContent = act.operationText;

        line.appendChild(num);
        line.appendChild(txt);
        inner.appendChild(line);
      });
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:12px;color:var(--text-muted);font-style:italic';
      empty.textContent   = 'Tidak ada aktivitas';
      inner.appendChild(empty);
    }

    detailTd.appendChild(inner);
    detailTr.appendChild(detailTd);
    tbody.appendChild(detailTr);
  });
}

// ── Toggle expand ─────────────────────────────────────────────────────────────

function toggleDetail(rowId) {
  const detailRow = document.getElementById(rowId);
  const chev      = document.getElementById('chev_' + rowId);
  if (!detailRow) return;
  const isOpen = detailRow.style.display !== 'none';
  detailRow.style.display = isOpen ? 'none' : 'table-row';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ── Import Excel ──────────────────────────────────────────────────────────────

async function importTaskListExcel(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const fd = new FormData();
  fd.append('file', file);

  showMessage('Mengimport ' + file.name + '...');
  try {
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/task-lists/import-excel', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import gagal');
    showMessage(data.message || ('Import selesai: ' + data.imported + ' task list'));
    if (data.errors && data.errors.length) {
      console.warn('Import warnings:', data.errors);
    }
    loadTaskLists();
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadTaskLists();
