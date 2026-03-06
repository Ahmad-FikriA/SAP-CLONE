/* ─── SPK Page Logic ─── */

let allSpk = [];
let editingSpkNumber = null;
let availableEquipment = [];

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

// ── Open create panel ─────────────────────────────────────────────────────
async function openCreate() {
  editingSpkNumber = null;
  document.getElementById('panelTitle').textContent = 'Tambah SPK';
  await loadEquipmentList();
  renderPanelForm(null);
  openPanel();
}

// ── Open edit panel ───────────────────────────────────────────────────────
async function openEdit(spkNumber) {
  editingSpkNumber = spkNumber;
  document.getElementById('panelTitle').textContent = 'Edit SPK';
  await loadEquipmentList();
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

// ── Render panel form ─────────────────────────────────────────────────────
function renderPanelForm(spk) {
  const isEdit = !!spk;
  const categories = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
  const intervals = ['1 Minggu', '2 Minggu', '1 Bulan', '3 Bulan', '6 Bulan', '1 Tahun'];
  const statuses = ['pending', 'in_progress', 'completed'];

  // Equipment checkboxes — onchange triggers per-equipment activity sections
  const eqHtml = availableEquipment.map(eq => {
    const checked = spk && (spk.equipmentModels || []).some(e => e.equipmentId === eq.equipmentId) ? 'checked' : '';
    return `
      <div class="multi-select-item">
        <input type="checkbox" id="eq_${eq.equipmentId}" name="equipment" value="${eq.equipmentId}" ${checked}
          onchange="renderActivitySections()">
        <label for="eq_${eq.equipmentId}">
          <strong>${escHtml(eq.equipmentId)}</strong> &mdash; ${escHtml(eq.equipmentName)}
          <span class="text-muted text-small"> (${escHtml(eq.category)})</span>
        </label>
      </div>`;
  }).join('');

  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Informasi SPK</div>
      <div class="form-row">
        <div class="form-group">
          <label>SPK Number *</label>
          <input id="f_spkNumber" value="${escHtml(spk ? spk.spkNumber : suggestSpkNumber())}" ${isEdit ? 'readonly' : ''} />
        </div>
        <div class="form-group">
          <label>Interval *</label>
          <select id="f_interval">
            ${intervals.map(v => `<option ${spk && spk.interval === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Deskripsi *</label>
          <input id="f_description" value="${escHtml(spk ? spk.description : '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kategori *</label>
          <select id="f_category">
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
      <div class="multi-select-list" id="eqMultiSelectList">${eqHtml || '<p style="padding:12px;color:var(--text-muted)">Tidak ada equipment</p>'}</div>
    </div>

    <div id="activitySections"></div>
  `;

  // Populate per-equipment activity sections
  renderActivitySections((spk && spk.activitiesModel) || []);
  // Initialize the equipment counter
  filterEquipmentList();
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
    '<div class="w-24"><input type="number" min="0" step="0.25" placeholder="Durasi (jam)"' +
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
  const year = new Date().getFullYear();
  const max = allSpk.reduce(function (m, s) {
    const match = s.spkNumber.match(/SPK-\d+-(\d+)/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  return 'SPK-' + year + '-' + String(max + 1).padStart(3, '0');
}

// ── Save SPK ────────────────────────────────────────────────────────────
async function saveSpk() {
  const spkNumber = document.getElementById('f_spkNumber').value.trim();
  const description = document.getElementById('f_description').value.trim();
  const interval = document.getElementById('f_interval').value;
  const category = document.getElementById('f_category').value;
  const status = document.getElementById('f_status').value;

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
    var label = item.querySelector('label');
    var text = label ? label.textContent.toLowerCase() : '';
    var matchesQuery = !query || text.indexOf(query) !== -1;
    var matchesCat = !cat || text.indexOf(cat.toLowerCase()) !== -1;
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
