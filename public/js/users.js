/* ─── Users Page Logic ─── */

let allUsers = [];
let editingUserId = null;

// ── Load & render ──────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('usersBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="6"><div class="spinner"></div></td></tr>';
  try {
    const role = document.getElementById('filterRole').value;
    allUsers = await apiGet('/users' + (role ? `?role=${role}` : ''));
    renderUsers();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">${e.message}</td></tr>`;
  }
}

function renderUsers() {
  const tbody = document.getElementById('usersBody');
  if (!allUsers.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }
  tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td class="col-check"><input type="checkbox" name="bulk" value="${escHtml(u.id)}" onchange="updateBulkBar()"></td>
      <td><strong>${escHtml(u.username)}</strong></td>
      <td>${escHtml(u.name)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${escHtml(u.email)}</td>
      <td>
        <div class="password-cell">
          <span style="letter-spacing:2px;font-size:16px">••••••</span>
          <button class="btn btn-ghost btn-sm" onclick="resetPassword('${escHtml(u.id)}', '${escHtml(u.username)}')">Reset</button>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEdit('${escHtml(u.id)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${escHtml(u.id)}', '${escHtml(u.username)}')">Hapus</button>
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
  const roles = ['teknisi', 'planner', 'supervisor', 'manager', 'admin'];
  const isEdit = !!u;
  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Informasi User</div>
      <div class="form-row">
        <div class="form-group">
          <label>User ID *</label>
          <input id="f_userId" value="${escHtml(u?.id || '')}" ${isEdit ? 'readonly' : ''} placeholder="USR-006" />
        </div>
        <div class="form-group">
          <label>Username *</label>
          <input id="f_username" value="${escHtml(u?.username || '')}" placeholder="teknisi_02" />
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Nama Lengkap *</label>
          <input id="f_name" value="${escHtml(u?.name || '')}" placeholder="Nama lengkap" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Role *</label>
          <select id="f_role">
            ${roles.map(r => `<option value="${r}" ${u?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="f_email" value="${escHtml(u?.email || '')}" placeholder="user@kti-water.co.id" />
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
  const id = document.getElementById('f_userId').value.trim();
  const username = document.getElementById('f_username').value.trim();
  const name = document.getElementById('f_name').value.trim();
  const role = document.getElementById('f_role').value;
  const email = document.getElementById('f_email').value.trim();

  if (!id || !username || !name) { alert('ID, Username, dan Nama wajib diisi.'); return; }

  const body = { id, username, name, role, email };
  if (!editingUserId) {
    const pw = document.getElementById('f_password');
    body.password = pw ? pw.value.trim() || 'password123' : 'password123';
  }

  try {
    if (editingUserId) {
      await apiPut(`/users/${editingUserId}`, body);
      showMessage(`User ${username} diperbarui`);
    } else {
      await apiPost('/users', body);
      showMessage(`User ${username} ditambahkan`);
    }
    closePanel();
    loadUsers();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Reset password ──────────────────────────────────────────────────────────
async function resetPassword(id, username) {
  if (!window.confirm(`Reset password ${username} ke "password123"?`)) return;
  try {
    await apiPut(`/users/${id}`, { password: 'password123' });
    showMessage(`Password ${username} direset ke password123`);
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Delete user ─────────────────────────────────────────────────────────────
async function deleteUser(id, username) {
  if (!window.confirm('Hapus user ' + username + '?')) return;
  try {
    await apiDelete('/users/' + id);
    showMessage('User ' + username + ' dihapus');
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

// ── Init ────────────────────────────────────────────────────────────────────
loadUsers();
