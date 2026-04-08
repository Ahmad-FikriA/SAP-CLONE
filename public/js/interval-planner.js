/* ─── Interval Year Planner ─── */

const INTERVALS = ['1wk', '2wk', '3wk', '4wk', '8wk', '12wk', '16wk', '24wk'];

let savedSet   = {};   // reflects what's in the DB
let currentSet = {};   // reflects current UI state (may have unsaved changes)
let currentYear = new Date().getFullYear();

// ── Date helpers ──────────────────────────────────────────────────────────────

function getISOWeekDateRange(week, year) {
  const jan4    = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Mon);
  start.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

function fmtShort(d) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function getISOWeeksInYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const day   = dec28.getUTCDay() || 7;
  const thu   = new Date(dec28);
  thu.setUTCDate(dec28.getUTCDate() + (4 - day));
  return thu.getUTCFullYear() === year ? 53 : 52;
}

function getMonthName(d) {
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function getCurrentISOWeek() {
  const now     = new Date();
  const jan4    = new Date(now.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const diff    = Math.floor((now - jan4) / 86400000) + (jan4Day - 1);
  return Math.min(53, Math.max(1, Math.ceil((diff + 1) / 7)));
}

function cellKey(year, week, interval) {
  return year + '-' + week + '-' + interval;
}

// ── Dirty state ───────────────────────────────────────────────────────────────

function isDirty() {
  const savedKeys   = Object.keys(savedSet).sort();
  const currentKeys = Object.keys(currentSet).sort();
  if (savedKeys.length !== currentKeys.length) return true;
  return savedKeys.some(function(k, i) { return k !== currentKeys[i]; });
}

function countDiff() {
  const toAdd    = Object.keys(currentSet).filter(function(k) { return !savedSet[k]; });
  const toRemove = Object.keys(savedSet).filter(function(k) { return !currentSet[k]; });
  return { toAdd, toRemove };
}

function updateUnsavedBar() {
  const bar     = document.getElementById('unsavedBar');
  const counter = document.getElementById('unsavedCounter');
  if (!bar) return;

  if (!isDirty()) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  const { toAdd, toRemove } = countDiff();
  const parts = [];
  if (toAdd.length)    parts.push('+' + toAdd.length + ' diaktifkan');
  if (toRemove.length) parts.push('-' + toRemove.length + ' dinonaktifkan');
  if (counter) counter.textContent = parts.join(', ');
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadYear(year) {
  const loadEl = document.getElementById('loadingBadge');
  if (loadEl) { loadEl.style.display = 'inline'; loadEl.textContent = 'Memuat...'; }

  try {
    const data = await apiGet('/preventive-schedule/year?year=' + year);
    savedSet   = {};
    for (const row of (data.schedule || [])) {
      for (const iv of (row.intervals || [])) {
        savedSet[cellKey(year, row.week, iv)] = true;
      }
    }
    // Reset pending state to match saved
    currentSet = Object.assign({}, savedSet);
    renderGrid(year);
    updateUnsavedBar();
  } catch (e) {
    showMessage('Gagal memuat jadwal: ' + (e.message || e), 'error');
  } finally {
    if (loadEl) loadEl.style.display = 'none';
  }
}

// ── Render grid ───────────────────────────────────────────────────────────────

function renderGrid(year) {
  const container = document.getElementById('gridContainer');
  if (!container) return;

  const totalWeeks  = getISOWeeksInYear(year);
  const currentWeek = (year === new Date().getFullYear()) ? getCurrentISOWeek() : -1;

  const table = document.createElement('table');
  table.className = 'planner-table';

  // ── THEAD ──
  const thead     = document.createElement('thead');
  const headerRow = document.createElement('tr');

  function th(text, cls) {
    const el = document.createElement('th');
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  headerRow.appendChild(th('Minggu', 'col-week'));
  headerRow.appendChild(th('Tanggal', 'col-date'));
  INTERVALS.forEach(function(iv) { headerRow.appendChild(th(iv, 'col-iv')); });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ── TBODY ──
  const tbody   = document.createElement('tbody');
  let lastMonth = null;

  for (let w = 1; w <= totalWeeks; w++) {
    const { start, end } = getISOWeekDateRange(w, year);
    const monthLabel = getMonthName(start);

    if (monthLabel !== lastMonth) {
      lastMonth = monthLabel;
      const sepRow = document.createElement('tr');
      sepRow.className = 'month-sep';
      const sepTd = document.createElement('td');
      sepTd.colSpan = 2 + INTERVALS.length;
      sepTd.textContent = monthLabel;
      sepRow.appendChild(sepTd);
      tbody.appendChild(sepRow);
    }

    const tr = document.createElement('tr');
    tr.dataset.week = w;
    if (w === currentWeek) tr.classList.add('current-week');

    const weekTd = document.createElement('td');
    weekTd.className = 'cell-week';
    weekTd.textContent = w;
    tr.appendChild(weekTd);

    const dateTd = document.createElement('td');
    dateTd.className = 'cell-date';
    dateTd.textContent = fmtShort(start) + ' \u2013 ' + fmtShort(end);
    tr.appendChild(dateTd);

    INTERVALS.forEach(function(iv) {
      const td = document.createElement('td');
      td.className = 'cell-iv';
      td.dataset.week     = w;
      td.dataset.interval = iv;

      const key = cellKey(year, w, iv);
      if (currentSet[key]) td.classList.add('active');
      // "changed from saved" indicator
      if (!!currentSet[key] !== !!savedSet[key]) td.classList.add('changed');

      td.addEventListener('click', function() { onCellClick(td, year, w, iv); });
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.textContent = '';
  container.appendChild(table);

  updateStats(year, totalWeeks);
}

// ── Cell click (no API call — just update UI state) ───────────────────────────

function onCellClick(td, year, week, interval) {
  const key       = cellKey(year, week, interval);
  const nowActive = !td.classList.contains('active');

  td.classList.toggle('active', nowActive);
  if (nowActive) { currentSet[key] = true; } else { delete currentSet[key]; }

  // Mark/unmark "changed from saved" visually
  const wasInSaved = !!savedSet[key];
  td.classList.toggle('changed', nowActive !== wasInSaved);

  updateStats(year, getISOWeeksInYear(year));
  updateUnsavedBar();
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveChanges() {
  if (!isDirty()) return;

  const saveBtn    = document.getElementById('btnSave');
  const discardBtn = document.getElementById('btnDiscard');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...'; }
  if (discardBtn) discardBtn.disabled = true;

  const { toAdd, toRemove } = countDiff();
  const allChanges = [
    ...toAdd.map(function(k)    { return { key: k, active: true  }; }),
    ...toRemove.map(function(k) { return { key: k, active: false }; }),
  ];

  let failed = 0;
  for (const change of allChanges) {
    // key format: "year-week-interval"  e.g. "2026-15-4wk"
    const parts    = change.key.split('-');
    const year     = parseInt(parts[0], 10);
    const week     = parseInt(parts[1], 10);
    const interval = parts.slice(2).join('-');

    try {
      await apiPost('/preventive-schedule/toggle', { year, week, interval });
      if (change.active) { savedSet[change.key] = true; }
      else               { delete savedSet[change.key]; }
    } catch (e) {
      failed++;
    }
  }

  if (failed > 0) {
    showMessage(failed + ' perubahan gagal disimpan.', 'error');
  } else {
    showMessage('Jadwal berhasil disimpan');
  }

  // Re-render to clear "changed" markers
  renderGrid(currentYear);
  updateUnsavedBar();

  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Simpan'; }
  if (discardBtn) discardBtn.disabled = false;
}

// ── Discard ───────────────────────────────────────────────────────────────────

function discardChanges() {
  if (!isDirty()) return;
  if (!confirm('Buang semua perubahan yang belum disimpan?')) return;
  currentSet = Object.assign({}, savedSet);
  renderGrid(currentYear);
  updateUnsavedBar();
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function updateStats(year, totalWeeks) {
  const statsEl = document.getElementById('statsBar');
  if (!statsEl) return;

  const counts = {};
  INTERVALS.forEach(function(iv) { counts[iv] = 0; });

  Object.keys(currentSet).forEach(function(key) {
    const prefix  = year + '-';
    if (!key.startsWith(prefix)) return;
    const rest    = key.slice(prefix.length);
    const dashIdx = rest.indexOf('-');
    const iv      = rest.slice(dashIdx + 1);
    if (counts[iv] !== undefined) counts[iv]++;
  });

  statsEl.textContent = '';
  INTERVALS.forEach(function(iv) {
    const chip   = document.createElement('span');
    chip.className = 'stats-chip';
    const strong = document.createElement('strong');
    strong.textContent = iv;
    chip.appendChild(strong);
    chip.appendChild(document.createTextNode('\u00a0' + counts[iv] + '\u00a0minggu'));
    statsEl.appendChild(chip);
  });
}

// ── Toolbar: auto-fill ────────────────────────────────────────────────────────

async function autoFill() {
  if (isDirty()) {
    if (!confirm('Ada perubahan yang belum disimpan. Auto-fill akan menimpa tampilan saat ini. Lanjutkan?')) return;
  } else {
    if (!confirm('Auto-fill jadwal ' + currentYear + ' menggunakan formula (week-1) % N = 0?\nIni menimpa jadwal yang ada di database.')) return;
  }

  const btn = document.getElementById('btnAutoFill');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

  try {
    await apiPost('/preventive-schedule/generate', { year: currentYear, overwrite: true });
    await loadYear(currentYear);
    showMessage('Jadwal ' + currentYear + ' berhasil di-generate dari formula');
  } catch (e) {
    showMessage('Gagal generate: ' + (e.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Auto-fill formula'; }
  }
}

// ── Toolbar: clear ────────────────────────────────────────────────────────────

async function clearAll() {
  if (!confirm('Hapus SEMUA jadwal tahun ' + currentYear + '? Tindakan ini tidak bisa dibatalkan.')) return;

  const btn = document.getElementById('btnClear');
  if (btn) { btn.disabled = true; btn.textContent = 'Menghapus...'; }

  try {
    await apiDelete('/preventive-schedule?year=' + currentYear);
    savedSet   = {};
    currentSet = {};
    renderGrid(currentYear);
    updateUnsavedBar();
    showMessage('Jadwal ' + currentYear + ' berhasil dihapus');
  } catch (e) {
    showMessage('Gagal menghapus: ' + (e.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Hapus semua'; }
  }
}

function onYearChange() {
  if (isDirty()) {
    if (!confirm('Ada perubahan yang belum disimpan. Ganti tahun akan membuang perubahan tersebut. Lanjutkan?')) {
      // Revert year selector
      const sel = document.getElementById('yearSel');
      if (sel) sel.value = currentYear;
      return;
    }
  }
  const sel = document.getElementById('yearSel');
  if (!sel) return;
  currentYear = parseInt(sel.value, 10);
  loadYear(currentYear);
}

// ── Init ──────────────────────────────────────────────────────────────────────

(function init() {
  const sel      = document.getElementById('yearSel');
  const thisYear = new Date().getFullYear();
  [thisYear - 1, thisYear, thisYear + 1].forEach(function(y) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    if (y === thisYear) opt.selected = true;
    sel.appendChild(opt);
  });
  currentYear = thisYear;
  loadYear(thisYear);

  // Warn on page leave if unsaved
  window.addEventListener('beforeunload', function(e) {
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
