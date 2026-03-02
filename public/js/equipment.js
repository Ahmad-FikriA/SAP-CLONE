/* ─── Equipment Page Logic ─── */

let allEquipment = [];
let editingEquipId = null;

// ── Load & render ──────────────────────────────────────────────────────────
async function loadEquipment() {
  const tbody = document.getElementById('equipBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><div class="spinner"></div></td></tr>';
  try {
    const cat = document.getElementById('filterCategory').value;
    allEquipment = await apiGet('/equipment' + (cat ? `?category=${cat}` : ''));
    renderEquipment();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">${e.message}</td></tr>`;
  }
}

function renderEquipment() {
  const tbody = document.getElementById('equipBody');
  if (!allEquipment.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }
  tbody.innerHTML = allEquipment.map(eq => `
    <tr>
      <td><strong>${escHtml(eq.equipmentId)}</strong></td>
      <td>${escHtml(eq.equipmentName)}</td>
      <td>${escHtml(eq.functionalLocation)}</td>
      <td><span class="badge badge-in_progress" style="background:#EBF5FB">${escHtml(eq.category)}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEdit('${escHtml(eq.equipmentId)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEquipment('${escHtml(eq.equipmentId)}')">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Panel ──────────────────────────────────────────────────────────────────
function openCreate() {
  editingEquipId = null;
  document.getElementById('panelTitle').textContent = 'Tambah Equipment';
  renderForm(null);
  openPanel();
}

function openEdit(id) {
  editingEquipId = id;
  document.getElementById('panelTitle').textContent = 'Edit Equipment';
  const eq = allEquipment.find(e => e.equipmentId === id);
  renderForm(eq);
  openPanel();
}

function renderForm(eq) {
  const cats = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Detail Equipment</div>
      <div class="form-row full">
        <div class="form-group">
          <label>Equipment ID *</label>
          <input id="f_equipId" value="${escHtml(eq?.equipmentId || '')}" ${eq ? 'readonly' : ''} placeholder="EQ-011" />
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Nama Equipment *</label>
          <input id="f_equipName" value="${escHtml(eq?.equipmentName || '')}" placeholder="Nama peralatan" />
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Functional Location *</label>
          <input id="f_location" value="${escHtml(eq?.functionalLocation || '')}" placeholder="Lokasi fungsi" />
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Kategori *</label>
          <select id="f_category">
            ${cats.map(c => `<option ${eq?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  `;
}

// ── Save ────────────────────────────────────────────────────────────────────
async function saveEquipment() {
  const equipmentId        = document.getElementById('f_equipId').value.trim();
  const equipmentName      = document.getElementById('f_equipName').value.trim();
  const functionalLocation = document.getElementById('f_location').value.trim();
  const category           = document.getElementById('f_category').value;

  if (!equipmentId || !equipmentName) { alert('ID dan Nama Equipment wajib diisi.'); return; }

  const body = { equipmentId, equipmentName, functionalLocation, category };

  try {
    if (editingEquipId) {
      await apiPut(`/equipment/${editingEquipId}`, body);
      showMessage(`Equipment ${equipmentId} diperbarui`);
    } else {
      await apiPost('/equipment', body);
      showMessage(`Equipment ${equipmentId} ditambahkan`);
    }
    closePanel();
    loadEquipment();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Delete ──────────────────────────────────────────────────────────────────
async function deleteEquipment(id) {
  if (!window.confirm(`Hapus equipment ${id}?`)) return;
  try {
    await apiDelete(`/equipment/${id}`);
    showMessage(`Equipment ${id} dihapus`);
    loadEquipment();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Init ────────────────────────────────────────────────────────────────────
loadEquipment();
