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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td><strong>${escHtml(s.spkNumber)}</strong></td>
      <td>${escHtml(s.description)}</td>
      <td>${escHtml(s.category || '—')}</td>
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
    availableEquipment = await apiGet('/equipment');
  } catch { availableEquipment = []; }
}

// ── Render panel form ─────────────────────────────────────────────────────
function renderPanelForm(spk) {
  const isEdit = !!spk;
  const categories = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
  const intervals  = ['1 Minggu', '2 Minggu', '1 Bulan', '3 Bulan', '6 Bulan', '1 Tahun'];
  const statuses   = ['pending', 'in_progress', 'completed'];

  // Equipment checkboxes
  const eqHtml = availableEquipment.map(eq => {
    const checked = spk && (spk.equipmentModels || []).some(e => e.equipmentId === eq.equipmentId) ? 'checked' : '';
    return `
      <div class="multi-select-item">
        <input type="checkbox" id="eq_${eq.equipmentId}" name="equipment" value="${eq.equipmentId}" ${checked}>
        <label for="eq_${eq.equipmentId}">
          <strong>${escHtml(eq.equipmentId)}</strong> — ${escHtml(eq.equipmentName)}
          <span class="text-muted text-small"> (${escHtml(eq.category)})</span>
        </label>
      </div>`;
  }).join('');

  // Activities
  const acts = (spk && spk.activitiesModel) || [];
  const actsHtml = acts.map((a, i) => activityRow(i, a)).join('');

  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Informasi SPK</div>
      <div class="form-row">
        <div class="form-group">
          <label>SPK Number *</label>
          <input id="f_spkNumber" value="${escHtml(spk?.spkNumber || suggestSpkNumber())}" ${isEdit ? 'readonly' : ''} />
        </div>
        <div class="form-group">
          <label>Interval *</label>
          <select id="f_interval">
            ${intervals.map(v => `<option ${spk?.interval === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Deskripsi *</label>
          <input id="f_description" value="${escHtml(spk?.description || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kategori *</label>
          <select id="f_category">
            ${categories.map(c => `<option ${spk?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="f_status">
            ${statuses.map(s => `<option value="${s}" ${spk?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section__title">Equipment</div>
      <div class="multi-select-list">${eqHtml || '<p style="padding:12px;color:var(--text-muted)">Tidak ada equipment</p>'}</div>
    </div>

    <div class="form-section">
      <div class="form-section__title">Aktivitas</div>
      <div class="dynamic-list" id="actsList">${actsHtml}</div>
      <button type="button" class="add-row-btn mt-12" onclick="addActivityRow()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Tambah Aktivitas
      </button>
    </div>
  `;
}

function activityRow(idx, act = {}) {
  return `
    <div class="dynamic-item" id="actRow_${idx}">
      <div class="flex-1">
        <input class="w-full" placeholder="Teks operasi / deskripsi aktivitas"
          value="${escHtml(act.operationText || '')}" id="act_op_${idx}" />
      </div>
      <div class="w-24">
        <input type="number" min="0" step="0.25" placeholder="Durasi (jam)"
          value="${act.durationPlan != null ? act.durationPlan : ''}" id="act_dur_${idx}" />
      </div>
      <button type="button" class="btn-remove" onclick="removeRow('actRow_${idx}')">✕</button>
    </div>
  `;
}
let _actIdx = 100;
function addActivityRow() {
  const container = document.getElementById('actsList');
  const div = document.createElement('div');
  div.innerHTML = activityRow(_actIdx++);
  container.appendChild(div.firstElementChild);
}

function removeRow(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function suggestSpkNumber() {
  const year = new Date().getFullYear();
  const max = allSpk.reduce((m, s) => {
    const match = s.spkNumber.match(/SPK-\d+-(\d+)/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  return `SPK-${year}-${String(max + 1).padStart(3, '0')}`;
}

// ── Save SPK ────────────────────────────────────────────────────────────
async function saveSpk() {
  const spkNumber  = document.getElementById('f_spkNumber').value.trim();
  const description = document.getElementById('f_description').value.trim();
  const interval   = document.getElementById('f_interval').value;
  const category   = document.getElementById('f_category').value;
  const status     = document.getElementById('f_status').value;

  if (!spkNumber || !description) { alert('SPK Number dan Deskripsi wajib diisi.'); return; }

  // Collect selected equipment
  const checkedEq = [...document.querySelectorAll('input[name="equipment"]:checked')].map(cb => {
    const eq = availableEquipment.find(e => e.equipmentId === cb.value);
    return { equipmentId: eq.equipmentId, equipmentName: eq.equipmentName, functionalLocation: eq.functionalLocation };
  });

  // Collect activities
  const actRows = document.querySelectorAll('#actsList .dynamic-item');
  const activitiesModel = [...actRows].map((row, i) => {
    const opInput  = row.querySelector('input[id^="act_op_"]');
    const durInput = row.querySelector('input[id^="act_dur_"]');
    return {
      activityNumber: `ACT-${String(i + 1).padStart(3, '0')}`,
      operationText: opInput ? opInput.value.trim() : '',
      resultComment: null,
      durationPlan: durInput ? parseFloat(durInput.value) || 0 : 0,
      durationActual: null,
      isVerified: false
    };
  }).filter(a => a.operationText);

  const body = { spkNumber, description, interval, category, status,
    durationActual: null, equipmentModels: checkedEq, activitiesModel };

  try {
    if (editingSpkNumber) {
      await apiPut(`/spk/${editingSpkNumber}`, body);
      showMessage(`SPK ${spkNumber} berhasil diperbarui`);
    } else {
      await apiPost('/spk', body);
      showMessage(`SPK ${spkNumber} berhasil dibuat`);
    }
    closePanel();
    loadSpk();
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

// ── Delete SPK ─────────────────────────────────────────────────────────
async function deleteSpk(spkNumber) {
  if (!window.confirm(`Hapus SPK ${spkNumber}? Tindakan ini tidak dapat dibatalkan.`)) return;
  try {
    await apiDelete(`/spk/${spkNumber}`);
    showMessage(`SPK ${spkNumber} dihapus`);
    loadSpk();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Reset SPK ──────────────────────────────────────────────────────────
async function resetSpk(spkNumber) {
  if (!window.confirm(`Reset SPK ${spkNumber} ke status pending?`)) return;
  try {
    const spk = allSpk.find(s => s.spkNumber === spkNumber);
    const resetActs = (spk.activitiesModel || []).map(a => ({
      ...a, resultComment: null, durationActual: null, isVerified: false
    }));
    await apiPut(`/spk/${spkNumber}`, { status: 'pending', durationActual: null, activitiesModel: resetActs });
    showMessage(`SPK ${spkNumber} direset`);
    loadSpk();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Init ────────────────────────────────────────────────────────────────
loadSpk();
