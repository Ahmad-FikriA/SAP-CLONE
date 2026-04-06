/* ─── Lembar Kerja Page Logic ─── */

let allLk = [];
let editingLkNumber = null;
let availableSpk = [];

// ── Load & render ──────────────────────────────────────────────────────────
async function loadLk() {
  const tbody = document.getElementById('lkBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="spinner"></div></td></tr>';
  try {
    const category = document.getElementById('filterCategory').value;
    allLk = await apiGet('/lk' + (category ? `?category=${category}` : ''));
    renderLk();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">${e.message}</td></tr>`;
  }
}

function renderLk() {
  const statusFilter = document.getElementById('filterStatus').value;
  let data = statusFilter ? allLk.filter(l => l.status === statusFilter) : allLk;
  const tbody = document.getElementById('lkBody');

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(l => {
    const spkList = (l.spkModels || []);
    const spkCount = spkList.length;
    return `
    <tr>
      <td class="col-check"><input type="checkbox" name="bulk" value="${escHtml(l.lkNumber)}" onchange="updateBulkBar()"></td>
      <td><strong>${escHtml(l.lkNumber)}</strong></td>
      <td>${escHtml(l.category)}</td>
      <td class="text-small">${formatPeriod(l.periodeStart, l.periodeEnd)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>${l.lembarKe} / ${l.totalLembar}</td>
      <td>${spkCount} SPK</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="viewDetail('${escHtml(l.lkNumber)}')">Detail</button>
          <button class="btn btn-secondary btn-sm" onclick="openEdit('${escHtml(l.lkNumber)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteLk('${escHtml(l.lkNumber)}')">Hapus</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  updateBulkBar();
}

// ── View Detail ────────────────────────────────────────────────────────────
function viewDetail(lkNumber) {
  const lk = allLk.find(l => l.lkNumber === lkNumber);
  if (!lk) return;
  document.getElementById('detailTitle').textContent = `Detail — ${lkNumber}`;

  const spks = (lk.spkModels || []);
  const spkHtml = spks.map(s => {
    if (typeof s === 'object') {
      return `
        <div style="border:1px solid var(--border-color);border-radius:6px;padding:12px;margin-bottom:8px;background:#FAFAFA">
          <div style="font-weight:600">${escHtml(s.spkNumber)} — ${escHtml(s.description || '')}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
            ${escHtml(s.category || '')} | ${escHtml(s.interval || '')} | ${statusBadge(s.status)}
          </div>
          <div style="font-size:12px;margin-top:6px;color:var(--text-muted)">${(s.activitiesModel || []).length} aktivitas</div>
        </div>`;
    }
    return `<div style="padding:8px;color:var(--text-muted)">${s}</div>`;
  }).join('') || '<p style="color:var(--text-muted)">Tidak ada SPK</p>';

  document.getElementById('detailBody').innerHTML = `
    <div class="form-row" style="margin-bottom:12px">
      <div><span class="text-muted text-small">LK Number</span><br><strong>${escHtml(lk.lkNumber)}</strong></div>
      <div><span class="text-muted text-small">Status</span><br>${statusBadge(lk.status)}</div>
    </div>
    <div class="form-row" style="margin-bottom:12px">
      <div><span class="text-muted text-small">Kategori</span><br>${escHtml(lk.category)}</div>
      <div><span class="text-muted text-small">Lembar</span><br>${lk.lembarKe} / ${lk.totalLembar}</div>
    </div>
    <div style="margin-bottom:12px"><span class="text-muted text-small">Periode</span><br>${formatPeriod(lk.periodeStart, lk.periodeEnd)}</div>
    ${lk.evaluasi ? `<div style="margin-bottom:12px"><span class="text-muted text-small">Evaluasi</span><br>${escHtml(lk.evaluasi)}</div>` : ''}
    <div class="form-section__title" style="margin-top:16px">SPK Terkait (${spks.length})</div>
    <div style="margin-top:10px">${spkHtml}</div>
  `;

  document.getElementById('detailModal').classList.add('show');
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('show');
}

// ── Open create ────────────────────────────────────────────────────────────
async function openCreate() {
  editingLkNumber = null;
  document.getElementById('panelTitle').textContent = 'Tambah Lembar Kerja';
  await loadSpkList('');
  renderPanelForm(null);
  openPanel();
}

// ── Open edit ──────────────────────────────────────────────────────────────
async function openEdit(lkNumber) {
  editingLkNumber = lkNumber;
  document.getElementById('panelTitle').textContent = 'Edit Lembar Kerja';
  const lk = allLk.find(l => l.lkNumber === lkNumber);
  await loadSpkList(lk?.category || '');
  renderPanelForm(lk);
  openPanel();
}

async function loadSpkList(category) {
  try {
    availableSpk = await apiGet('/spk' + (category ? `?category=${category}` : ''));
  } catch { availableSpk = []; }
}

// ── Render panel form ──────────────────────────────────────────────────────
function renderPanelForm(lk) {
  const isEdit = !!lk;
  const categories = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
  const statuses   = ['pending', 'in_progress', 'completed'];

  const today = new Date().toISOString().slice(0, 10);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

  const selectedSpkNumbers = lk
    ? (lk.spkModels || []).map(s => (typeof s === 'object' ? s.spkNumber : s))
    : [];

  const spkHtml = availableSpk.map(s => {
    const checked = selectedSpkNumbers.includes(s.spkNumber) ? 'checked' : '';
    return `
      <div class="multi-select-item">
        <input type="checkbox" id="spk_${s.spkNumber}" name="spkRef" value="${s.spkNumber}" ${checked}>
        <label for="spk_${s.spkNumber}">
          <strong>${escHtml(s.spkNumber)}</strong> — ${escHtml(s.description)}
          <span> ${statusBadge(s.status)}</span>
        </label>
      </div>`;
  }).join('') || '<p style="padding:12px;color:var(--text-muted)">Tidak ada SPK untuk kategori ini</p>';

  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Informasi LK</div>
      <div class="form-row">
        <div class="form-group">
          <label>LK Number *</label>
          <input id="f_lkNumber" value="${escHtml(lk?.lkNumber || suggestLkNumber())}" ${isEdit ? 'readonly' : ''} />
        </div>
        <div class="form-group">
          <label>Kategori *</label>
          <select id="f_category" onchange="onCategoryChange(this.value)">
            ${categories.map(c => `<option ${lk?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Periode Start</label>
          <input type="date" id="f_start" value="${(lk?.periodeStart || today + 'T00:00:00.000Z').slice(0,10)}" />
        </div>
        <div class="form-group">
          <label>Periode End</label>
          <input type="date" id="f_end" value="${(lk?.periodeEnd || endOfMonth + 'T23:59:59.000Z').slice(0,10)}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Lembar Ke</label>
          <input type="number" id="f_lembarKe" min="1" value="${lk?.lembarKe || 1}" />
        </div>
        <div class="form-group">
          <label>Total Lembar</label>
          <input type="number" id="f_totalLembar" min="1" value="${lk?.totalLembar || 1}" />
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Status</label>
          <select id="f_status">
            ${statuses.map(s => `<option value="${s}" ${lk?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section__title">SPK Terkait</div>
      <div class="multi-select-list" id="spkList">${spkHtml}</div>
    </div>
  `;
}

async function onCategoryChange(cat) {
  await loadSpkList(cat);
  const spkHtml = availableSpk.map(s => `
    <div class="multi-select-item">
      <input type="checkbox" id="spk_${s.spkNumber}" name="spkRef" value="${s.spkNumber}">
      <label for="spk_${s.spkNumber}">
        <strong>${escHtml(s.spkNumber)}</strong> — ${escHtml(s.description)}
        <span> ${statusBadge(s.status)}</span>
      </label>
    </div>
  `).join('') || '<p style="padding:12px;color:var(--text-muted)">Tidak ada SPK</p>';
  document.getElementById('spkList').innerHTML = spkHtml;
}

function suggestLkNumber() {
  const year = new Date().getFullYear();
  const max = allLk.reduce((m, l) => {
    const match = l.lkNumber.match(/LK-\d+-(\d+)/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  return `LK-${year}-${String(max + 1).padStart(3, '0')}`;
}

// ── Save LK ────────────────────────────────────────────────────────────────
async function saveLk() {
  const lkNumber = document.getElementById('f_lkNumber').value.trim();
  const category = document.getElementById('f_category').value;
  const startVal = document.getElementById('f_start').value;
  const endVal   = document.getElementById('f_end').value;
  const lembarKe = parseInt(document.getElementById('f_lembarKe').value);
  const totalLembar = parseInt(document.getElementById('f_totalLembar').value);
  const status   = document.getElementById('f_status').value;

  if (!lkNumber) { alert('LK Number wajib diisi.'); return; }

  const spkModels = [...document.querySelectorAll('input[name="spkRef"]:checked')].map(cb => cb.value);
  const body = {
    lkNumber, category,
    periodeStart: new Date(startVal).toISOString(),
    periodeEnd:   new Date(endVal + 'T23:59:59').toISOString(),
    lembarKe, totalLembar, status, evaluasi: null,
    spkModels
  };

  try {
    if (editingLkNumber) {
      await apiPut(`/lk/${editingLkNumber}`, body);
      showMessage(`LK ${lkNumber} diperbarui`);
    } else {
      await apiPost('/lk', body);
      showMessage(`LK ${lkNumber} berhasil dibuat`);
    }
    closePanel();
    loadLk();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Bulk Delete LK ─────────────────────────────────────────────────────────
async function bulkDeleteLk() {
  var ids = getCheckedIds();
  if (!ids.length) return;
  if (!window.confirm('Hapus ' + ids.length + ' Lembar Kerja terpilih? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    await apiPost('/lk/bulk-delete', { ids: ids });
    showMessage(ids.length + ' LK berhasil dihapus');
    loadLk();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Delete LK ──────────────────────────────────────────────────────────────
async function deleteLk(lkNumber) {
  if (!window.confirm(`Hapus Lembar Kerja ${lkNumber}?`)) return;
  try {
    await apiDelete(`/lk/${lkNumber}`);
    showMessage(`LK ${lkNumber} dihapus`);
    loadLk();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Init ────────────────────────────────────────────────────────────────────
loadLk();
