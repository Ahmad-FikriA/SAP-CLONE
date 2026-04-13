let allRequests = [];
let allSpks = [];

document.addEventListener('DOMContentLoaded', () => {
  loadRequests();
  loadSpk();
});

// Basic Tab Switcher
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  
  if(tabId === 'tab-requests') {
    document.getElementById('nav-requests').classList.add('active');
    document.getElementById('tab-requests').classList.add('active');
  } else {
    document.getElementById('nav-spk').classList.add('active');
    document.getElementById('tab-spk').classList.add('active');
  }
}

function refreshData() {
  loadRequests();
  loadSpk();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Corrective Requests
// ─────────────────────────────────────────────────────────────────────────────
async function loadRequests() {
  const tbody = document.getElementById('reqBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="spinner"></div></td></tr>';
  
  try {
    const statusFilter = document.getElementById('filterReqStatus').value;
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    allRequests = await apiGet('/corrective/requests' + qs);
    
    if (allRequests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Belum ada notifikasi / request</td></tr>';
      return;
    }

    // Role badge specific to corrective
    const getStatusBadge = (status) => {
      if(status === 'approved') return statusBadge('approved'); 
      if(status === 'spk_created') return statusBadge('completed');
      if(status === 'menunggu_review_awal_kadis_pp') return statusBadge('pending');
      return statusBadge(status);
    };

    tbody.innerHTML = allRequests.map(req => {
      let actions = '';
      if (req.status === 'approved') {
        actions = `<button class="btn btn-primary btn-sm" onclick="openSpkPanel('${req.id}')">Generate SPK</button>`;
      } else if (req.status === 'spk_created') {
         actions = `<span style="font-size: 13px; color: var(--text-muted);">SPK: ${escHtml(req.priority || '')}</span>`;
      } else {
         actions = `<span style="font-size: 13px; color: var(--text-muted);">-</span>`;
      }

      return `
        <tr>
          <td><strong>${escHtml(req.id)}</strong></td>
          <td>
            <div>${formatDate(req.submittedAt)}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${escHtml(req.reportedBy)}</div>
          </td>
          <td>
            <div>${escHtml(req.equipment)}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${escHtml(req.workCenter || '')} - ${escHtml(req.functionalLocation || '')}</div>
          </td>
          <td>${escHtml(req.notificationType)}</td>
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escHtml(req.description)}
          </td>
          <td>${getStatusBadge(req.status)}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    showMessage(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger-color)">Gagal memuat notifikasi</td></tr>';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: SPK Corrective
// ─────────────────────────────────────────────────────────────────────────────
async function loadSpk() {
  const tbody = document.getElementById('spkBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="spinner"></div></td></tr>';
  
  try {
    const statusFilter = document.getElementById('filterSpkStatus').value;
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    allSpks = await apiGet('/corrective/spk' + qs);
    
    if (allSpks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Belum ada SPK Corrective</td></tr>';
      return;
    }

    tbody.innerHTML = allSpks.map(spk => `
        <tr>
          <td><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></td>
          <td>${escHtml(spk.orderNumber)}</td>
          <td>${formatDate(spk.createdDate)}</td>
          <td>
             <div>${escHtml(spk.equipmentId)}</div>
             <div style="font-size: 12px; color: var(--text-muted);">${escHtml(spk.workCenter || '')}</div>
          </td>
          <td><span class="badge badge-error" style="background:var(--bg-body);color:currentColor">${escHtml(spk.priority)}</span></td>
          <td>${statusBadge(spk.status)}</td>
          <td>
             ${spk.status === 'draft' ? `<button class="btn btn-ghost btn-sm" onclick="deleteSpk('${spk.spkId}')">Hapus</button>` : `<span style="font-size: 13px; color: var(--text-muted);">-</span>`}
          </td>
        </tr>
      `).join('');
  } catch (err) {
    console.error(err);
    showMessage(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger-color)">Gagal memuat SPK</td></tr>';
  }
}

async function deleteSpk(spkId) {
  if (!confirm('Yakin ingin menghapus SPK Corrective ini? Notifikasi terkait akan kembali ke status Approved.')) return;
  try {
    await apiDelete('/corrective/spk/' + spkId);
    showMessage('SPK berhasil dihapus');
    refreshData();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// SPK GENERATION PANEL LOGIC
// ─────────────────────────────────────────────────────────────────────────────
function openSpkPanel(notificationId) {
  const req = allRequests.find(r => r.id === notificationId);
  if(!req) return;

  document.getElementById('spkForm').reset();
  document.getElementById('spkItemsBody').innerHTML = '';

  document.getElementById('f_notificationId').value = req.id;
  document.getElementById('f_equipmentId').value = req.equipment || '';
  document.getElementById('f_location').value = req.functionalLocation || '';
  document.getElementById('f_jobDescription').value = req.description + '\\n' + (req.longText || '');
  
  if (req.workCenter) {
    document.getElementById('f_workCenter').value = req.workCenter;
  }

  // Pre-fill finish date based on required end
  if (req.requiredEnd) {
     const reqEndStr = req.requiredEnd.substring(0, 10);
     document.getElementById('f_requestedFinishDate').value = reqEndStr;
  } else {
     // auto fill to today
     const date = new Date();
     date.setDate(date.getDate() + 1); // target finish standard +1 day
     document.getElementById('f_requestedFinishDate').value = date.toISOString().split('T')[0];
  }

  openPanel();
}

function addSpkItem() {
  const tbody = document.getElementById('spkItemsBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="item-type">
        <option value="material">Material</option>
        <option value="service">Service</option>
        <option value="tool">Tool</option>
      </select>
    </td>
    <td><input type="text" class="item-name" placeholder="Nama item..." required /></td>
    <td><input type="number" class="item-qty" value="1" min="1" required /></td>
    <td><input type="text" class="item-uom" value="pcs" required /></td>
    <td><button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('tr').remove()" style="color:var(--danger-color)">✕</button></td>
  `;
  tbody.appendChild(tr);
}

async function saveSpk() {
  const spkForm = document.getElementById('spkForm');
  if(!spkForm.reportValidity()) return;

  const btn = document.getElementById('panelSave');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  // Extract items
  const items = [];
  document.querySelectorAll('#spkItemsBody tr').forEach(tr => {
    items.push({
      itemType: tr.querySelector('.item-type').value,
      itemName: tr.querySelector('.item-name').value,
      quantity: parseInt(tr.querySelector('.item-qty').value),
      uom: tr.querySelector('.item-uom').value
    });
  });

  const payload = {
    notificationId: document.getElementById('f_notificationId').value,
    spkNumber: document.getElementById('f_spkNumber').value.trim() || undefined,
    orderNumber: document.getElementById('f_orderNumber').value.trim(),
    priority: document.getElementById('f_priority').value,
    equipmentId: document.getElementById('f_equipmentId').value,
    location: document.getElementById('f_location').value,
    requestedFinishDate: document.getElementById('f_requestedFinishDate').value,
    damageClassification: document.getElementById('f_damageClassification').value.trim(),
    jobDescription: document.getElementById('f_jobDescription').value.trim(),
    workCenter: document.getElementById('f_workCenter').value,
    ctrlKey: document.getElementById('f_ctrlKey').value.trim(),
    unit: document.getElementById('f_unit').value.trim(),
    plannedWorker: parseInt(document.getElementById('f_plannedWorker').value),
    plannedHourPerWorker: parseFloat(document.getElementById('f_plannedHourPerWorker').value),
    items: items
  };

  try {
    await apiPost('/corrective/spk', payload);
    showMessage('SPK Corrective berhasil dibuat!');
    closePanel();
    refreshData();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan SPK';
  }
}
