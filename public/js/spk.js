/* ─── SPK Page Logic ─── */

let allSpk = [];
let editingSpkNumber = null;
let editingSpkEquipmentIds = new Set();
let availableEquipment = [];
let availableMappings = [];

// ── Load & render ──────────────────────────────────────────────────────────
async function loadSpk() {
  const tbody = document.getElementById('spkBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="spinner"></div></td></tr>';
  try {
    const category = document.getElementById('filterCategory').value;
    allSpk = await apiGet('/spk' + (category ? `?category=${category}` : ''));
    renderSpk();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">${e.message}</td></tr>`;
  }
}

function renderSpk() {
  const statusFilter = document.getElementById('filterStatus').value;
  let data = statusFilter ? allSpk.filter(s => s.status === statusFilter) : allSpk;
  const tbody = document.getElementById('spkBody');

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td class="col-check"><input type="checkbox" name="bulk" value="${escHtml(s.spkNumber)}" onchange="updateBulkBar()"></td>
      <td><strong>${escHtml(s.spkNumber)}</strong></td>
      <td>${escHtml(s.description)}</td>
      <td>${escHtml(s.category || '\u2014')}</td>
      <td>${escHtml(s.interval)}</td>
      <td>${statusBadge(s.status)}</td>
      <td>${(s.equipmentModels || []).length}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEdit('${escHtml(s.spkNumber)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSpk('${escHtml(s.spkNumber)}')">Hapus</button>
          ${s.status === 'completed'
      ? `<button class="btn btn-ghost btn-sm" onclick="resetSpk('${escHtml(s.spkNumber)}')">Reset</button>`
      : ''}
        </div>
      </td>
    </tr>
  `).join('');
  updateBulkBar();
}

// ── Week schedule helpers ──────────────────────────────────────────────────
function getWeekDateRange(week, year) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
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

// Safe local-date string — avoids toISOString() which converts to UTC and
// shifts the date by one day in UTC+ timezones (e.g. WIB UTC+7).
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCurrentISOWeek() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const diff = Math.floor((now - jan4) / 86400000) + (jan4Day - 1);
  return Math.min(53, Math.max(1, Math.ceil((diff + 1) / 7)));
}

async function onWeekChange() {
  const yearEl  = document.getElementById('f_year');
  const weekEl  = document.getElementById('f_week');
  const rangeEl = document.getElementById('f_weekRange');
  const chipsEl = document.getElementById('f_intervalChips');
  const radiosEl = document.getElementById('f_intervalRadios');
  const hiddenEl = document.getElementById('f_weekStart');
  if (!yearEl || !weekEl) return;

  const year = parseInt(yearEl.value, 10);
  const week = parseInt(weekEl.value, 10);
  const { start, end } = getWeekDateRange(week, year);

  if (rangeEl) rangeEl.textContent = fmtDateId(start) + ' \u2013 ' + fmtDateId(end);
  if (hiddenEl) hiddenEl.value = localDateStr(start);

  if (chipsEl) {
    chipsEl.textContent = '';
    const loading = document.createElement('span');
    loading.style.cssText = 'color:var(--text-muted);font-size:13px';
    loading.textContent = 'Memuat...';
    chipsEl.appendChild(loading);
  }
  if (radiosEl) radiosEl.textContent = '';

  try {
    const data = await apiGet('/preventive-schedule?year=' + year + '&week=' + week);
    const intervals = data.activeIntervals || [];

    if (chipsEl) {
      chipsEl.textContent = '';
      if (!intervals.length) {
        const msg = document.createElement('span');
        msg.style.cssText = 'color:var(--text-muted);font-size:13px';
        msg.textContent = 'Tidak ada jadwal untuk minggu ini';
        chipsEl.appendChild(msg);
      } else {
        intervals.forEach(function(iv) {
          const chip = document.createElement('span');
          chip.className = 'status-badge';
          chip.style.cssText = 'background:var(--sap-blue);color:#fff;margin-right:4px';
          chip.textContent = iv;
          chipsEl.appendChild(chip);
        });
      }
    }

    if (radiosEl) {
      if (!intervals.length) {
        const msg = document.createElement('span');
        msg.style.cssText = 'color:var(--text-muted);font-size:13px';
        msg.textContent = '\u2014';
        radiosEl.appendChild(msg);
      } else {
        intervals.forEach(function(iv, i) {
          const label = document.createElement('label');
          label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-right:16px;cursor:pointer';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'f_interval_radio';
          radio.value = iv;
          if (i === 0) radio.checked = true;
          radio.addEventListener('change', function() {
            renderEquipmentList(this.value);
            renderActivitySections([]);
            updateGenerateCount();
          });
          const strong = document.createElement('strong');
          strong.textContent = iv;
          label.appendChild(radio);
          label.appendChild(document.createTextNode('\u00a0'));
          label.appendChild(strong);
          radiosEl.appendChild(label);
        });
      }
    }

    // Render equipment list for first active interval
    if (intervals.length) renderEquipmentList(intervals[0]);
    renderActivitySections([]);
    updateGenerateCount();
  } catch (e) {
    if (chipsEl) {
      chipsEl.textContent = '';
      const err = document.createElement('span');
      err.style.color = 'var(--error)';
      err.textContent = 'Gagal memuat jadwal';
      chipsEl.appendChild(err);
    }
  }
}

// ── Open create panel (batch generator) ───────────────────────────────────
async function openCreate() {
  editingSpkNumber = null;
  editingSpkEquipmentIds = new Set();
  document.getElementById('panelTitle').textContent = 'Generate SPK';
  const saveBtn = document.getElementById('panelSave');
  if (saveBtn) { saveBtn.textContent = 'Generate SPK'; saveBtn.onclick = generateBatchSpk; }
  await Promise.all([loadEquipmentList(), loadMappings()]);
  renderBatchForm();
  openPanel();
}

// ── Batch form ────────────────────────────────────────────────────────────
function renderBatchForm() {
  const curYear = new Date().getFullYear();
  const cats = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];

  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Periode & Interval</div>
      <div class="form-row">
        <div class="form-group">
          <label>Tahun</label>
          <select id="f_year" onchange="onWeekChange()">
            <option value="${curYear - 1}">${curYear - 1}</option>
            <option value="${curYear}" selected>${curYear}</option>
            <option value="${curYear + 1}">${curYear + 1}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Minggu ke-</label>
          <select id="f_week" onchange="onWeekChange()">
            ${Array.from({length:53},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="padding:6px 0 2px;display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <span id="f_weekRange" style="font-size:13px;color:var(--text-muted)"></span>
        <div id="f_intervalChips" style="display:inline-flex;flex-wrap:wrap;gap:4px"></div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label>Interval SPK *</label>
        <div id="f_intervalRadios" style="display:flex;flex-wrap:wrap;gap:4px;padding-top:4px"></div>
      </div>
      <input type="hidden" id="f_weekStart" value="" />
    </div>

    <div class="form-section">
      <div class="form-section__title">Equipment</div>
      <div class="eq-search-toolbar">
        <div class="eq-search-toolbar__input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" id="eqSearch" placeholder="Cari equipment..." oninput="filterEquipmentList();updateGenerateCount()" />
        </div>
        <select id="eqCategoryFilter" onchange="filterEquipmentList();updateGenerateCount()">
          <option value="">Semua Kategori</option>
          ${cats.map(c=>`<option>${c}</option>`).join('')}
        </select>
        <span id="eqCounter" class="eq-search-toolbar__counter"></span>
      </div>
      <div class="multi-select-list" id="eqMultiSelectList"></div>
    </div>
  `;

  const weekEl = document.getElementById('f_week');
  if (weekEl) weekEl.value = getCurrentISOWeek();
  onWeekChange();
}

function updateGenerateCount() {
  const saveBtn = document.getElementById('panelSave');
  if (!saveBtn || editingSpkNumber) return;
  const checked = document.querySelectorAll('#eqMultiSelectList .multi-select-item input[name="equipment"]:checked');
  // Only count mapped ones (those that have a task list badge — data-mapped attr set by buildEqItem)
  const mappedChecked = Array.from(checked).filter(function(cb) {
    return cb.closest('.multi-select-item').dataset.mapped === '1';
  }).length;
  saveBtn.textContent = mappedChecked > 0 ? `Generate ${mappedChecked} SPK` : 'Generate SPK';
}

async function generateBatchSpk() {
  const yearEl  = document.getElementById('f_year');
  const weekEl  = document.getElementById('f_week');
  const radioEl = document.querySelector('input[name="f_interval_radio"]:checked');
  const weekStartEl = document.getElementById('f_weekStart');

  if (!radioEl) { alert('Pilih interval terlebih dahulu.'); return; }

  const year     = parseInt(yearEl.value, 10);
  const week     = parseInt(weekEl.value, 10);
  const interval = radioEl.value;
  const catEl    = document.getElementById('eqCategoryFilter');
  const category = catEl && catEl.value ? catEl.value : null;

  // Collect checked equipment that have a mapping (data-mapped="1")
  const checkedInputs = Array.from(document.querySelectorAll(
    '#eqMultiSelectList .multi-select-item[data-mapped="1"] input[name="equipment"]:checked'
  ));
  const equipmentIds = checkedInputs.map(function(cb) { return cb.value; });

  if (!equipmentIds.length) { alert('Tidak ada equipment terpetakan yang dipilih.'); return; }
  if (!category) { alert('Pilih kategori equipment.'); return; }

  const saveBtn = document.getElementById('panelSave');
  if (saveBtn) saveBtn.disabled = true;

  try {
    const result = await apiPost('/spk/batch-generate', { week, year, interval, category, equipmentIds });
    showMessage(result.message);
    if (result.skipped && result.skipped.length) {
      console.info('Skipped:', result.skipped);
    }
    closePanel();
    loadSpk();
  } catch (e) {
    showMessage(e.message, 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ── Open edit panel ───────────────────────────────────────────────────────
async function openEdit(spkNumber) {
  editingSpkNumber = spkNumber;
  document.getElementById('panelTitle').textContent = 'Edit SPK';
  const saveBtn = document.getElementById('panelSave');
  if (saveBtn) { saveBtn.textContent = 'Simpan'; saveBtn.onclick = saveSpk; saveBtn.disabled = false; }
  await Promise.all([loadEquipmentList(), loadMappings()]);
  const spk = allSpk.find(s => s.spkNumber === spkNumber);
  renderPanelForm(spk);
  openPanel();
}

async function loadEquipmentList() {
  try {
    const res = await apiGet('/equipment?limit=9999');
    availableEquipment = res.data || res;
  } catch { availableEquipment = []; }
}

async function loadMappings() {
  try {
    availableMappings = await apiGet('/equipment-mappings');
  } catch { availableMappings = []; }
}

// ── Equipment list item builder ────────────────────────────────────────────
function buildEqItem(eq, preChecked, taskListName) {
  const item = document.createElement('div');
  item.className = 'multi-select-item';
  item.dataset.name = (eq.equipmentId + ' ' + eq.equipmentName + ' ' + (eq.category || '')).toLowerCase();
  item.dataset.category = (eq.category || '').toLowerCase();
  item.dataset.mapped = taskListName ? '1' : '0';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'eq_' + eq.equipmentId;
  cb.name = 'equipment';
  cb.value = eq.equipmentId;
  cb.checked = preChecked || editingSpkEquipmentIds.has(eq.equipmentId);
  cb.addEventListener('change', function() { renderActivitySections(); });

  const label = document.createElement('label');
  label.htmlFor = 'eq_' + eq.equipmentId;
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.flexWrap = 'wrap';
  label.style.gap = '4px';

  const idStr = document.createElement('strong');
  idStr.textContent = eq.equipmentId;

  const nameStr = document.createTextNode(' \u2014 ' + eq.equipmentName);

  const catSpan = document.createElement('span');
  catSpan.className = 'text-muted text-small';
  catSpan.textContent = '(' + (eq.category || '') + ')';

  label.appendChild(idStr);
  label.appendChild(nameStr);
  label.appendChild(catSpan);

  if (taskListName) {
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:11px;padding:1px 7px;border-radius:10px;background:#e6f4ea;color:#1a6e2e;border:1px solid #b7dfbf';
    badge.textContent = '\u2713 ' + taskListName;
    label.appendChild(badge);
  }

  item.appendChild(cb);
  item.appendChild(label);
  return item;
}

// ── Render equipment list (interval-aware in create mode) ──────────────────
function renderEquipmentList(interval) {
  const container = document.getElementById('eqMultiSelectList');
  if (!container) return;
  container.textContent = '';

  if (!availableEquipment.length) {
    const p = document.createElement('p');
    p.style.cssText = 'padding:12px;color:var(--text-muted)';
    p.textContent = 'Tidak ada equipment';
    container.appendChild(p);
    filterEquipmentList();
    return;
  }

  if (!editingSpkNumber && interval) {
    // Create mode with interval: group mapped vs unmapped
    const forInterval = availableMappings.filter(function(m) { return m.interval === interval; });
    const mappedIds = new Set(forInterval.map(function(m) { return m.equipmentId; }));

    const mapped   = availableEquipment.filter(function(eq) { return mappedIds.has(eq.equipmentId); });
    const unmapped = availableEquipment.filter(function(eq) { return !mappedIds.has(eq.equipmentId); });

    if (mapped.length) {
      const hdr = document.createElement('div');
      hdr.style.cssText = 'padding:6px 12px 3px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px';
      hdr.textContent = 'Terpetakan \u2014 ' + interval + ' (' + mapped.length + ')';
      container.appendChild(hdr);

      mapped.forEach(function(eq) {
        const m = forInterval.find(function(x) { return x.equipmentId === eq.equipmentId; });
        container.appendChild(buildEqItem(eq, true, m ? m.taskListName : null));
      });
    }

    if (unmapped.length) {
      const hdr = document.createElement('div');
      hdr.style.cssText = 'padding:6px 12px 3px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px' +
        (mapped.length ? ';border-top:1px solid var(--border);margin-top:4px' : '');
      hdr.textContent = 'Tanpa mapping (' + unmapped.length + ')';
      container.appendChild(hdr);

      unmapped.forEach(function(eq) {
        container.appendChild(buildEqItem(eq, false, null));
      });
    }

    if (!mapped.length && !unmapped.length) {
      const p = document.createElement('p');
      p.style.cssText = 'padding:12px;color:var(--text-muted)';
      p.textContent = 'Tidak ada equipment';
      container.appendChild(p);
    }
  } else {
    // Edit mode or no interval: flat list
    availableEquipment.forEach(function(eq) {
      container.appendChild(buildEqItem(eq, false, null));
    });
  }

  filterEquipmentList();
}

// ── Render panel form ─────────────────────────────────────────────────────
function renderPanelForm(spk) {
  const isEdit = !!spk;
  const categories = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
  const statuses = ['pending', 'in_progress', 'completed'];
  const curYear = new Date().getFullYear();

  // Track which equipment already belong to the SPK being edited
  editingSpkEquipmentIds = new Set((spk && spk.equipmentModels || []).map(function(e) { return e.equipmentId; }));

  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Informasi SPK</div>
      <div class="form-row">
        <div class="form-group">
          <label>SPK Number *</label>
          <input id="f_spkNumber" value="${escHtml(spk ? spk.spkNumber : suggestSpkNumber())}" ${isEdit ? 'readonly' : ''} />
        </div>
        ${!isEdit ? `
        <div class="form-group">
          <label>Tahun</label>
          <select id="f_year" onchange="onWeekChange()">
            <option value="${curYear - 1}">${curYear - 1}</option>
            <option value="${curYear}" selected>${curYear}</option>
            <option value="${curYear + 1}">${curYear + 1}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Minggu ke-</label>
          <select id="f_week" onchange="onWeekChange()">
            ${Array.from({length:53},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
          </select>
        </div>` : `
        <div class="form-group">
          <label>Interval</label>
          <input value="${escHtml(spk.interval || '\u2014')}" readonly style="background:var(--bg-hover)" />
        </div>
        <div class="form-group">
          <label>Tanggal Mulai</label>
          <input type="date" id="f_scheduledDate" value="${escHtml(spk.scheduledDate || '')}" />
        </div>`}
      </div>
      ${!isEdit ? `
      <div style="padding:6px 0 2px;display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <span id="f_weekRange" style="font-size:13px;color:var(--text-muted)"></span>
        <div id="f_intervalChips" style="display:inline-flex;flex-wrap:wrap;gap:4px"></div>
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label>Interval SPK *</label>
        <div id="f_intervalRadios" style="display:flex;flex-wrap:wrap;gap:4px;padding-top:4px"></div>
      </div>
      <input type="hidden" id="f_weekStart" value="" />` : ''}
      <div class="form-row full">
        <div class="form-group">
          <label>Deskripsi *</label>
          <input id="f_description" value="${escHtml(spk ? spk.description : '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kategori *</label>
          <select id="f_category" onchange="if(!editingSpkNumber)document.getElementById('f_spkNumber').value=suggestSpkNumber()">
            ${categories.map(c => `<option ${spk && spk.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="f_status">
            ${statuses.map(s => `<option value="${s}" ${spk && spk.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section__title">Equipment</div>
      <div class="eq-search-toolbar">
        <div class="eq-search-toolbar__input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" id="eqSearch" placeholder="Cari equipment..." oninput="filterEquipmentList()" />
        </div>
        <select id="eqCategoryFilter" onchange="filterEquipmentList()">
          <option value="">Semua Kategori</option>
          <option>Mekanik</option>
          <option>Listrik</option>
          <option>Sipil</option>
          <option>Otomasi</option>
        </select>
        <span id="eqCounter" class="eq-search-toolbar__counter"></span>
      </div>
      <div class="multi-select-list" id="eqMultiSelectList"></div>
    </div>

    <div id="activitySections"></div>
  `;

  // On edit: render flat equipment list + existing activities
  if (isEdit) {
    renderEquipmentList(spk.interval || null);
    renderActivitySections((spk.activitiesModel) || []);
  } else {
    // On create: set current week then fetch intervals + render equipment
    const weekEl = document.getElementById('f_week');
    if (weekEl) weekEl.value = getCurrentISOWeek();
    onWeekChange(); // will call renderEquipmentList + renderActivitySections
  }
}

// ── Per-equipment activity sections ───────────────────────────────────────
// existingActs: array from API (edit) or [] (create). Called without arg on checkbox toggle.
function renderActivitySections(existingActs) {
  // When called from checkbox onchange (no arg), preserve what is already in DOM
  const acts = existingActs !== undefined ? existingActs : _readActivitiesFromDom();
  const container = document.getElementById('activitySections');
  if (!container) return;

  const checkedEqs = Array.from(document.querySelectorAll('input[name="equipment"]:checked'))
    .map(cb => availableEquipment.find(e => e.equipmentId === cb.value))
    .filter(Boolean);

  if (checkedEqs.length === 0) {
    container.innerHTML = '<div class="form-section"><div class="form-section__title">Aktivitas</div>' +
      '<p style="padding:12px;color:var(--text-muted)">Pilih equipment terlebih dahulu untuk menambahkan aktivitas.</p></div>';
    return;
  }

  // Auto-populate from mappings in create mode only, for equipment with no activities yet
  if (!editingSpkNumber) {
    var radioEl = document.querySelector('input[name="f_interval_radio"]:checked');
    var currentInterval = radioEl ? radioEl.value : null;
    if (currentInterval) {
      checkedEqs.forEach(function(eq) {
        var hasActs = acts.some(function(a) { return a.equipmentId === eq.equipmentId; });
        if (!hasActs) {
          var mapping = availableMappings.find(function(m) {
            return m.equipmentId === eq.equipmentId && m.interval === currentInterval;
          });
          if (mapping) {
            (mapping.activities || []).forEach(function(step) {
              acts.push({
                equipmentId: eq.equipmentId,
                operationText: step.operationText,
                durationPlan: 30,
                resultComment: null,
                durationActual: null,
                isVerified: false,
              });
            });
          }
        }
      });
    }
  }

  container.innerHTML = checkedEqs.map(eq => {
    const eqActs = acts.filter(a => a.equipmentId === eq.equipmentId);
    const rowsHtml = eqActs.map((a, i) => activityRow(eq.equipmentId + '__' + i, a)).join('');
    const safeEqId = escHtml(eq.equipmentId);
    return '<div class="form-section">' +
      '<div class="form-section__title">Aktivitas &mdash; <strong>' + escHtml(eq.equipmentName) + '</strong>' +
      ' <span class="text-muted text-small" style="font-weight:normal">(' + safeEqId + ')</span></div>' +
      '<div class="dynamic-list" id="actsList_' + safeEqId + '">' + rowsHtml + '</div>' +
      '<button type="button" class="add-row-btn mt-12" onclick="addActivityRow(\'' + safeEqId + '\')">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
      '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' Tambah Aktivitas</button></div>';
  }).join('');
}

// Snapshot activities typed in DOM sections (called before re-render on checkbox toggle)
function _readActivitiesFromDom() {
  const acts = [];
  document.querySelectorAll('#activitySections .dynamic-list').forEach(function (section) {
    const eqId = section.id.replace('actsList_', '');
    section.querySelectorAll('.dynamic-item').forEach(function (row) {
      const opInput = row.querySelector('input[id^="act_op_"]');
      const durInput = row.querySelector('input[id^="act_dur_"]');
      const opText = opInput ? opInput.value.trim() : '';
      if (!opText) return;
      acts.push({
        equipmentId: eqId,
        operationText: opText,
        durationPlan: durInput ? parseFloat(durInput.value) || 0 : 0,
        resultComment: null,
        durationActual: null,
        isVerified: false
      });
    });
  });
  return acts;
}

function activityRow(idx, act) {
  act = act || {};
  const opVal = escHtml(act.operationText || '');
  const durVal = act.durationPlan != null ? act.durationPlan : '';
  return '<div class="dynamic-item" id="actRow_' + idx + '">' +
    '<div class="flex-1"><input class="w-full" placeholder="Teks operasi / deskripsi aktivitas"' +
    ' value="' + opVal + '" id="act_op_' + idx + '" /></div>' +
    '<div class="w-24"><input type="number" min="0" step="1" placeholder="Durasi (menit)"' +
    ' value="' + durVal + '" id="act_dur_' + idx + '" /></div>' +
    '<button type="button" class="btn-remove" onclick="removeRow(\'actRow_' + idx + '\')">&#x2715;</button>' +
    '</div>';
}

let _actIdx = 100;
function addActivityRow(equipmentId) {
  const container = document.getElementById('actsList_' + equipmentId);
  if (!container) return;
  const idx = equipmentId + '__' + (_actIdx++);
  const div = document.createElement('div');
  div.innerHTML = activityRow(idx, {});
  container.appendChild(div.firstElementChild);
}

function removeRow(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function suggestSpkNumber() {
  const catCode = { Mekanik: 'M', Listrik: 'L', Sipil: 'S', Otomasi: 'O' };
  const catEl = document.getElementById('f_category');
  const cat = catEl ? catEl.value : 'Mekanik';
  const code = catCode[cat] || 'M';
  const prefix = 'SPK-' + code + '-';
  const max = allSpk.reduce(function (m, s) {
    if (!s.spkNumber.startsWith(prefix)) return m;
    const match = s.spkNumber.match(/SPK-[A-Z]+-(\d+)$/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  return prefix + String(max + 1).padStart(3, '0');
}

// ── Save SPK ────────────────────────────────────────────────────────────
async function saveSpk() {
  const spkNumber = document.getElementById('f_spkNumber').value.trim();
  const description = document.getElementById('f_description').value.trim();
  const category = document.getElementById('f_category').value;
  const status = document.getElementById('f_status').value;

  // Interval: radio on create, existing value on edit
  const radioEl = document.querySelector('input[name="f_interval_radio"]:checked');
  const dateEl  = document.getElementById('f_scheduledDate');
  const weekEl  = document.getElementById('f_weekStart');
  const interval = radioEl ? radioEl.value : null;
  const scheduledDate = weekEl ? (weekEl.value || null) : (dateEl ? dateEl.value || null : null);

  if (!editingSpkNumber && !interval) { alert('Pilih interval SPK terlebih dahulu.'); return; }

  if (!spkNumber || !description) { alert('SPK Number dan Deskripsi wajib diisi.'); return; }

  // Collect selected equipment
  const checkedEq = Array.from(document.querySelectorAll('input[name="equipment"]:checked')).map(function (cb) {
    const eq = availableEquipment.find(function (e) { return e.equipmentId === cb.value; });
    return { equipmentId: eq.equipmentId, equipmentName: eq.equipmentName, functionalLocation: eq.functionalLocation };
  });

  // Collect activities per equipment section — each activity carries its equipment's id
  const activitiesModel = [];
  let actCounter = 1;
  const checkedEqIds = Array.from(document.querySelectorAll('input[name="equipment"]:checked')).map(function (cb) { return cb.value; });

  checkedEqIds.forEach(function (eqId) {
    const section = document.getElementById('actsList_' + eqId);
    if (!section) return;
    section.querySelectorAll('.dynamic-item').forEach(function (row) {
      const opInput = row.querySelector('input[id^="act_op_"]');
      const durInput = row.querySelector('input[id^="act_dur_"]');
      const opText = opInput ? opInput.value.trim() : '';
      if (!opText) return;
      activitiesModel.push({
        activityNumber: 'ACT-' + String(actCounter++).padStart(3, '0'),
        equipmentId: eqId,
        operationText: opText,
        resultComment: null,
        durationPlan: durInput ? parseFloat(durInput.value) || 0 : 0,
        durationActual: null,
        isVerified: false
      });
    });
  });

  const body = {
    spkNumber, description, interval, category, status,
    scheduledDate,
    durationActual: null, equipmentModels: checkedEq, activitiesModel
  };

  try {
    if (editingSpkNumber) {
      await apiPut('/spk/' + editingSpkNumber, body);
      showMessage('SPK ' + spkNumber + ' berhasil diperbarui');
    } else {
      await apiPost('/spk', body);
      showMessage('SPK ' + spkNumber + ' berhasil dibuat');
    }
    closePanel();
    loadSpk();
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

// ── Delete SPK ─────────────────────────────────────────────────────────
async function deleteSpk(spkNumber) {
  if (!window.confirm('Hapus SPK ' + spkNumber + '? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    await apiDelete('/spk/' + spkNumber);
    showMessage('SPK ' + spkNumber + ' dihapus');
    loadSpk();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Reset SPK ──────────────────────────────────────────────────────────
// ── Bulk Delete SPK ────────────────────────────────────────────────────────
async function bulkDeleteSpk() {
  var ids = getCheckedIds();
  if (!ids.length) return;
  if (!window.confirm('Hapus ' + ids.length + ' SPK terpilih? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    await apiPost('/spk/bulk-delete', { ids: ids });
    showMessage(ids.length + ' SPK berhasil dihapus');
    loadSpk();
  } catch (e) { showMessage(e.message, 'error'); }
}

async function resetSpk(spkNumber) {
  if (!window.confirm('Reset SPK ' + spkNumber + ' ke status pending?')) return;
  try {
    const spk = allSpk.find(function (s) { return s.spkNumber === spkNumber; });
    const resetActs = (spk.activitiesModel || []).map(function (a) {
      return Object.assign({}, a, { resultComment: null, durationActual: null, isVerified: false });
    });
    await apiPut('/spk/' + spkNumber, { status: 'pending', durationActual: null, activitiesModel: resetActs });
    showMessage('SPK ' + spkNumber + ' direset');
    loadSpk();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Filter equipment list inside create/edit panel ─────────────────────
function filterEquipmentList() {
  var searchInput = document.getElementById('eqSearch');
  var catSelect = document.getElementById('eqCategoryFilter');
  var counter = document.getElementById('eqCounter');
  if (!searchInput) return;

  var query = searchInput.value.toLowerCase().trim();
  var cat = catSelect ? catSelect.value : '';
  var items = document.querySelectorAll('#eqMultiSelectList .multi-select-item');
  var shown = 0;

  items.forEach(function (item) {
    var name = item.dataset.name || '';
    var matchesQuery = !query || name.indexOf(query) !== -1;
    var matchesCat = !cat || item.dataset.category === cat.toLowerCase();
    if (matchesQuery && matchesCat) {
      item.style.display = '';
      shown++;
    } else {
      item.style.display = 'none';
    }
  });

  if (counter) {
    counter.textContent = shown + ' dari ' + items.length + ' equipment';
  }
}

// ── Init ────────────────────────────────────────────────────────────────
loadSpk();
