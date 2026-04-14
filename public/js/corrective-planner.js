/**
 * corrective-planner.js 
 * Core logic for Planer Corrective Maintenance Dashboard.
 */

let allRequests = [];
let allSpks = [];
let allHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role !== 'planner' && !(user.group && user.group.toLowerCase().includes('perencanaan'))) {
    // Some flexibility for admin
    if (user.role !== 'admin') {
      window.location.href = '/login.html';
      return;
    }
  }

  // Set Profile
  document.getElementById('userName').textContent = user.name || 'User';
  document.getElementById('userRole').textContent = (user.role || 'User').toUpperCase();

  // Initial load
  refreshData();

  // Polling (every 30s)
  setInterval(refreshData, 30000);
});

async function refreshData() {
  await Promise.all([
    loadRequests(),
    loadSpk(),
    loadHistory()
  ]);
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1: NOTIFIKASI / REQUESTS
// ═══════════════════════════════════════════════════════════════════

async function loadRequests() {
  const tbody = document.getElementById('notifBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><div class="spinner"></div></td></tr>';

  try {
    const params = new URLSearchParams();
    const status = document.getElementById('filterNotifStatus').value;
    if (status) params.set('status', status);

    const qs = params.toString() ? `?${params}` : '';
    allRequests = await apiGet('/corrective/requests' + qs);

    // Client-side approval-status filter
    const approvalFilter = document.getElementById('filterApprovalStatus').value;
    let filtered = allRequests;
    if (approvalFilter) {
      filtered = allRequests.filter(r => r.approvalStatus === approvalFilter);
    }

    document.getElementById('countNotif').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <p>Tidak ada laporan notifikasi ditemukan</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(req => {
      let actions = `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showNotifDetail('${req.id}')">Detail</button>`;

      if (req.status === 'submitted' && req.approvalStatus === 'pending') {
        actions += ` <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); approvePlanner('${req.id}')">Terima</button>`;
      } else if (req.status === 'approved' && !req.spkId) {
        actions += ` <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openSpkPanel('${req.id}')">Generate SPK</button>`;
      }

      return `
        <tr onclick="showNotifDetail('${req.id}')">
          <td><strong>${escHtml(req.id)}</strong></td>
          <td>
            <div>${fmtDateShort(req.notificationDate || req.submittedAt)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${escHtml(req.reportedBy || '')}</div>
          </td>
          <td>
            <div>${escHtml(req.equipment || '')}</div>
            <div style="font-size:12px;color:var(--text-muted)">${escHtml(req.functionalLocation || '')}</div>
          </td>
          <td>${escHtml(req.notificationType || '')}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(req.description || '')}</td>
          <td>${statusBadge(req.status)}</td>
          <td>${approvalTag(req.approvalStatus)}</td>
          <td onclick="event.stopPropagation()">${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    showMessage(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger-color)">Gagal memuat notifikasi</td></tr>';
  }
}

// ── Notification Detail Panel ────────────────────────────────
function showNotifDetail(notifId) {
  const req = allRequests.find(r => r.id === notifId);
  if (!req) return;

  const content = document.getElementById('notifDetailContent');
  
  // Photos handling
  const photos = (req.images || []).filter(Boolean);
  const photosHtml = photos.length > 0
    ? `<div class="notif-photos">${photos.map(p => {
        const fullPath = p.startsWith('/') ? p : '/' + p;
        return `<img src="${fullPath}" alt="Photo" onclick="window.open('${fullPath}','_blank')" onerror="this.src='/img/placeholder.png';this.onclick=null;" />`;
      }).join('')}</div>`
    : '<span style="color:var(--text-muted)">Tidak ada foto lapangan</span>';

  // Format dates
  const notifDate = req.notificationDate ? new Date(req.notificationDate).toLocaleDateString('id-ID') : (req.submittedAt ? new Date(req.submittedAt).toLocaleDateString('id-ID') : '-');
  const reqStart = req.requiredStart ? new Date(req.requiredStart).toLocaleDateString('id-ID') : '-';
  const reqEnd = req.requiredEnd ? new Date(req.requiredEnd).toLocaleDateString('id-ID') : '-';

  content.innerHTML = `
    <div class="detail-section">
      <div class="detail-row">
        <span class="detail-label">Notification ID</span>
        <span class="detail-value"><strong>${req.id}</strong></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">${statusBadge(req.status)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Approval Status</span>
        <span class="detail-value">${approvalTag(req.approvalStatus)}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Informasi Peralatan</h4>
      <div class="detail-row">
        <span class="detail-label">Functional Location</span>
        <span class="detail-value">${req.functionalLocation || '-'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Equipment</span>
        <span class="detail-value">${req.equipment || '-'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Work Center</span>
        <span class="detail-value">${req.workCenter || '-'}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Deskripsi Kerusakan</h4>
      <div style="padding: 12px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid var(--sap-blue); margin-top: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">${escHtml(req.description || 'Tanpa judul')}</div>
        <div style="font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${escHtml(req.longText || '-')}</div>
      </div>
      <div style="margin-top: 12px; display:flex; gap: 20px;">
        <div><span class="detail-label">Target Mulai:</span> <strong>${reqStart}</strong></div>
        <div><span class="detail-label">Target Selesai:</span> <strong>${reqEnd}</strong></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Foto Lapangan</h4>
      ${photosHtml}
    </div>

    <div class="detail-section">
      <h4>Metadata</h4>
      <div class="detail-row"><span class="detail-label">Pelapor</span><span class="detail-value">${escHtml(req.reportedBy || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Waktu Lapor</span><span class="detail-value">${notifDate}</span></div>
    </div>
  `;

  // Build footer actions
  const footer = document.getElementById('notifDetailFooter');
  let footerActions = '<button class="btn btn-ghost" onclick="closeNotifDetailPanel()">Tutup</button>';

  if (req.status === 'submitted' && req.approvalStatus === 'pending') {
    footerActions += ` <button class="btn btn-primary" onclick="approvePlanner('${req.id}')">Terima Laporan</button>`;
  } else if (req.status === 'approved' && !req.spkId) {
    footerActions += ` <button class="btn btn-primary" onclick="openSpkPanel('${req.id}')">Generate SPK</button>`;
  } else if (req.approvalStatus === 'menunggu_review_awal_kadis_pp') {
    footerActions += ` 
      <button class="btn btn-primary" onclick="approveKadisPP('${req.id}')">Approve Kadis PP</button>
      <button class="btn btn-ghost" style="color:var(--danger-color)" onclick="rejectKadisPP('${req.id}')">Tolak</button>
    `;
  }

  footer.innerHTML = footerActions;
  document.getElementById('notifDetailPanel').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function closeNotifDetailPanel() {
  document.getElementById('notifDetailPanel').classList.remove('show');
  if (!document.getElementById('detailPanel').classList.contains('show') &&
      !document.getElementById('panel').classList.contains('show')) {
    document.getElementById('overlay').classList.remove('show');
  }
}

// ── Planner Approves Notification ────────────────────────────
async function approvePlanner(notifId) {
  showConfirmDialog(
    'Terima Laporan',
    'Apakah Anda yakin ingin menerima dan menyetujui laporan ini? Status akan berubah menjadi "Approved" dan siap dibuatkan SPK.',
    async () => {
      try {
        await apiPost(`/corrective/requests/${notifId}/approve-planner`);
        showMessage('Laporan berhasil diterima!');
        closeNotifDetailPanel();
        refreshData();
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }
  );
}

// ── Kadis PP Approve / Reject (Awal) ─────────────────────────
async function approveKadisPP(notifId) {
  showConfirmDialog(
    'Approve Review Awal Kadis PP',
    'SPK akan disetujui dan statusnya berubah menjadi "SPK Issued" (siap dikerjakan Teknisi). Lanjutkan?',
    async () => {
      try {
        await apiPost(`/corrective/requests/${notifId}/approve`);
        showMessage('SPK berhasil disetujui oleh Kadis PP!');
        closeNotifDetailPanel();
        refreshData();
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }
  );
}

async function rejectKadisPP(notifId) {
  showConfirmDialogWithNotes(
    'Tolak Review Awal Kadis PP',
    'SPK akan ditolak. Mohon berikan catatan alasan penolakan:',
    async (notes) => {
      try {
        await apiPost(`/corrective/requests/${notifId}/reject`, { notes });
        showMessage('SPK ditolak oleh Kadis PP.');
        closeNotifDetailPanel();
        refreshData();
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2: SPK CORRECTIVE (Active)
// ═══════════════════════════════════════════════════════════════════

async function loadSpk() {
  const tbody = document.getElementById('spkBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="spinner"></div></td></tr>';

  try {
    const params = new URLSearchParams();
    const status = document.getElementById('filterSpkStatus').value;
    const priority = document.getElementById('filterSpkPriority').value;
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);

    const qs = params.toString() ? `?${params}` : '';
    allSpks = await apiGet('/corrective/spk' + qs);

    const active = allSpks.filter(s => s.status !== 'completed' && s.status !== 'rejected');
    document.getElementById('countSpk').textContent = active.length;

    if (active.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Belum ada SPK aktif</div></td></tr>';
      return;
    }

    tbody.innerHTML = active.map(spk => {
      let actions = `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showSpkDetail('${spk.spkId}')">Detail</button>`;
      
      if (spk.status === 'draft') {
        actions += ` <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openSpkEditPanel('${spk.spkId}')">Edit</button>`;
      }
      if (spk.status === 'awaiting_kadis_pusat') {
        actions += ` <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); approveSpkKadisPusat('${spk.spkId}')">Approve</button>`;
      }

      return `
        <tr onclick="showSpkDetail('${spk.spkId}')">
          <td><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></td>
          <td>${escHtml(spk.orderNumber || '-')}</td>
          <td>${fmtDateShort(spk.createdDate)}</td>
          <td>${escHtml(spk.equipmentId || '-')}</td>
          <td>${priorityBadge(spk.priority)}</td>
          <td>${spkStatusBadge(spk.status)}</td>
          <td onclick="event.stopPropagation()">${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    showMessage(err.message, 'error');
  }
}

function showSpkDetail(spkId) {
  const spk = allSpks.find(s => s.spkId === spkId) || allHistory.find(s => s.spkId === spkId);
  if (!spk) return;

  const steps = [
    { label: 'Draft', key: 'draft' },
    { label: 'Eksekusi', key: 'eksekusi' },
    { label: 'Review Kadis PP', key: 'awaiting_kadis_pusat' },
    { label: 'Review Pelapor', key: 'awaiting_kadis_pelapor' },
    { label: 'Selesai', key: 'completed' }
  ];
  const currentIdx = steps.findIndex(s => s.key === spk.status);
  const flowHtml = steps.map((s, i) => {
    let cls = i < currentIdx ? 'done' : (i === currentIdx ? 'active' : '');
    return `<span class="step ${cls}">${s.label}</span>` + (i < steps.length-1 ? '<span class="arrow">→</span>' : '');
  }).join('');

  const beforePhotos = (spk.photos || []).filter(p => p.photoType === 'before');
  const afterPhotos = (spk.photos || []).filter(p => p.photoType === 'after');
  const photosHtml = `
    <div class="detail-section">
      <h4>Foto Dokumentasi</h4>
      <div style="display:flex; gap:16px; overflow-x:auto">
        ${beforePhotos.map(p => `<img src="/${p.photoPath}" class="detail-img" title="Before" onclick="window.open('/${p.photoPath}')" />`).join('')}
        ${afterPhotos.map(p => `<img src="/${p.photoPath}" class="detail-img" title="After" onclick="window.open('/${p.photoPath}')" />`).join('')}
        ${(beforePhotos.length + afterPhotos.length === 0) ? '<span class="text-muted">Tidak ada foto</span>' : ''}
      </div>
    </div>
  `;

  document.getElementById('detailContent').innerHTML = `
    <div class="status-flow" style="margin-bottom:20px">${flowHtml}</div>
    <div class="detail-section">
      <h4>Informasi Utama</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">SPK Number</span><span class="value">${escHtml(spk.spkNumber || spk.spkId)}</span></div>
        <div class="detail-item"><span class="label">Work Center</span><span class="value">${escHtml(spk.workCenter || '-')}</span></div>
        <div class="detail-item"><span class="label">Status</span><span class="value">${spkStatusBadge(spk.status)}</span></div>
      </div>
    </div>
    <div class="detail-section">
      <h4>Perencanaan Sumber Daya</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Pekerja</span><span class="value">${spk.plannedWorker || 0} orang</span></div>
        <div class="detail-item"><span class="label">Estimasi Jam</span><span class="value">${spk.totalPlannedHour || 0} jam</span></div>
      </div>
    </div>
    <div class="detail-section">
      <h4>Deskripsi Pekerjaan</h4>
      <div style="white-space:pre-wrap; font-size:13px">${escHtml(spk.jobDescription || '-')}</div>
    </div>
    ${photosHtml}
  `;

  const footer = document.getElementById('spkDetailFooter');
  let footerHtml = '<button class="btn btn-ghost" onclick="closeDetailPanel()">Tutup</button>';

  if (spk.status === 'awaiting_kadis_pusat') {
    footerHtml += ` <button class="btn btn-primary" onclick="approveSpkKadisPusat('${spk.spkId}')">Setujui (Kadis PP)</button>`;
    footerHtml += ` <button class="btn btn-ghost" style="color:red" onclick="rejectSpk('${spk.spkId}')">Tolak</button>`;
  } else if (spk.status === 'awaiting_kadis_pelapor') {
    footerHtml += ` <button class="btn btn-primary" onclick="approveSpkKadisPelapor('${spk.spkId}')">Setujui (Pelapor)</button>`;
    footerHtml += ` <button class="btn btn-ghost" style="color:red" onclick="rejectSpk('${spk.spkId}')">Tolak</button>`;
  }

  footer.innerHTML = footerHtml;
  document.getElementById('detailPanel').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function closeDetailPanel() {
  document.getElementById('detailPanel').classList.remove('show');
  if (!document.getElementById('notifDetailPanel').classList.contains('show') &&
      !document.getElementById('panel').classList.contains('show')) {
    document.getElementById('overlay').classList.remove('show');
  }
}

// Action functions for SPK
async function approveSpkKadisPusat(spkId) {
  showConfirmDialog('Approve Kadis PP', 'Lanjutkan penyetujuan SPK?', async () => {
    try {
      await apiPost(`/corrective/spk/${spkId}/approve-kadis-pusat`);
      showMessage('SPK Disetujui');
      closeDetailPanel();
      refreshData();
    } catch (err) { showMessage(err.message, 'error'); }
  });
}

async function approveSpkKadisPelapor(spkId) {
  showConfirmDialog('Approve Final', 'Selesaikan dan tutup SPK?', async () => {
    try {
      await apiPost(`/corrective/spk/${spkId}/approve-kadis-pelapor`);
      showMessage('SPK Selesai');
      closeDetailPanel();
      refreshData();
    } catch (err) { showMessage(err.message, 'error'); }
  });
}

async function rejectSpk(spkId) {
  showConfirmDialogWithNotes('Tolak SPK', 'Alasan penolakan:', async (notes) => {
    try {
      await apiPost(`/corrective/spk/${spkId}/reject`, { notes });
      showMessage('SPK Ditolak');
      closeDetailPanel();
      refreshData();
    } catch (err) { showMessage(err.message, 'error'); }
  });
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3: HISTORY
// ═══════════════════════════════════════════════════════════════════

async function loadHistory() {
  const tbody = document.getElementById('historyBody');
  try {
    allHistory = await apiGet('/corrective/spk/history');
    tbody.innerHTML = allHistory.map(spk => `
      <tr onclick="showSpkDetail('${spk.spkId}')">
        <td><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></td>
        <td>${fmtDateShort(spk.createdDate)}</td>
        <td>${escHtml(spk.equipmentId || '-')}</td>
        <td>${spkStatusBadge(spk.status)}</td>
        <td onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" onclick="showSpkDetail('${spk.spkId}')">Detail</button></td>
      </tr>
    `).join('');
    document.getElementById('countHistory').textContent = allHistory.length;
  } catch (err) { console.error(err); }
}

// ═══════════════════════════════════════════════════════════════════
// SPK CREATE / EDIT PANEL
// ═══════════════════════════════════════════════════════════════════

function openSpkPanel(notificationId) {
  const req = allRequests.find(r => r.id === notificationId);
  if (!req) return;

  document.getElementById('spkForm').reset();
  document.getElementById('spkItemsBody').innerHTML = '';
  document.getElementById('f_spkId').value = '';
  document.getElementById('panelTitle').textContent = 'Generate SPK CC';
  document.getElementById('f_notificationId').value = req.id;
  document.getElementById('f_equipmentId').value = req.equipment || '';
  document.getElementById('f_location').value = req.functionalLocation || '';
  document.getElementById('f_jobDescription').value = (req.description || '') + '\n' + (req.longText || '');
  document.getElementById('f_workCenter').value = req.workCenter || 'mechanical';
  
  openPanel();
}

async function saveSpk() {
  const form = document.getElementById('spkForm');
  if (!form.reportValidity()) return;

  const btn = document.getElementById('panelSave');
  btn.disabled = true;

  const payload = {
    notificationId: document.getElementById('f_notificationId').value,
    orderNumber: document.getElementById('f_orderNumber').value,
    priority: document.getElementById('f_priority').value,
    equipmentId: document.getElementById('f_equipmentId').value,
    location: document.getElementById('f_location').value,
    requestedFinishDate: document.getElementById('f_requestedFinishDate').value,
    jobDescription: document.getElementById('f_jobDescription').value,
    workCenter: document.getElementById('f_workCenter').value,
    plannedWorker: parseInt(document.getElementById('f_plannedWorker').value || 1),
    plannedHourPerWorker: parseFloat(document.getElementById('f_plannedHourPerWorker').value || 1),
    items: [] // In this simplified version, items handle specifically if needed
  };

  try {
    await apiPost('/corrective/spk', payload);
    showMessage('SPK Created');
    closePanel();
    refreshData();
  } catch (err) { showMessage(err.message, 'error'); }
  finally { btn.disabled = false; }
}

// UI HELPERS (local to this page)
function approvalTag(status) {
  const map = { pending: 'PROSES', approved: 'DISETUJUI', rejected: 'DITOLAK', 
                menunggu_review_awal_kadis_pp: 'REVIEW PP', spk_issued: 'SPK ISSUED',
                eksekusi: 'EKSEKUSI', menunggu_review_kadis_pp: 'PROSES TTP',
                menunggu_review_kadis_pelapor: 'PROSES TTP' };
  return `<span class="badge badge-pending">${map[status] || status}</span>`;
}

function spkStatusBadge(s) {
  return `<span class="badge">${s}</span>`;
}

function fmtDateShort(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID');
}

function priorityBadge(p) {
  return `<span class="badge">${p}</span>`;
}

// Confirm dialogs
let _confirmCallback = null;
function showConfirmDialog(title, msg, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmExtra').innerHTML = '';
  _confirmCallback = onConfirm;
  document.getElementById('confirmOk').onclick = async () => {
    closeConfirmDialog();
    if (_confirmCallback) await _confirmCallback();
  };
  document.getElementById('confirmDialog').classList.add('show');
}

function showConfirmDialogWithNotes(title, msg, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmExtra').innerHTML = '<textarea id="diagNotes" class="form-control" style="margin-top:10px"></textarea>';
  _confirmCallback = onConfirm;
  document.getElementById('confirmOk').onclick = async () => {
    const notes = document.getElementById('diagNotes').value;
    closeConfirmDialog();
    if (_confirmCallback) await _confirmCallback(notes);
  };
  document.getElementById('confirmDialog').classList.add('show');
}

function closeConfirmDialog() {
  document.getElementById('confirmDialog').classList.remove('show');
  _confirmCallback = null;
}
