/* ─── Equipment Mappings Page Logic ─── */

var allMappings   = [];
var allEquipment  = [];
var allTaskLists  = [];
var INTERVALS     = ['1wk', '2wk', '4wk', '8wk', '12wk', '14wk', '16wk'];
var _panelMode    = 'mapping'; // 'mapping' | 'tasklist' | 'bulk'
var _editingTlId  = null;      // null = create, string = edit
var _tlActIdx     = 0;

// ── Dynamic panel save dispatcher ────────────────────────────────────────────
function handlePanelSave() {
  if (_panelMode === 'tasklist') saveTaskList();
  else if (_panelMode === 'bulk') saveBulkMapping();
  else saveMapping();
}

// ══════════════════════════════════════════════════════════════════════════════
// EQUIPMENT-INTERVAL MAPPINGS
// ══════════════════════════════════════════════════════════════════════════════

async function loadMappings() {
  var tbody = document.getElementById('mappingBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><div class="spinner"></div></td></tr>';
  try {
    allMappings = await apiGet('/equipment-mappings');
    renderMappings();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">' + escHtml(e.message) + '</td></tr>';
  }
}

function renderMappings() {
  var tbody = document.getElementById('mappingBody');
  if (!allMappings.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Belum ada mapping</td></tr>';
    return;
  }
  tbody.innerHTML = allMappings.map(function(m) {
    var cnt = m.activityCount != null ? m.activityCount : (m.activities ? m.activities.length : 0);
    return '<tr>' +
      '<td><strong>' + escHtml(m.equipmentId || '') + '</strong>' +
        (m.equipmentName ? '<br><small style="color:var(--text-muted)">' + escHtml(m.equipmentName) + '</small>' : '') +
      '</td>' +
      '<td><span class="badge">' + escHtml(m.interval || '') + '</span></td>' +
      '<td>' + escHtml(m.taskListName || m.taskListId || '') + '</td>' +
      '<td>' + escHtml(String(cnt)) + '</td>' +
      '<td><div class="table-actions">' +
        '<button class="btn btn-danger btn-sm" onclick="deleteMapping(' + m.id + ')">Hapus</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

async function openCreate() {
  _panelMode = 'mapping';
  document.getElementById('panelTitle').textContent = 'Tambah Mapping';
  document.getElementById('panelSave').textContent  = 'Simpan Mapping';

  try {
    var r = await Promise.all([apiGet('/equipment?limit=9999'), apiGet('/task-lists')]);
    allEquipment = r[0].data || r[0];
    allTaskLists = Array.isArray(r[1]) ? r[1] : (r[1].data || []);
  } catch (e) { allEquipment = []; allTaskLists = []; }

  var eqOpts = allEquipment.map(function(eq) {
    var id = eq.equipmentId || eq.id;
    return '<option value="' + escHtml(id) + '">' + escHtml(id + ' — ' + (eq.equipmentName || eq.name || '')) + '</option>';
  }).join('');

  var ivOpts = INTERVALS.map(function(iv) {
    return '<option value="' + escHtml(iv) + '">' + escHtml(iv) + '</option>';
  }).join('');

  var tlOpts = allTaskLists.map(function(tl) {
    var id   = tl.taskListId || tl.id || '';
    var name = tl.taskListName || tl.name || id;
    return '<option value="' + escHtml(String(id)) + '">' + escHtml(name + ' (' + id + ')') + '</option>';
  }).join('');

  document.getElementById('panelBody').innerHTML =
    '<div class="form-section">' +
      '<div class="form-group"><label class="form-label">Equipment *</label>' +
        '<select id="f_equipmentId"><option value="">-- Pilih Equipment --</option>' + eqOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">Interval *</label>' +
        '<select id="f_interval">' + ivOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">Task List *</label>' +
        '<select id="f_taskListId"><option value="">-- Pilih Task List --</option>' + tlOpts + '</select></div>' +
    '</div>';

  openPanel();
}

async function saveMapping() {
  var equipmentId = document.getElementById('f_equipmentId').value;
  var interval    = document.getElementById('f_interval').value;
  var taskListId  = document.getElementById('f_taskListId').value;

  if (!equipmentId) { showMessage('Equipment harus dipilih.', 'error'); return; }
  if (!taskListId)  { showMessage('Task List harus dipilih.', 'error'); return; }

  try {
    await apiPost('/equipment-mappings', { equipmentId, interval, taskListId });
    showMessage('Mapping berhasil ditambahkan.', 'success');
    closePanel();
    loadMappings();
  } catch (e) { showMessage(e.message || 'Gagal menyimpan mapping.', 'error'); }
}

async function deleteMapping(id) {
  if (!confirm('Hapus mapping ini?')) return;
  try {
    await apiDelete('/equipment-mappings/' + id);
    showMessage('Mapping berhasil dihapus.', 'success');
    loadMappings();
  } catch (e) { showMessage(e.message || 'Gagal menghapus mapping.', 'error'); }
}

// ── Bulk Create Mapping ───────────────────────────────────────────────────────
async function openBulkCreate() {
  _panelMode = 'bulk';
  document.getElementById('panelTitle').textContent = 'Bulk Mapping Equipment';
  document.getElementById('panelSave').textContent  = 'Simpan Semua';
  document.getElementById('panelBody').innerHTML = '<div style="padding:32px;text-align:center"><div class="spinner"></div></div>';
  openPanel();

  try {
    var r = await Promise.all([apiGet('/equipment?limit=9999'), apiGet('/task-lists')]);
    allEquipment = r[0].data || r[0];
    allTaskLists = Array.isArray(r[1]) ? r[1] : (r[1].data || []);
  } catch (e) { allEquipment = []; allTaskLists = []; }

  var ivOpts = INTERVALS.map(function(iv) {
    return '<option value="' + escHtml(iv) + '">' + escHtml(iv) + '</option>';
  }).join('');

  var tlOpts = allTaskLists.map(function(tl) {
    var id   = tl.taskListId || tl.id || '';
    var name = tl.taskListName || tl.name || id;
    return '<option value="' + escHtml(String(id)) + '">' + escHtml(name + ' (' + id + ')') + '</option>';
  }).join('');

  // Build searchable equipment checkbox list
  var eqItems = allEquipment.map(function(eq) {
    var id = eq.equipmentId || eq.id;
    var name = eq.equipmentName || eq.name || '';
    return '<label class="multi-select-item" style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer">' +
      '<input type="checkbox" name="bulkEq" value="' + escHtml(id) + '">' +
      '<span><strong>' + escHtml(id) + '</strong>' + (name ? ' — ' + escHtml(name) : '') + '</span>' +
      '</label>';
  }).join('');

  document.getElementById('panelBody').innerHTML =
    '<div class="form-section">' +
      '<div class="form-section__title">Pengaturan Mapping</div>' +
      '<div class="form-group"><label class="form-label">Interval *</label>' +
        '<select id="fb_interval">' + ivOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">Task List *</label>' +
        '<select id="fb_taskListId"><option value="">-- Pilih Task List --</option>' + tlOpts + '</select></div>' +
    '</div>' +
    '<div class="form-section">' +
      '<div class="form-section__title" style="margin-bottom:8px">Pilih Equipment</div>' +
      '<div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">' +
        '<input type="text" id="fb_eqSearch" placeholder="Cari equipment..." oninput="filterBulkEqList()" style="flex:1" />' +
        '<label style="white-space:nowrap;font-size:13px;cursor:pointer">' +
          '<input type="checkbox" id="fb_selectAll" onchange="toggleBulkSelectAll(this)"> Pilih Semua' +
        '</label>' +
      '</div>' +
      '<div id="fb_eqList" class="multi-select-list" style="max-height:320px;overflow-y:auto">' +
        (eqItems || '<p style="padding:12px;color:var(--text-muted)">Tidak ada equipment</p>') +
      '</div>' +
    '</div>';
}

function filterBulkEqList() {
  var q = (document.getElementById('fb_eqSearch').value || '').toLowerCase();
  document.querySelectorAll('#fb_eqList .multi-select-item').forEach(function(el) {
    el.style.display = !q || el.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
  });
}

function toggleBulkSelectAll(cb) {
  document.querySelectorAll('#fb_eqList input[name="bulkEq"]').forEach(function(el) {
    if (el.closest('.multi-select-item').style.display !== 'none') el.checked = cb.checked;
  });
}

async function saveBulkMapping() {
  var interval   = document.getElementById('fb_interval').value;
  var taskListId = document.getElementById('fb_taskListId').value;
  var equipmentIds = Array.from(document.querySelectorAll('#fb_eqList input[name="bulkEq"]:checked')).map(function(cb) { return cb.value; });

  if (!taskListId)       { showMessage('Task List harus dipilih.', 'error'); return; }
  if (!equipmentIds.length) { showMessage('Pilih minimal 1 equipment.', 'error'); return; }

  try {
    var result = await apiPost('/equipment-mappings/bulk', { equipmentIds: equipmentIds, interval: interval, taskListId: taskListId });
    showMessage(result.message || (equipmentIds.length + ' mapping berhasil diproses.'), 'success');
    closePanel();
    loadMappings();
  } catch (e) { showMessage(e.message || 'Gagal menyimpan bulk mapping.', 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// TASK LISTS
// ══════════════════════════════════════════════════════════════════════════════

async function loadTaskLists() {
  var tbody = document.getElementById('taskListBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><div class="spinner"></div></td></tr>';
  try {
    allTaskLists = await apiGet('/task-lists');
    renderTaskLists();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">' + escHtml(e.message) + '</td></tr>';
  }
}

function renderTaskLists() {
  var tbody = document.getElementById('taskListBody');
  if (!tbody) return;
  if (!allTaskLists.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Belum ada task list</td></tr>';
    return;
  }
  tbody.innerHTML = allTaskLists.map(function(tl) {
    var id    = tl.taskListId || tl.id || '';
    var name  = tl.taskListName || tl.name || id;
    var steps = tl.activities ? tl.activities.length : 0;
    return '<tr>' +
      '<td><code>' + escHtml(String(id)) + '</code></td>' +
      '<td><strong>' + escHtml(name) + '</strong></td>' +
      '<td>' + escHtml(tl.category || '') + '</td>' +
      '<td>' + escHtml(String(steps)) + ' langkah</td>' +
      '<td><div class="table-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="openEditTaskList(\'' + escHtml(String(id)) + '\')">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteTaskList(\'' + escHtml(String(id)) + '\')">Hapus</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

// ── Open Create Task List ─────────────────────────────────────────────────────
function openCreateTaskList() {
  _panelMode   = 'tasklist';
  _editingTlId = null;
  _tlActIdx    = 0;
  document.getElementById('panelTitle').textContent = 'Tambah Task List';
  document.getElementById('panelSave').textContent  = 'Simpan Task List';
  _renderTaskListForm({ taskListId: '', taskListName: '', category: 'Mekanik', workCenter: '', activities: [] });
  openPanel();
}

// ── Open Edit Task List ───────────────────────────────────────────────────────
async function openEditTaskList(taskListId) {
  _panelMode   = 'tasklist';
  _editingTlId = taskListId;
  _tlActIdx    = 0;
  document.getElementById('panelTitle').textContent = 'Edit Task List';
  document.getElementById('panelSave').textContent  = 'Simpan Perubahan';
  document.getElementById('panelBody').innerHTML    = '<div style="padding:32px;text-align:center"><div class="spinner"></div></div>';
  openPanel();

  try {
    var tl = await apiGet('/task-lists/' + taskListId);
    _tlActIdx = 0;
    _renderTaskListForm(tl);
  } catch (e) {
    showMessage('Gagal memuat task list: ' + e.message, 'error');
    closePanel();
  }
}

// ── Render Task List Form (shared by create + edit) ──────────────────────────
function _renderTaskListForm(tl) {
  var isEdit    = !!_editingTlId;
  var CATS      = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
  var catOpts   = CATS.map(function(c) {
    return '<option value="' + c + '"' + (tl.category === c ? ' selected' : '') + '>' + c + '</option>';
  }).join('');

  document.getElementById('panelBody').innerHTML =
    '<div class="form-section">' +
      '<div class="form-section__title">Informasi Task List</div>' +
      '<div class="form-group">' +
        '<label>ID Task List *</label>' +
        '<input id="tl_id" value="' + escHtml(tl.taskListId || '') + '" placeholder="cth. KTI_0020"' + (isEdit ? ' disabled style="opacity:.6"' : '') + '/>' +
        (isEdit ? '<span class="hint">ID tidak dapat diubah.</span>' : '') +
      '</div>' +
      '<div class="form-group"><label>Nama Task List *</label>' +
        '<input id="tl_name" value="' + escHtml(tl.taskListName || '') + '" placeholder="cth. Pemeriksaan Pompa Bulanan" /></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Kategori *</label><select id="tl_category">' + catOpts + '</select></div>' +
        '<div class="form-group"><label>Work Center</label>' +
        '<input id="tl_workcenter" value="' + escHtml(tl.workCenter || '') + '" placeholder="cth. WC-MEKANIK" /></div>' +
      '</div>' +
    '</div>' +
    '<div class="form-section">' +
      '<div class="form-section__title">Langkah-langkah Aktivitas</div>' +
      '<div class="dynamic-list" id="tlActivitiesList"></div>' +
      '<button type="button" class="add-row-btn" style="margin-top:8px" onclick="addTlActivityRow()">+ Tambah Langkah</button>' +
    '</div>';

  // Populate existing activities
  var acts = tl.activities || [];
  if (acts.length) {
    acts.forEach(function(a) { addTlActivityRow(a.operationText); });
  } else {
    addTlActivityRow(''); // one blank row for new
  }
}

// ── Add one activity row ──────────────────────────────────────────────────────
function addTlActivityRow(value) {
  var list = document.getElementById('tlActivitiesList');
  if (!list) return;
  var idx   = _tlActIdx++;
  var val   = value || '';
  var num   = list.children.length + 1;
  var div   = document.createElement('div');
  div.className = 'dynamic-item';
  div.id        = 'tlRow_' + idx;
  // Use correct structure: step num badge | flex-1 input | remove btn
  div.innerHTML =
    '<span style="min-width:22px;font-size:12px;font-weight:700;color:var(--text-muted);padding-top:7px;text-align:center">' + num + '</span>' +
    '<div class="flex-1"><input type="text" style="width:100%;border:1px solid var(--border-color);border-radius:4px;padding:6px 10px;font-size:13px;color:var(--text-base);background:#fff;outline:none" ' +
      'placeholder="Deskripsi langkah / operasi" id="tl_op_' + idx + '" value="' + escHtml(val) + '" /></div>' +
    '<button type="button" class="btn-remove" onclick="removeRow(\'tlRow_' + idx + '\')">&#x2715;</button>';
  list.appendChild(div);
}

// ── Save (Create or Update) Task List ────────────────────────────────────────
async function saveTaskList() {
  var taskListName = ((document.getElementById('tl_name')       || {}).value || '').trim();
  var category     = ((document.getElementById('tl_category')   || {}).value || '');
  var workCenter   = ((document.getElementById('tl_workcenter') || {}).value || '').trim();

  if (!taskListName) { showMessage('Nama Task List wajib diisi.', 'error'); return; }

  // Collect activities
  var activities = [];
  var rows = document.querySelectorAll('#tlActivitiesList .dynamic-item');
  rows.forEach(function(row, i) {
    var inp = row.querySelector('input[type="text"]');
    var txt = inp ? inp.value.trim() : '';
    if (txt) activities.push({ stepNumber: i + 1, operationText: txt });
  });

  try {
    if (_editingTlId) {
      // ── Edit mode ──
      await apiPut('/task-lists/' + _editingTlId, { taskListName, category, workCenter: workCenter || null, activities });
      showMessage('Task List \'' + _editingTlId + '\' berhasil diperbarui.', 'success');
    } else {
      // ── Create mode ──
      var taskListId = ((document.getElementById('tl_id') || {}).value || '').trim();
      if (!taskListId) { showMessage('ID Task List wajib diisi.', 'error'); return; }
      await apiPost('/task-lists', { taskListId, taskListName, category, workCenter: workCenter || null, activities });
      showMessage('Task List \'' + taskListId + '\' berhasil dibuat.', 'success');
    }
    closePanel();
    loadTaskLists();
  } catch (e) { showMessage(e.message || 'Gagal menyimpan task list.', 'error'); }
}

// ── Delete Task List ──────────────────────────────────────────────────────────
async function deleteTaskList(taskListId) {
  if (!confirm('Hapus task list ' + taskListId + '?\nSemua mapping yang menggunakan task list ini juga akan terhapus.')) return;
  try {
    await apiDelete('/task-lists/' + taskListId);
    showMessage('Task list ' + taskListId + ' dihapus.', 'success');
    loadTaskLists();
    loadMappings();
  } catch (e) { showMessage(e.message || 'Gagal menghapus task list.', 'error'); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function removeRow(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
  // Re-number remaining rows
  var rows = document.querySelectorAll('#tlActivitiesList .dynamic-item');
  rows.forEach(function(row, i) {
    var numEl = row.querySelector('span');
    if (numEl) numEl.textContent = i + 1;
  });
}

// apiPut helper (if not already in app.js)
function apiPut(path, body) {
  var token = localStorage.getItem('token');
  return fetch('/api' + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body),
  }).then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      return data;
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadMappings();
loadTaskLists();
