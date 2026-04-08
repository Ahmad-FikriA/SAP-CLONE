/* ─── SPK Generate Page ─── */

let availableEquipment = [];
let availableMappings  = [];
let currentCategory    = null;
let activeIntervals    = [];

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekDateRange(week, year) {
  const jan4     = new Date(year, 0, 4);
  const jan4Day  = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - (jan4Day - 1));
  const start = new Date(week1Mon);
  start.setDate(week1Mon.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function fmtDateId(d) {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function localDateStr(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function getCurrentISOWeek() {
  const now     = new Date();
  const jan4    = new Date(now.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const diff    = Math.floor((now - jan4) / 86400000) + (jan4Day - 1);
  return Math.min(53, Math.max(1, Math.ceil((diff + 1) / 7)));
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initYearWeek() {
  const curYear = new Date().getFullYear();
  const yearEl  = document.getElementById('f_year');
  const weekEl  = document.getElementById('f_week');

  for (var y = curYear - 2; y <= curYear + 10; y++) {
    const opt      = document.createElement('option');
    opt.value      = y;
    opt.textContent = y;
    if (y === curYear) opt.selected = true;
    yearEl.appendChild(opt);
  }

  for (var w = 1; w <= 53; w++) {
    const opt      = document.createElement('option');
    opt.value      = w;
    opt.textContent = w;
    if (w === getCurrentISOWeek()) opt.selected = true;
    weekEl.appendChild(opt);
  }
}

// ── Category selection ─────────────────────────────────────────────────────────

async function selectCategory(cat) {
  currentCategory = cat;

  document.querySelectorAll('.cat-card').forEach(function(card) {
    card.classList.toggle('active', card.dataset.cat === cat);
  });

  try {
    const res          = await apiGet('/equipment?category=' + encodeURIComponent(cat) + '&limit=9999');
    availableEquipment = res.data || res;
  } catch (e) {
    availableEquipment = [];
  }

  if (!availableMappings.length) {
    try {
      availableMappings = await apiGet('/equipment-mappings');
    } catch (e) {
      availableMappings = [];
    }
  }

  updateEquipTitle();
  renderEquipmentList();
  updateFooter();
}

// ── Week / interval ───────────────────────────────────────────────────────────

async function onWeekChange() {
  const yearEl   = document.getElementById('f_year');
  const weekEl   = document.getElementById('f_week');
  const rangeEl  = document.getElementById('f_weekRange');
  const chipsEl  = document.getElementById('f_intervalChips');
  const hiddenEl = document.getElementById('f_weekStart');

  const year = parseInt(yearEl.value, 10);
  const week = parseInt(weekEl.value, 10);
  const { start, end } = getWeekDateRange(week, year);

  if (rangeEl) rangeEl.textContent = fmtDateId(start) + ' \u2013 ' + fmtDateId(end);
  if (hiddenEl) hiddenEl.value = localDateStr(start);

  activeIntervals = [];

  if (chipsEl) {
    chipsEl.textContent = '';
    const loadSpan         = document.createElement('span');
    loadSpan.style.cssText = 'font-size:12px;color:var(--text-muted)';
    loadSpan.textContent   = 'Memuat...';
    chipsEl.appendChild(loadSpan);
  }

  try {
    const data      = await apiGet('/preventive-schedule?year=' + year + '&week=' + week);
    activeIntervals = data.activeIntervals || [];

    if (chipsEl) {
      chipsEl.textContent = '';
      if (!activeIntervals.length) {
        const msg          = document.createElement('span');
        msg.style.cssText  = 'font-size:12px;color:var(--text-muted)';
        msg.textContent    = 'Tidak ada jadwal untuk minggu ini';
        chipsEl.appendChild(msg);
      } else {
        activeIntervals.forEach(function(iv) {
          const chip         = document.createElement('span');
          chip.className     = 'status-badge';
          chip.style.cssText = 'background:var(--primary);color:#fff;font-size:11px';
          chip.textContent   = iv;
          chipsEl.appendChild(chip);
        });
      }
    }

    renderEquipmentList();
    updateFooter();
  } catch (e) {
    if (chipsEl) {
      chipsEl.textContent = '';
      const err           = document.createElement('span');
      err.style.color     = 'var(--error,#c00)';
      err.textContent     = 'Gagal memuat jadwal';
      chipsEl.appendChild(err);
    }
  }
}

// ── Equipment rendering ───────────────────────────────────────────────────────

function updateEquipTitle() {
  const titleEl = document.getElementById('equipTitle');
  if (!titleEl) return;
  if (!currentCategory) {
    titleEl.textContent = 'Pilih kategori untuk melihat equipment';
    return;
  }
  const weekEl = document.getElementById('f_week');
  const week   = weekEl ? weekEl.value : '—';
  titleEl.textContent = 'Equipment ' + currentCategory + ' \u2014 Minggu ' + week;
}

function makePlaceholder(text) {
  const ph    = document.createElement('div');
  ph.className = 'gen-placeholder';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '48');
  svg.setAttribute('height', '48');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '3');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14');
  svg.appendChild(circle); svg.appendChild(path);

  const p = document.createElement('p');
  p.textContent = text;

  ph.appendChild(svg);
  ph.appendChild(p);
  return ph;
}

function renderEquipmentList() {
  const body = document.getElementById('eqBody');
  if (!body) return;

  updateEquipTitle();
  body.textContent = '';

  if (!currentCategory) {
    body.appendChild(makePlaceholder('Pilih kategori dan minggu untuk memulai'));
    return;
  }

  if (!availableEquipment.length) {
    const ph       = document.createElement('div');
    ph.className   = 'gen-eq-empty';
    ph.textContent = 'Tidak ada equipment untuk kategori ' + currentCategory;
    body.appendChild(ph);
    updateCounter();
    return;
  }

  body.appendChild(buildSelectControls());

  // Track which equipment IDs have ANY active-interval mapping (to find truly unmapped)
  const anyMappedIds = new Set();

  // ── One section per active interval ──
  activeIntervals.forEach(function(iv) {
    const forInterval = availableMappings.filter(function(m) { return m.interval === iv; });
    const mappedIds   = new Set(forInterval.map(function(m) { return m.equipmentId; }));
    const mapped      = availableEquipment.filter(function(eq) { return mappedIds.has(eq.equipmentId); });

    if (!mapped.length) return;

    mapped.forEach(function(eq) { anyMappedIds.add(eq.equipmentId); });

    const hdr       = document.createElement('div');
    hdr.className   = 'gen-eq-group-header';
    hdr.textContent = 'Interval ' + iv + ' \u2014 ' + mapped.length + ' equipment';
    body.appendChild(hdr);

    const list     = document.createElement('div');
    list.className = 'gen-eq-list';
    mapped.forEach(function(eq) {
      const m          = forInterval.find(function(x) { return x.equipmentId === eq.equipmentId; });
      const activities = m ? (m.activities || []) : [];
      list.appendChild(buildEqRow(eq, true, m ? m.taskListName : null, activities, iv));
    });
    body.appendChild(list);
  });

  // ── Unmapped: equipment with no mapping for any active interval ──
  const unmapped = availableEquipment.filter(function(eq) { return !anyMappedIds.has(eq.equipmentId); });

  if (unmapped.length) {
    const toggleWrap         = document.createElement('div');
    toggleWrap.style.marginTop = anyMappedIds.size ? '8px' : '0';

    const toggleBtn     = document.createElement('button');
    toggleBtn.className = 'gen-unmapped-toggle';

    const toggleIcon    = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    toggleIcon.setAttribute('width', '12'); toggleIcon.setAttribute('height', '12');
    toggleIcon.setAttribute('viewBox', '0 0 24 24'); toggleIcon.setAttribute('fill', 'none');
    toggleIcon.setAttribute('stroke', 'currentColor'); toggleIcon.setAttribute('stroke-width', '2.5');
    const togglePath = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    togglePath.setAttribute('points', '9 18 15 12 9 6');
    toggleIcon.appendChild(togglePath);

    const toggleLabel       = document.createElement('span');
    toggleLabel.textContent = 'Tampilkan equipment tanpa mapping (' + unmapped.length + ')';

    toggleBtn.appendChild(toggleIcon);
    toggleBtn.appendChild(toggleLabel);
    toggleWrap.appendChild(toggleBtn);

    const unmappedBlock          = document.createElement('div');
    unmappedBlock.id             = 'unmappedBlock';
    unmappedBlock.style.display  = 'none';

    const hdr       = document.createElement('div');
    hdr.className   = 'gen-eq-group-header';
    hdr.textContent = 'Tanpa mapping (' + unmapped.length + ')';

    const list     = document.createElement('div');
    list.className = 'gen-eq-list';
    unmapped.forEach(function(eq) {
      list.appendChild(buildEqRow(eq, false, null, [], null));
    });

    unmappedBlock.appendChild(hdr);
    unmappedBlock.appendChild(list);
    toggleWrap.appendChild(unmappedBlock);

    toggleBtn.addEventListener('click', function() {
      const isOpen = unmappedBlock.style.display !== 'none';
      unmappedBlock.style.display = isOpen ? 'none' : 'block';
      togglePath.setAttribute('points', isOpen ? '9 18 15 12 9 6' : '9 6 15 12 9 18');
      toggleLabel.textContent = isOpen
        ? 'Tampilkan equipment tanpa mapping (' + unmapped.length + ')'
        : 'Sembunyikan equipment tanpa mapping';
    });

    body.appendChild(toggleWrap);
  }

  if (!anyMappedIds.size && !unmapped.length) {
    const ph       = document.createElement('div');
    ph.className   = 'gen-eq-empty';
    ph.textContent = 'Tidak ada equipment';
    body.appendChild(ph);
  }

  filterEquipment();
  updateCounter();
}

function buildSelectControls() {
  const wrap = document.createElement('div');
  wrap.className = 'gen-select-controls';

  const selAll         = document.createElement('button');
  selAll.textContent   = 'Pilih semua terpetakan';
  selAll.onclick       = function() {
    document.querySelectorAll('.gen-eq-row[data-mapped="1"]').forEach(function(row) {
      if (row.style.display !== 'none') {
        const cb = row.querySelector('input[name="equipment"]');
        if (cb) cb.checked = true;
      }
    });
    updateFooter();
  };

  const clrAll         = document.createElement('button');
  clrAll.textContent   = 'Kosongkan pilihan';
  clrAll.onclick       = function() {
    document.querySelectorAll('.gen-eq-row input[name="equipment"]').forEach(function(cb) {
      cb.checked = false;
    });
    updateFooter();
  };

  wrap.appendChild(selAll);
  wrap.appendChild(clrAll);
  return wrap;
}

// Builds a .gen-eq-row wrapper with clickable item row + collapsible activity detail panel.
function buildEqRow(eq, preChecked, taskListName, activities, interval) {
  const row         = document.createElement('div');
  row.className     = 'gen-eq-row';
  row.dataset.mapped    = taskListName ? '1' : '0';
  row.dataset.eqId      = eq.equipmentId;
  row.dataset.eqName    = (eq.equipmentId + ' ' + eq.equipmentName).toLowerCase();
  if (interval) row.dataset.interval = interval;

  // ── Clickable item row ──
  const item     = document.createElement('div');
  item.className = 'gen-eq-item';

  const cbId  = interval ? ('geq_' + eq.equipmentId + '_' + interval) : ('geq_' + eq.equipmentId);
  const cb    = document.createElement('input');
  cb.type     = 'checkbox';
  cb.id       = cbId;
  cb.name     = 'equipment';
  cb.value    = eq.equipmentId;
  cb.checked  = !!preChecked;
  cb.addEventListener('change', updateFooter);
  cb.addEventListener('click', function(e) { e.stopPropagation(); });

  const lbl               = document.createElement('label');
  lbl.htmlFor             = cbId;
  lbl.style.pointerEvents = 'none';

  const idEl       = document.createElement('strong');
  idEl.textContent = eq.equipmentId;
  lbl.appendChild(idEl);
  lbl.appendChild(document.createTextNode(' \u2014 ' + eq.equipmentName));

  if (taskListName) {
    const badge       = document.createElement('span');
    badge.className   = 'gen-eq-mapped-badge';
    badge.textContent = '\u2713 ' + taskListName;
    lbl.appendChild(badge);
  } else {
    const badge       = document.createElement('span');
    badge.className   = 'gen-eq-unmapped-badge';
    badge.textContent = 'Belum dipetakan';
    lbl.appendChild(badge);
  }

  // ── Expand button (shows activity count) ──
  const detailId    = 'geq_detail_' + eq.equipmentId;
  const expandBtn   = document.createElement('button');
  expandBtn.className = 'gen-eq-expand-btn';

  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('width', '12'); chevron.setAttribute('height', '12');
  chevron.setAttribute('viewBox', '0 0 24 24'); chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor'); chevron.setAttribute('stroke-width', '2.5');
  const chevPath = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  chevPath.setAttribute('points', '6 9 12 15 18 9');
  chevron.appendChild(chevPath);

  const actCount = activities ? activities.length : 0;
  expandBtn.appendChild(chevron);
  expandBtn.appendChild(document.createTextNode(
    taskListName ? (actCount + ' aktivitas') : 'Info'
  ));

  expandBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const detail = document.getElementById(detailId);
    if (!detail) return;
    const isOpen = detail.classList.toggle('open');
    expandBtn.classList.toggle('open', isOpen);
  });

  // Toggle checkbox when clicking anywhere on the row except the expand button
  item.addEventListener('click', function(e) {
    if (e.target === expandBtn || expandBtn.contains(e.target)) return;
    if (e.target === cb) return;
    cb.checked = !cb.checked;
    updateFooter();
  });

  item.appendChild(cb);
  item.appendChild(lbl);
  item.appendChild(expandBtn);
  row.appendChild(item);

  // ── Expandable detail panel ──
  const detail     = document.createElement('div');
  detail.className = 'gen-eq-detail';
  detail.id        = detailId;

  if (taskListName && actCount > 0) {
    const titleEl       = document.createElement('div');
    titleEl.className   = 'gen-eq-detail__title';
    titleEl.textContent = taskListName;
    detail.appendChild(titleEl);

    activities.forEach(function(act) {
      const row2     = document.createElement('div');
      row2.className = 'gen-eq-detail__activity';

      const num       = document.createElement('span');
      num.className   = 'gen-eq-detail__activity-num';
      num.textContent = act.stepNumber + '.';

      const text       = document.createElement('span');
      text.textContent = act.operationText;

      row2.appendChild(num);
      row2.appendChild(text);
      detail.appendChild(row2);
    });
  } else if (taskListName && actCount === 0) {
    const msg       = document.createElement('div');
    msg.className   = 'gen-eq-detail__title';
    msg.textContent = taskListName + ' — Tidak ada aktivitas terdaftar';
    detail.appendChild(msg);
  } else {
    const msg       = document.createElement('div');
    msg.className   = 'gen-eq-detail__no-mapping';
    msg.textContent = 'Equipment ini belum memiliki mapping. Set up mapping di halaman Task Mapping.';
    detail.appendChild(msg);
  }

  row.appendChild(detail);
  return row;
}

// ── Search filter ─────────────────────────────────────────────────────────────

function filterEquipment() {
  const q = (document.getElementById('eqSearch').value || '').toLowerCase().trim();
  document.querySelectorAll('.gen-eq-row').forEach(function(row) {
    row.style.display = (!q || row.dataset.eqName.includes(q)) ? '' : 'none';
  });
  updateCounter();
}

function updateCounter() {
  const counterEl = document.getElementById('eqCounter');
  if (!counterEl) return;
  // Count only mapped rows (these are the generatable ones)
  const allMapped     = document.querySelectorAll('.gen-eq-row[data-mapped="1"]');
  const visibleMapped = Array.from(allMapped).filter(function(el) { return el.style.display !== 'none'; }).length;
  if (!allMapped.length) { counterEl.textContent = ''; return; }
  counterEl.textContent = visibleMapped < allMapped.length
    ? (visibleMapped + ' dari ' + allMapped.length + ' terpetakan')
    : (allMapped.length + ' equipment terpetakan');
}

// ── Footer ────────────────────────────────────────────────────────────────────

function updateFooter() {
  const infoEl = document.getElementById('footerInfo');
  const btn    = document.getElementById('generateBtn');

  const count = document.querySelectorAll(
    '.gen-eq-row[data-mapped="1"] input[name="equipment"]:checked'
  ).length;

  if (infoEl) {
    infoEl.textContent = '';
    if (count > 0) {
      const strong1         = document.createElement('strong');
      strong1.textContent   = count;
      const strong2         = document.createElement('strong');
      strong2.textContent   = count + ' SPK';
      infoEl.appendChild(strong1);
      infoEl.appendChild(document.createTextNode(' equipment terpetakan dipilih \u2014 akan menghasilkan '));
      infoEl.appendChild(strong2);
    } else {
      const span        = document.createElement('span');
      span.style.color  = 'var(--text-muted)';
      span.textContent  = 'Belum ada equipment terpetakan yang dipilih';
      infoEl.appendChild(span);
    }
  }

  const previewBtn = document.getElementById('previewBtn');
  const canAct = count > 0 && !!currentCategory && activeIntervals.length > 0;

  if (btn) {
    btn.textContent = count > 0 ? ('Generate ' + count + ' SPK') : 'Generate SPK';
    btn.disabled    = !canAct;
  }
  if (previewBtn) previewBtn.disabled = !canAct;
}

// ── Preview ───────────────────────────────────────────────────────────────────

function openPreview() {
  const yearEl = document.getElementById('f_year');
  const weekEl = document.getElementById('f_week');
  const year   = yearEl ? parseInt(yearEl.value, 10) : '?';
  const week   = weekEl ? parseInt(weekEl.value, 10) : '?';

  // Collect selected (equipmentId, interval) pairs from row data attributes
  const selectedPairs = Array.from(
    document.querySelectorAll('.gen-eq-row[data-mapped="1"] input[name="equipment"]:checked')
  ).map(function(cb) {
    const row = cb.closest('.gen-eq-row');
    return { eqId: cb.value, interval: row.dataset.interval };
  });

  if (!selectedPairs.length) return;

  const catCode   = { Mekanik: 'M', Listrik: 'E', Sipil: 'S', Otomasi: 'O' }[currentCategory] || currentCategory;
  const spkPrefix = 'SPK-' + catCode + '-' + year + '-W' + String(week).padStart(2, '0');

  const tbody = document.getElementById('pvBody');
  tbody.textContent = '';

  selectedPairs.forEach(function(pair, idx) {
    const eq      = availableEquipment.find(function(e) { return e.equipmentId === pair.eqId; });
    const mapping = availableMappings.find(function(m) { return m.equipmentId === pair.eqId && m.interval === pair.interval; });
    if (!eq || !mapping) return;

    const spkNo      = spkPrefix + '-' + String(idx + 1).padStart(3, '0');
    const activities = mapping.activities || [];
    const lat        = eq.latitude  != null ? parseFloat(eq.latitude).toFixed(6)  : '—';
    const lon        = eq.longitude != null ? parseFloat(eq.longitude).toFixed(6) : '—';
    const lokasi     = eq.functionalLocation || eq.funcLocId || '—';

    // ── Group header row (one per equipment) ──
    const hdrTr = document.createElement('tr');
    hdrTr.style.cssText = 'background:#EBF5FB;font-weight:600;border-top:2px solid #1B3A5C';

    function hdrTd(text, style) {
      var td = document.createElement('td');
      td.style.cssText = 'padding:7px 10px;color:#1B3A5C;' + (style || '');
      td.textContent   = text;
      return td;
    }

    hdrTr.appendChild(hdrTd(spkNo));
    hdrTr.appendChild(hdrTd(mapping.taskListName));
    hdrTr.appendChild(hdrTd(pair.interval));
    hdrTr.appendChild(hdrTd(eq.equipmentId + ' — ' + eq.equipmentName));
    hdrTr.appendChild(hdrTd(lokasi));
    hdrTr.appendChild(hdrTd(lat));
    hdrTr.appendChild(hdrTd(lon));
    hdrTr.appendChild(hdrTd('')); // no duration on header
    tbody.appendChild(hdrTr);

    // ── Activity rows ──
    activities.forEach(function(act, ai) {
      const tr = document.createElement('tr');
      tr.style.background   = ai % 2 === 0 ? '#fff' : '#fafafa';
      tr.style.borderBottom = '1px solid #f0f0f0';

      function actTd(text, style) {
        var td = document.createElement('td');
        td.style.cssText = 'padding:6px 10px;' + (style || '');
        td.textContent   = text;
        return td;
      }

      tr.appendChild(actTd(act.stepNumber + '.', 'color:var(--text-muted);width:40px'));
      tr.appendChild(actTd(act.operationText));
      tr.appendChild(actTd('')); // interval — blank on activity row
      tr.appendChild(actTd('')); // equipment
      tr.appendChild(actTd('')); // lokasi
      tr.appendChild(actTd('')); // lat
      tr.appendChild(actTd('')); // lon
      tr.appendChild(actTd(act.durationPlan != null ? act.durationPlan : '—'));
      tbody.appendChild(tr);
    });

    if (!activities.length) {
      const emptyTr    = document.createElement('tr');
      const td         = document.createElement('td');
      td.colSpan        = 8;
      td.style.cssText  = 'padding:6px 10px 6px 26px;color:var(--text-muted);font-style:italic';
      td.textContent    = 'Tidak ada aktivitas terdaftar';
      emptyTr.appendChild(td);
      tbody.appendChild(emptyTr);
    }
  });

  const titleEl    = document.getElementById('pvTitle');
  const subtitleEl = document.getElementById('pvSubtitle');
  if (titleEl)    titleEl.textContent    = 'Preview SPK — ' + currentCategory + ' Minggu ' + week + ' ' + year;
  if (subtitleEl) subtitleEl.textContent = selectedPairs.length + ' SPK · ' + activeIntervals.join(', ');

  document.getElementById('previewOverlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closePreview() {
  document.getElementById('previewOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function generateBatchSpk() {
  if (!currentCategory) { alert('Pilih kategori terlebih dahulu.'); return; }
  if (!activeIntervals.length) { alert('Pilih minggu terlebih dahulu.'); return; }

  const yearEl = document.getElementById('f_year');
  const weekEl = document.getElementById('f_week');
  const year   = parseInt(yearEl.value, 10);
  const week   = parseInt(weekEl.value, 10);

  // Group selected (equipment × interval) pairs by interval
  const byInterval = {};
  document.querySelectorAll('.gen-eq-row[data-mapped="1"] input[name="equipment"]:checked').forEach(function(cb) {
    const iv = cb.closest('.gen-eq-row').dataset.interval;
    if (!iv) return;
    if (!byInterval[iv]) byInterval[iv] = [];
    byInterval[iv].push(cb.value);
  });

  const totalSelected = Object.values(byInterval).reduce(function(s, ids) { return s + ids.length; }, 0);
  if (!totalSelected) { alert('Tidak ada equipment terpetakan yang dipilih.'); return; }

  const btn = document.getElementById('generateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

  try {
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const iv of Object.keys(byInterval)) {
      const result = await apiPost('/spk/batch-generate', {
        week, year, interval: iv, category: currentCategory, equipmentIds: byInterval[iv],
      });
      totalCreated += (result.created || []).length;
      totalSkipped += (result.skipped || []).length;
    }

    const msg = totalCreated + ' SPK berhasil dibuat'
      + (totalSkipped ? ' (' + totalSkipped + ' dilewati)' : '');
    showMessage(msg);
    setTimeout(function() { window.location.href = '/pages/spk.html'; }, 1500);
  } catch (e) {
    showMessage(e.message || 'Terjadi kesalahan', 'error');
    if (btn) { btn.disabled = false; updateFooter(); }
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

(function init() {
  initYearWeek();
  apiGet('/equipment-mappings').then(function(data) {
    availableMappings = data;
  }).catch(function() {});
  onWeekChange();
})();
