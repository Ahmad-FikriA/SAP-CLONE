/**
 * corrective-planner.js
 * Core logic for Planer Corrective Maintenance Dashboard.
 * Handles: Notifications, SPK Create/Edit, Approval flows, History.
 */

let allRequests = [];
let allSpks = [];
let allHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role !== 'planner' && !(user.group && user.group.toLowerCase().includes('perencanaan'))) {
    // Some flexibility for admin and kadis
    if (user.role !== 'admin' && user.role !== 'kadis') {
      window.location.href = '/pages/login.html';
      return;
    }
  }

  // Set Profile
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  if (userNameEl) userNameEl.textContent = user.name || 'User';
  if (userRoleEl) userRoleEl.textContent = (user.role || 'User').toUpperCase();

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
// UTILITY: BADGES & FORMATTING
// ═══════════════════════════════════════════════════════════════════

function approvalTag(status) {
  const config = {
    pending:                        { label: 'Pending',              cls: 'pending' },
    menunggu_review_awal_kadis_pp:  { label: 'Review Kadis PP',     cls: 'waiting' },
    ditolak_kadis_pp_awal:          { label: 'Ditolak Kadis PP',    cls: 'rejected' },
    approved:                       { label: 'Disetujui',           cls: 'approved' },
    rejected:                       { label: 'Ditolak',             cls: 'rejected' },
    spk_masuk:                      { label: 'SPK Masuk',           cls: 'waiting' },
    spk_issued:                     { label: 'SPK Issued',          cls: 'issued' },
    eksekusi:                       { label: 'Eksekusi',            cls: 'eksekusi' },
    menunggu_review_kadis_pp:       { label: 'Review Kadis PP',     cls: 'waiting' },
    menunggu_review_kadis_pelapor:  { label: 'Review Pelapor',      cls: 'waiting' },
  };
  const c = config[status] || { label: status || '-', cls: 'pending' };
  return `<span class="approval-tag ${c.cls}">${c.label}</span>`;
}

function spkStatusBadge(s) {
  const config = {
    draft:                   { label: 'Draft',              color: '#6C757D', bg: '#E9ECEF' },
    in_progress:             { label: 'Eksekusi',           color: '#7b1fa2', bg: '#f3e5f5' },
    awaiting_kadis_pusat:    { label: 'Review Kadis PP',    color: '#1565c0', bg: '#e3f2fd' },
    awaiting_kadis_pelapor:  { label: 'Review Pelapor',     color: '#e65100', bg: '#fff3e0' },
    completed:               { label: 'Selesai',            color: '#2e7d32', bg: '#e8f5e9' },
    rejected:                { label: 'Ditolak',            color: '#c62828', bg: '#fde8e8' },
  };
  const c = config[s] || { label: s || '-', color: '#6C757D', bg: '#E9ECEF' };
  return `<span class="badge" style="background:${c.bg};color:${c.color}">${c.label}</span>`;
}

function priorityBadge(p) {
  const config = {
    critical: { cls: 'critical' },
    high:     { cls: 'high' },
    medium:   { cls: 'medium' },
    low:      { cls: 'low' },
    urgent:   { cls: 'critical' },
  };
  const c = config[p] || { cls: 'medium' };
  return `<span class="priority-badge ${c.cls}">${(p || 'medium').toUpperCase()}</span>`;
}

function fmtDateShort(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return iso;
  }
}

function fmtDateTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return iso;
  }
}

function wcLabel(wc) {
  const map = { mechanical: 'MEKANIK', electrical: 'LISTRIK', civil: 'SIPIL', automation: 'INSTRUMEN / OTOMASI' };
  return map[wc] || (wc || '-').toUpperCase();
}


// ═══════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  // Find nav tab
  const navMap = { 'tab-requests': 'nav-requests', 'tab-spk': 'nav-spk', 'tab-history': 'nav-history' };
  const navId = navMap[tabId];
  if (navId) document.getElementById(navId).classList.add('active');
}


// ═══════════════════════════════════════════════════════════════════
// TAB 1: NOTIFIKASI / REQUESTS
// ═══════════════════════════════════════════════════════════════════

async function loadRequests() {
  const tbody = document.getElementById('reqBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><div class="spinner"></div></td></tr>';

  try {
    const params = new URLSearchParams();
    const filterStatusEl = document.getElementById('filterReqStatus');
    const status = filterStatusEl ? filterStatusEl.value : '';
    if (status) params.set('status', status);

    const qs = params.toString() ? `?${params}` : '';
    allRequests = await apiGet('/corrective/requests' + qs);

    // Client-side approval-status filter
    const approvalFilterEl = document.getElementById('filterApprovalStatus');
    const approvalFilter = approvalFilterEl ? approvalFilterEl.value : '';
    let filtered = allRequests;
    if (approvalFilter) {
      filtered = allRequests.filter(r => r.approvalStatus === approvalFilter);
    }

    const countEl = document.getElementById('countRequests');
    if (countEl) countEl.textContent = filtered.length;

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
          <td>${escHtml(req.notificationType || '-')}</td>
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
        return `<img src="${fullPath}" alt="Photo" onclick="window.open('${fullPath}','_blank')" onerror="this.style.display='none'" />`;
      }).join('')}</div>`
    : '<span style="color:var(--text-muted);font-size:13px">Tidak ada foto lapangan</span>';

  // SPK info section (if SPK already exists)
  let spkInfoHtml = '';
  if (req.spkId) {
    spkInfoHtml = `
      <div class="detail-section">
        <h4>📋 SPK Terkait</h4>
        <div class="detail-grid">
          <div class="detail-item"><span class="label">SPK Number</span><span class="value"><strong>${escHtml(req.spkNumber || req.spkId)}</strong></span></div>
          <div class="detail-item"><span class="label">Priority</span><span class="value">${priorityBadge(req.priority)}</span></div>
          <div class="detail-item"><span class="label">Target Selesai</span><span class="value">${fmtDateShort(req.targetDate)}</span></div>
          <div class="detail-item"><span class="label">Klasifikasi</span><span class="value">${escHtml(req.classification || '-')}</span></div>
          <div class="detail-item"><span class="label">Pekerja</span><span class="value">${req.personnelCount || '-'} orang</span></div>
          <div class="detail-item"><span class="label">Estimasi Jam</span><span class="value">${req.estimatedDuration || '-'} jam</span></div>
          <div class="detail-item full"><span class="label">Instruksi Kerja</span><span class="value" style="white-space:pre-wrap">${escHtml(req.instructions || '-')}</span></div>
        </div>
      </div>
    `;
  }

  // Execution results section
  let execHtml = '';
  if (req.executionResultText || (req.beforeImages && req.beforeImages.length > 0)) {
    execHtml = `
      <div class="detail-section">
        <h4>⚙️ Hasil Eksekusi</h4>
        <div class="detail-grid">
          <div class="detail-item"><span class="label">Pekerja Aktual</span><span class="value">${req.actualPersonnelCount || '-'} orang</span></div>
          <div class="detail-item"><span class="label">Durasi Aktual</span><span class="value">${req.actualDuration || '-'} jam</span></div>
          <div class="detail-item full"><span class="label">Hasil Kerja</span><span class="value" style="white-space:pre-wrap">${escHtml(req.executionResultText || '-')}</span></div>
        </div>
        ${(req.beforeImages || []).length > 0 ? `
          <div style="margin-top:12px">
            <span class="label" style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Foto Sebelum</span>
            <div class="notif-photos" style="margin-top:6px">${req.beforeImages.map(p => {
              const fp = p.startsWith('/') ? p : '/' + p;
              return `<img src="${fp}" alt="Before" onclick="window.open('${fp}','_blank')" onerror="this.style.display='none'" />`;
            }).join('')}</div>
          </div>
        ` : ''}
        ${(req.afterImages || []).length > 0 ? `
          <div style="margin-top:12px">
            <span class="label" style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Foto Sesudah</span>
            <div class="notif-photos" style="margin-top:6px">${req.afterImages.map(p => {
              const fp = p.startsWith('/') ? p : '/' + p;
              return `<img src="${fp}" alt="After" onclick="window.open('${fp}','_blank')" onerror="this.style.display='none'" />`;
            }).join('')}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  content.innerHTML = `
    <div class="detail-section">
      <div class="detail-grid" style="margin-bottom:16px">
        <div class="detail-item"><span class="label">Notification ID</span><span class="value"><strong>${escHtml(req.id)}</strong></span></div>
        <div class="detail-item"><span class="label">Tanggal</span><span class="value">${fmtDateShort(req.notificationDate || req.submittedAt)}</span></div>
        <div class="detail-item"><span class="label">Status</span><span class="value">${statusBadge(req.status)}</span></div>
        <div class="detail-item"><span class="label">Approval</span><span class="value">${approvalTag(req.approvalStatus)}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>🔧 Informasi Peralatan</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Equipment</span><span class="value">${escHtml(req.equipment || '-')}</span></div>
        <div class="detail-item"><span class="label">Functional Location</span><span class="value">${escHtml(req.functionalLocation || '-')}</span></div>
        <div class="detail-item"><span class="label">Work Center</span><span class="value">${wcLabel(req.workCenter)}</span></div>
        <div class="detail-item"><span class="label">Tipe Notifikasi</span><span class="value">${escHtml(req.notificationType || '-')}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>📝 Deskripsi Kerusakan</h4>
      <div style="padding:12px 16px;background:#f8f9fa;border-radius:6px;border-left:4px solid var(--primary);margin-top:8px">
        <div style="font-weight:700;margin-bottom:6px;font-size:14px">${escHtml(req.description || 'Tanpa judul')}</div>
        <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;color:var(--text-muted)">${escHtml(req.longText || '-')}</div>
      </div>
      <div style="margin-top:12px;display:flex;gap:24px">
        <div><span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Target Mulai</span><br/><strong>${fmtDateShort(req.requiredStart)}</strong></div>
        <div><span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Target Selesai</span><br/><strong>${fmtDateShort(req.requiredEnd)}</strong></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>📷 Foto Lapangan</h4>
      ${photosHtml}
    </div>

    ${spkInfoHtml}
    ${execHtml}

    <div class="detail-section">
      <h4>ℹ️ Metadata</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Pelapor</span><span class="value">${escHtml(req.reportedBy || '-')}</span></div>
        <div class="detail-item"><span class="label">Submitted By</span><span class="value">${escHtml(req.submittedBy || '-')}</span></div>
        <div class="detail-item"><span class="label">Waktu Lapor</span><span class="value">${fmtDateTime(req.submittedAt)}</span></div>
      </div>
    </div>
  `;

  // Build footer actions
  const footer = document.getElementById('notifDetailFooter');
  let footerActions = '<button class="btn btn-ghost" onclick="closeNotifDetailPanel()">Tutup</button>';

  if (req.status === 'submitted' && req.approvalStatus === 'pending') {
    footerActions += ` <button class="btn btn-primary" onclick="approvePlanner('${req.id}')">✓ Terima Laporan</button>`;
  } else if (req.status === 'approved' && !req.spkId) {
    footerActions += ` <button class="btn btn-primary" onclick="closeNotifDetailPanel(); openSpkPanel('${req.id}')">📋 Generate SPK</button>`;
  } else if (req.approvalStatus === 'menunggu_review_awal_kadis_pp') {
    footerActions += `
      <button class="btn btn-primary" onclick="approveKadisPP('${req.id}')">✓ Approve</button>
      <button class="btn btn-danger" onclick="rejectKadisPP('${req.id}')">✕ Tolak</button>
    `;
  }

  if (req.spkId) {
    footerActions += ` <button class="btn btn-ghost" onclick="closeNotifDetailPanel(); showSpkDetail('${req.spkId}')">Lihat SPK →</button>`;
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
  if (!tbody) return;
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="spinner"></div></td></tr>';

  try {
    const params = new URLSearchParams();
    const statusEl = document.getElementById('filterSpkStatus');
    const priorityEl = document.getElementById('filterSpkPriority');
    const status = statusEl ? statusEl.value : '';
    const priority = priorityEl ? priorityEl.value : '';
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);

    const qs = params.toString() ? `?${params}` : '';
    allSpks = await apiGet('/corrective/spk' + qs);

    const active = allSpks.filter(s => s.status !== 'completed' && s.status !== 'rejected');
    document.getElementById('countSpk').textContent = active.length;

    if (active.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
        <p>Belum ada SPK Corrective aktif</p>
      </div></td></tr>`;
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
      if (spk.status === 'awaiting_kadis_pelapor') {
        actions += ` <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); approveSpkKadisPelapor('${spk.spkId}')">Final</button>`;
      }

      return `
        <tr onclick="showSpkDetail('${spk.spkId}')">
          <td><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></td>
          <td>${escHtml(spk.orderNumber || '-')}</td>
          <td>${fmtDateShort(spk.createdDate)}</td>
          <td>
            <div>${escHtml(spk.equipmentId || '-')}</div>
            <div style="font-size:11px;color:var(--text-muted)">${wcLabel(spk.workCenter)}</div>
          </td>
          <td>${priorityBadge(spk.priority)}</td>
          <td>${spkStatusBadge(spk.status)}</td>
          <td onclick="event.stopPropagation()">${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    showMessage(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#BB0000">Gagal memuat SPK</td></tr>';
  }
}


// ── SPK Detail Panel ─────────────────────────────────────────
function showSpkDetail(spkId) {
  const spk = allSpks.find(s => s.spkId === spkId) || allHistory.find(s => s.spkId === spkId);
  if (!spk) {
    showMessage('SPK tidak ditemukan', 'error');
    return;
  }

  // Status flow
  const steps = [
    { label: 'Draft', key: 'draft' },
    { label: 'Eksekusi', key: 'in_progress' },
    { label: 'Review Kadis PP', key: 'awaiting_kadis_pusat' },
    { label: 'Review Pelapor', key: 'awaiting_kadis_pelapor' },
    { label: 'Selesai', key: 'completed' }
  ];
  const currentIdx = steps.findIndex(s => s.key === spk.status);
  const isRejected = spk.status === 'rejected';

  const flowHtml = steps.map((s, i) => {
    let cls = '';
    if (isRejected) {
      cls = i <= 0 ? 'done' : '';
      if (i === steps.length - 1) cls = '';
    } else {
      cls = i < currentIdx ? 'done' : (i === currentIdx ? 'active' : '');
    }
    return `<span class="step ${cls}">${s.label}</span>` + (i < steps.length - 1 ? '<span class="arrow">→</span>' : '');
  }).join('');

  // Rejected badge if applicable
  const rejectedHtml = isRejected ? `
    <div style="margin:16px 0;padding:12px 16px;background:#fde8e8;border-radius:8px;border-left:4px solid #c62828">
      <div style="font-weight:700;color:#c62828;margin-bottom:4px">❌ SPK DITOLAK</div>
      <div style="font-size:13px;color:#c62828">${escHtml(spk.rejectionNotes || 'Tidak ada catatan')}</div>
      ${spk.rejectedAt ? `<div style="font-size:11px;color:#999;margin-top:4px">Pada ${fmtDateTime(spk.rejectedAt)}</div>` : ''}
    </div>
  ` : '';

  // Photos
  const beforePhotos = (spk.photos || []).filter(p => p.photoType === 'before');
  const afterPhotos = (spk.photos || []).filter(p => p.photoType === 'after');

  const photosHtml = (beforePhotos.length + afterPhotos.length) > 0 ? `
    <div class="detail-section">
      <h4>📷 Foto Dokumentasi</h4>
      ${beforePhotos.length > 0 ? `
        <div style="margin-bottom:12px">
          <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Foto Sebelum</span>
          <div class="notif-photos" style="margin-top:6px">${beforePhotos.map(p => `<img src="/${p.photoPath}" title="Before" onclick="window.open('/${p.photoPath}')" onerror="this.style.display='none'" />`).join('')}</div>
        </div>
      ` : ''}
      ${afterPhotos.length > 0 ? `
        <div>
          <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Foto Sesudah</span>
          <div class="notif-photos" style="margin-top:6px">${afterPhotos.map(p => `<img src="/${p.photoPath}" title="After" onclick="window.open('/${p.photoPath}')" onerror="this.style.display='none'" />`).join('')}</div>
        </div>
      ` : ''}
    </div>
  ` : '';

  // Items table
  const items = spk.items || [];
  const itemsHtml = items.length > 0 ? `
    <div class="detail-section">
      <h4>📦 Items (Material / Tools / Services)</h4>
      <table class="items-table">
        <thead><tr><th>Type</th><th>Nama</th><th>Qty</th><th>UOM</th></tr></thead>
        <tbody>${items.map(it => `
          <tr>
            <td>${escHtml(it.itemType || '-')}</td>
            <td>${escHtml(it.itemName || '-')}</td>
            <td>${it.quantity || '-'}</td>
            <td>${escHtml(it.uom || '-')}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  ` : '';

  // Approval trail
  let approvalHtml = '';
  const approvals = [];
  if (spk.kadisPusatApprovedAt) approvals.push({ label: 'Kadis PP', by: spk.kadisPusatApprovedBy, at: spk.kadisPusatApprovedAt });
  if (spk.kadisPelaporApprovedAt) approvals.push({ label: 'Kadis Pelapor', by: spk.kadisPelaporApprovedBy, at: spk.kadisPelaporApprovedAt });

  if (approvals.length > 0) {
    approvalHtml = `
      <div class="detail-section">
        <h4>✅ Riwayat Approval</h4>
        <div class="detail-grid">${approvals.map(a => `
          <div class="detail-item">
            <span class="label">${a.label}</span>
            <span class="value">${escHtml(a.by || '-')} — ${fmtDateTime(a.at)}</span>
          </div>
        `).join('')}</div>
      </div>
    `;
  }

  document.getElementById('detailContent').innerHTML = `
    <div class="status-flow" style="margin-bottom:20px">${flowHtml}</div>
    ${rejectedHtml}

    <div class="detail-section">
      <h4>📋 Informasi Utama</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">SPK Number</span><span class="value"><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></span></div>
        <div class="detail-item"><span class="label">Order Number</span><span class="value">${escHtml(spk.orderNumber || '-')}</span></div>
        <div class="detail-item"><span class="label">Notification</span><span class="value">${escHtml(spk.notificationId || '-')}</span></div>
        <div class="detail-item"><span class="label">Created</span><span class="value">${fmtDateShort(spk.createdDate)}</span></div>
        <div class="detail-item"><span class="label">Equipment</span><span class="value">${escHtml(spk.equipmentId || '-')}</span></div>
        <div class="detail-item"><span class="label">Location</span><span class="value">${escHtml(spk.location || '-')}</span></div>
        <div class="detail-item"><span class="label">Work Center</span><span class="value">${wcLabel(spk.workCenter)}</span></div>
        <div class="detail-item"><span class="label">Priority</span><span class="value">${priorityBadge(spk.priority)}</span></div>
        <div class="detail-item"><span class="label">Status</span><span class="value">${spkStatusBadge(spk.status)}</span></div>
        <div class="detail-item"><span class="label">Target Finish</span><span class="value">${fmtDateShort(spk.requestedFinishDate)}</span></div>
        <div class="detail-item"><span class="label">Ctrl Key</span><span class="value">${escHtml(spk.ctrlKey || '-')}</span></div>
        <div class="detail-item"><span class="label">Damage Class</span><span class="value">${escHtml(spk.damageClassification || '-')}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>👷 Perencanaan Sumber Daya</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Planned Workers</span><span class="value">${spk.plannedWorker || '-'} orang</span></div>
        <div class="detail-item"><span class="label">Jam/Worker</span><span class="value">${spk.plannedHourPerWorker || '-'} jam</span></div>
        <div class="detail-item"><span class="label">Total Planned Hours</span><span class="value">${spk.totalPlannedHour || '-'} jam</span></div>
        <div class="detail-item"><span class="label">Unit</span><span class="value">${escHtml(spk.unit || '-')}</span></div>
      </div>
      ${(spk.actualWorker || spk.totalActualHour) ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color)">
          <div class="detail-grid">
            <div class="detail-item"><span class="label">Actual Workers</span><span class="value">${spk.actualWorker || '-'} orang</span></div>
            <div class="detail-item"><span class="label">Actual Jam/Worker</span><span class="value">${spk.actualHourPerWorker || '-'} jam</span></div>
            <div class="detail-item"><span class="label">Total Actual Hours</span><span class="value">${spk.totalActualHour || '-'} jam</span></div>
            <div class="detail-item"><span class="label">Actual Start</span><span class="value">${fmtDateShort(spk.actualStartDate)}</span></div>
          </div>
        </div>
      ` : ''}
    </div>

    <div class="detail-section">
      <h4>📝 Deskripsi Pekerjaan</h4>
      <div style="padding:12px 16px;background:#f8f9fa;border-radius:6px;white-space:pre-wrap;font-size:13px;line-height:1.6">${escHtml(spk.jobDescription || '-')}</div>
      ${spk.jobResultDescription ? `
        <div style="margin-top:12px">
          <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase">Hasil Kerja</span>
          <div style="padding:12px 16px;background:#e8f5e9;border-radius:6px;white-space:pre-wrap;font-size:13px;line-height:1.6;margin-top:6px">${escHtml(spk.jobResultDescription)}</div>
        </div>
      ` : ''}
    </div>

    ${itemsHtml}
    ${photosHtml}
    ${approvalHtml}
  `;

  // Footer actions — use correct id "detailFooter"
  const footer = document.getElementById('detailFooter');
  let footerHtml = '<button class="btn btn-ghost" onclick="closeDetailPanel()">Tutup</button>';

  if (spk.status === 'draft') {
    footerHtml += ` <button class="btn btn-ghost" onclick="closeDetailPanel(); openSpkEditPanel('${spk.spkId}')">✏️ Edit</button>`;
  }
  if (spk.status === 'awaiting_kadis_pusat') {
    footerHtml += ` <button class="btn btn-primary" onclick="approveSpkKadisPusat('${spk.spkId}')">✓ Setujui (Kadis PP)</button>`;
    footerHtml += ` <button class="btn btn-danger" onclick="rejectSpk('${spk.spkId}')">✕ Tolak</button>`;
  } else if (spk.status === 'awaiting_kadis_pelapor') {
    footerHtml += ` <button class="btn btn-primary" onclick="approveSpkKadisPelapor('${spk.spkId}')">✓ Setujui (Pelapor)</button>`;
    footerHtml += ` <button class="btn btn-danger" onclick="rejectSpk('${spk.spkId}')">✕ Tolak</button>`;
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

function closeAllPanels() {
  document.getElementById('panel').classList.remove('show');
  document.getElementById('notifDetailPanel').classList.remove('show');
  document.getElementById('detailPanel').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
}


// ── SPK Approval Actions ─────────────────────────────────────
async function approveSpkKadisPusat(spkId) {
  showConfirmDialog('Approve Kadis PP', 'Apakah Anda yakin ingin menyetujui SPK ini? SPK akan diteruskan ke Kadis Pelapor untuk review final.', async () => {
    try {
      await apiPost(`/corrective/spk/${spkId}/approve-kadis-pusat`);
      showMessage('SPK berhasil disetujui Kadis PP!');
      closeDetailPanel();
      refreshData();
    } catch (err) { showMessage(err.message, 'error'); }
  });
}

async function approveSpkKadisPelapor(spkId) {
  showConfirmDialog('Approve Final Kadis Pelapor', 'SPK akan diselesaikan dan ditutup. Pekerjaan corrective dianggap selesai. Lanjutkan?', async () => {
    try {
      await apiPost(`/corrective/spk/${spkId}/approve-kadis-pelapor`);
      showMessage('SPK berhasil diselesaikan dan ditutup!');
      closeDetailPanel();
      refreshData();
    } catch (err) { showMessage(err.message, 'error'); }
  });
}

async function rejectSpk(spkId) {
  showConfirmDialogWithNotes('Tolak SPK', 'Berikan alasan penolakan SPK:', async (notes) => {
    try {
      await apiPost(`/corrective/spk/${spkId}/reject`, { notes });
      showMessage('SPK berhasil ditolak.');
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
  if (!tbody) return;
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="spinner"></div></td></tr>';

  try {
    allHistory = await apiGet('/corrective/spk/history');

    const filterEl = document.getElementById('filterHistoryStatus');
    let filtered = allHistory;
    if (filterEl && filterEl.value) {
      filtered = allHistory.filter(s => s.status === filterEl.value);
    }

    document.getElementById('countHistory').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
        <p>Tidak ada riwayat pekerjaan</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(spk => `
      <tr onclick="showSpkDetail('${spk.spkId}')">
        <td><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></td>
        <td>${escHtml(spk.orderNumber || '-')}</td>
        <td>
          <div>${escHtml(spk.equipmentId || '-')}</div>
          <div style="font-size:11px;color:var(--text-muted)">${wcLabel(spk.workCenter)}</div>
        </td>
        <td>${priorityBadge(spk.priority)}</td>
        <td>${spkStatusBadge(spk.status)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(spk.jobResultDescription || '-')}</td>
        <td onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" onclick="showSpkDetail('${spk.spkId}')">Detail</button></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#BB0000">Gagal memuat riwayat</td></tr>';
  }
}


// ═══════════════════════════════════════════════════════════════════
// SPK CREATE / EDIT PANEL
// ═══════════════════════════════════════════════════════════════════

let _editingSpkId = null;

function openSpkPanel(notificationId) {
  const req = allRequests.find(r => r.id === notificationId);
  if (!req) {
    showMessage('Notifikasi tidak ditemukan', 'error');
    return;
  }

  _editingSpkId = null;
  document.getElementById('spkForm').reset();
  document.getElementById('spkItemsBody').innerHTML = '';
  document.getElementById('f_spkId').value = '';
  document.getElementById('panelTitle').textContent = 'Generate SPK Corrective';
  document.getElementById('panelSave').textContent = 'Simpan SPK';
  document.getElementById('f_notificationId').value = req.id;
  document.getElementById('f_equipmentId').value = req.equipment || '';
  document.getElementById('f_location').value = req.functionalLocation || '';
  document.getElementById('f_jobDescription').value = (req.description || '') + '\n' + (req.longText || '');
  document.getElementById('f_workCenter').value = req.workCenter || 'mechanical';

  // Add a default empty item row
  addSpkItem();

  openPanel();
}

function openSpkEditPanel(spkId) {
  const spk = allSpks.find(s => s.spkId === spkId);
  if (!spk) {
    showMessage('SPK tidak ditemukan', 'error');
    return;
  }
  if (spk.status !== 'draft') {
    showMessage('Hanya SPK draft yang bisa diedit', 'error');
    return;
  }

  _editingSpkId = spkId;
  document.getElementById('spkForm').reset();
  document.getElementById('panelTitle').textContent = 'Edit SPK: ' + (spk.spkNumber || spkId);
  document.getElementById('panelSave').textContent = 'Update SPK';
  document.getElementById('f_spkId').value = spkId;
  document.getElementById('f_notificationId').value = spk.notificationId || '';
  document.getElementById('f_equipmentId').value = spk.equipmentId || '';
  document.getElementById('f_location').value = spk.location || '';
  document.getElementById('f_orderNumber').value = spk.orderNumber || '';
  document.getElementById('f_spkNumber').value = spk.spkNumber || '';
  document.getElementById('f_priority').value = spk.priority || 'medium';
  document.getElementById('f_workCenter').value = spk.workCenter || 'mechanical';
  document.getElementById('f_requestedFinishDate').value = spk.requestedFinishDate || '';
  document.getElementById('f_damageClassification').value = spk.damageClassification || '';
  document.getElementById('f_jobDescription').value = spk.jobDescription || '';
  document.getElementById('f_plannedWorker').value = spk.plannedWorker || '';
  document.getElementById('f_plannedHourPerWorker').value = spk.plannedHourPerWorker || '';
  document.getElementById('f_ctrlKey').value = spk.ctrlKey || '';
  document.getElementById('f_unit').value = spk.unit || '';

  // Populate items
  const tbody = document.getElementById('spkItemsBody');
  tbody.innerHTML = '';
  const items = spk.items || [];
  if (items.length > 0) {
    items.forEach(it => addSpkItem(it));
  } else {
    addSpkItem();
  }

  openPanel();
}

function addSpkItem(data) {
  const tbody = document.getElementById('spkItemsBody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <select class="item-type">
        <option value="material" ${(data && data.itemType === 'material') ? 'selected' : ''}>Material</option>
        <option value="tool" ${(data && data.itemType === 'tool') ? 'selected' : ''}>Tool</option>
        <option value="service" ${(data && data.itemType === 'service') ? 'selected' : ''}>Service</option>
      </select>
    </td>
    <td><input type="text" class="item-name" placeholder="Nama item..." value="${escHtml((data && data.itemName) || '')}" /></td>
    <td><input type="number" class="item-qty" min="1" value="${(data && data.quantity) || 1}" /></td>
    <td><input type="text" class="item-uom" value="${escHtml((data && data.uom) || 'pcs')}" /></td>
    <td><button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('tr').remove()" style="color:#c62828;padding:0 6px">✕</button></td>
  `;
  tbody.appendChild(row);
}

function collectSpkItems() {
  const rows = document.querySelectorAll('#spkItemsBody tr');
  const items = [];
  rows.forEach(row => {
    const name = row.querySelector('.item-name').value.trim();
    if (!name) return; // skip empty rows
    items.push({
      itemType: row.querySelector('.item-type').value,
      itemName: name,
      quantity: parseInt(row.querySelector('.item-qty').value) || 1,
      uom: row.querySelector('.item-uom').value || 'pcs',
    });
  });
  return items;
}

async function saveSpk() {
  const form = document.getElementById('spkForm');
  if (!form.reportValidity()) return;

  const btn = document.getElementById('panelSave');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  const payload = {
    notificationId: document.getElementById('f_notificationId').value,
    spkNumber: document.getElementById('f_spkNumber').value || undefined,
    orderNumber: document.getElementById('f_orderNumber').value,
    priority: document.getElementById('f_priority').value,
    equipmentId: document.getElementById('f_equipmentId').value,
    location: document.getElementById('f_location').value,
    requestedFinishDate: document.getElementById('f_requestedFinishDate').value,
    damageClassification: document.getElementById('f_damageClassification').value,
    jobDescription: document.getElementById('f_jobDescription').value,
    workCenter: document.getElementById('f_workCenter').value,
    ctrlKey: document.getElementById('f_ctrlKey').value,
    unit: document.getElementById('f_unit').value,
    plannedWorker: parseInt(document.getElementById('f_plannedWorker').value) || 1,
    plannedHourPerWorker: parseFloat(document.getElementById('f_plannedHourPerWorker').value) || 1,
    items: collectSpkItems(),
  };

  try {
    if (_editingSpkId) {
      // Update existing SPK
      await apiPut(`/corrective/spk/${_editingSpkId}`, payload);
      showMessage('SPK berhasil diupdate!');
    } else {
      // Create new SPK
      await apiPost('/corrective/spk', payload);
      showMessage('SPK Corrective berhasil dibuat! Menunggu review Kadis PP.');
    }
    closePanel();
    _editingSpkId = null;
    refreshData();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = _editingSpkId ? 'Update SPK' : 'Simpan SPK';
  }
}


// ═══════════════════════════════════════════════════════════════════
// CONFIRM DIALOG
// ═══════════════════════════════════════════════════════════════════

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
  document.getElementById('confirmExtra').innerHTML = '<textarea id="diagNotes" class="dialog-textarea" placeholder="Tulis catatan..."></textarea>';
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
