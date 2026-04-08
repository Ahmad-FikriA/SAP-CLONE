/* ─── Users Page Logic ─── */

let allUsers = [];
let editingUserId = null;

// ── Load & render ──────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('usersBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="10"><div class="spinner"></div></td></tr>';
  try {
    const role = document.getElementById('filterRole').value;
    allUsers = await apiGet('/users' + (role ? `?role=${role}` : ''));
    renderUsers();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">${e.message}</td></tr>`;
  }
}

function renderUsers() {
  const tbody = document.getElementById('usersBody');
  if (!allUsers.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }
  tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td class="col-check"><input type="checkbox" name="bulk" value="${escHtml(u.id)}" onchange="updateBulkBar()"></td>
      <td><strong>${escHtml(u.nik)}</strong></td>
      <td>${escHtml(u.name)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${escHtml(u.dinas || '-')}</td>
      <td>${escHtml(u.divisi)}</td>
      <td>${escHtml(u.group || '-')}</td>
      <td>${escHtml(u.email || '-')}</td>
      <td>
        <div class="password-cell">
          <span style="letter-spacing:2px;font-size:16px">••••••</span>
          <button class="btn btn-ghost btn-sm" onclick="resetPassword('${escHtml(u.id)}', '${escHtml(u.nik)}')">Reset</button>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEdit('${escHtml(u.id)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${escHtml(u.id)}', '${escHtml(u.nik)}')">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
  updateBulkBar();
}

// ── Panel ──────────────────────────────────────────────────────────────────
function openCreate() {
  editingUserId = null;
  document.getElementById('panelTitle').textContent = 'Tambah User';
  renderForm(null);
  openPanel();
}

function openEdit(id) {
  editingUserId = id;
  document.getElementById('panelTitle').textContent = 'Edit User';
  const u = allUsers.find(u => u.id === id);
  renderForm(u);
  openPanel();
}

function renderForm(u) {
  const isEdit = !!u;
  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Informasi User</div>
      <div class="form-row">
        <div class="form-group" style="display:none;">
          <input id="f_id" value="${escHtml(u?.id || '')}" />
        </div>
        <div class="form-group">
          <label>NIK *</label>
          <input id="f_nik" value="${escHtml(u?.nik || '')}" placeholder="Masukkan NIK" />
        </div>
        <div class="form-group">
          <label>Nama Lengkap *</label>
          <input id="f_name" value="${escHtml(u?.name || '')}" placeholder="Nama lengkap" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Jabatan (Role) *</label>
          <input id="f_role" value="${escHtml(u?.role || '')}" placeholder="teknisi / kadis / dll" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="f_email" value="${escHtml(u?.email || '')}" placeholder="user@kti-water.co.id" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Dinas</label>
          <input id="f_dinas" value="${escHtml(u?.dinas || '')}" placeholder="Nama Dinas (opsional)" />
        </div>
        <div class="form-group">
          <label>Divisi *</label>
          <input id="f_divisi" value="${escHtml(u?.divisi || '')}" placeholder="Nama Divisi" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Group</label>
          <input id="f_group" value="${escHtml(u?.group || '')}" placeholder="Nama Group (opsional)" />
        </div>
      </div>
      ${!isEdit ? `
      <div class="form-row full">
        <div class="form-group">
          <label>Password</label>
          <input type="text" id="f_password" value="password123" placeholder="password123" />
          <span class="hint">Default: password123</span>
        </div>
      </div>` : ''}
    </div>
  `;
}

// ── Save ────────────────────────────────────────────────────────────────────
async function saveUser() {
  const idRaw = document.getElementById('f_id').value.trim();
  const id = idRaw || `USR-${Math.floor(Math.random() * 100000)}`;
  const nik = document.getElementById('f_nik').value.trim();
  const name = document.getElementById('f_name').value.trim();
  const role = document.getElementById('f_role').value.trim();
  const dinas = document.getElementById('f_dinas').value.trim();
  const divisi = document.getElementById('f_divisi').value.trim();
  const email = document.getElementById('f_email').value.trim();
  const group = document.getElementById('f_group').value.trim();

  if (!nik || !name || !role || !divisi) { 
    alert('NIK, Nama, Jabatan, dan Divisi wajib diisi.'); 
    return; 
  }

  const body = { id, nik, name, role, dinas, divisi, email, group: group || null };
  if (!editingUserId) {
    const pw = document.getElementById('f_password');
    body.password = pw ? pw.value.trim() || 'password123' : 'password123';
  }

  try {
    if (editingUserId) {
      await apiPut(`/users/${editingUserId}`, body);
      showMessage(`User dengan NIK ${nik} diperbarui`);
    } else {
      await apiPost('/users', body);
      showMessage(`User NIK ${nik} ditambahkan`);
    }
    closePanel();
    loadUsers();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Reset password ──────────────────────────────────────────────────────────
async function resetPassword(id, nik) {
  if (!window.confirm(`Reset password ${nik} ke "password123"?`)) return;
  try {
    await apiPut(`/users/${id}`, { password: 'password123' });
    showMessage(`Password ${nik} direset ke password123`);
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Delete user ─────────────────────────────────────────────────────────────
async function deleteUser(id, nik) {
  if (!window.confirm('Hapus user ' + nik + '?')) return;
  try {
    await apiDelete('/users/' + id);
    showMessage('User ' + nik + ' dihapus');
    loadUsers();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Bulk Delete users ───────────────────────────────────────────────────────
async function bulkDeleteUsers() {
  var ids = getCheckedIds();
  if (!ids.length) return;
  if (!window.confirm('Hapus ' + ids.length + ' user terpilih?')) return;
  try {
    await apiPost('/users/bulk-delete', { ids: ids });
    showMessage(ids.length + ' user berhasil dihapus');
    loadUsers();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Export to Excel ───────────────────────────────────────────────────────────
function exportToExcel() {
  if (!allUsers.length) {
    showMessage('Tidak ada data user untuk diekspor', 'error');
    return;
  }
  
  // Format data for excel sheet
  const data = allUsers.map((u, index) => ({
    No: index + 1,
    NIK: u.nik,
    Nama: u.name,
    Jabatan: u.role,
    Dinas: u.dinas || '-',
    Divisi: u.divisi || '-',
    Group: u.group || '-',
    Email: u.email || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
  
  // Adjust column widths
  const max_width = data.reduce((w, r) => Math.max(w, r.Nama.length), 10);
  worksheet["!cols"] = [ { wch: 5 }, { wch: 15 }, { wch: max_width }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 } ];

  // Generate date string for filename
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Data_Users_${dateStr}.xlsx`);
}

// ── Init ────────────────────────────────────────────────────────────────────
loadUsers();
