/* ═══════════════════════════════════════════════════════
 * Corrective Planner — Full Workflow JS
 * Handles Notifications, SPK CRUD, Approvals, History
 * ═══════════════════════════════════════════════════════ */

let allRequests = [];
let allSpks = [];
let allHistory = [];

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refreshData();
});

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');

  if (tabId === 'tab-requests') document.getElementById('nav-requests').classList.add('active');
  else if (tabId === 'tab-spk') document.getElementById('nav-spk').classList.add('active');
  else document.getElementById('nav-history').classList.add('active');
}

function refreshData() {
  loadRequests();
  loadSpk();
  loadHistory();
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function approvalTag(status) {
  const map = {
    pending:                        { cls: 'pending',  label: 'Pending' },
    approved:                       { cls: 'approved', label: 'Approved' },
    menunggu_review_awal_kadis_pp:  { cls: 'waiting',  label: 'Menunggu Review Kadis PP' },
    spk_issued:                     { cls: 'issued',   label: 'SPK Issued (Siap Kerja)' },
    eksekusi:                       { cls: 'eksekusi',  label: 'Eksekusi' },
    menunggu_review_kadis_pp:       { cls: 'waiting',  label: 'Menunggu Review Kadis PP (Akhir)' },
    ditolak_kadis_pp_awal:          { cls: 'rejected', label: 'Ditolak Kadis PP' },
    closed:                         { cls: 'closed',   label: 'Closed' },
  };
  const info = map[status] || { cls: 'pending', label: status || 'Unknown' };
  return `<span class="approval-tag ${info.cls}">${info.label}</span>`;
}

function priorityBadge(p) {
  return `<span class="priority-badge ${p || 'medium'}">${(p || 'medium').toUpperCase()}</span>`;
}

function spkStatusBadge(status) {
  const map = {
    draft:                  { cls: 'badge-pending',     label: 'Draft' },
    eksekusi:               { cls: 'badge-in_progress', label: 'Eksekusi' },
    awaiting_kadis_pusat:   { cls: 'badge-in_progress', label: 'Menunggu Kadis Pusat' },
    awaiting_kadis_pelapor: { cls: 'badge-in_progress', label: 'Menunggu Kadis Pelapor' },
    completed:              { cls: 'badge-completed',   label: 'Selesai' },
    rejected:               { cls: 'badge-error',       label: 'Ditolak' },
  };
  const info = map[status] || { cls: 'badge-pending', label: status || '-' };
  return `<span class="badge ${info.cls}">${info.label}</span>`;
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1: NOTIFICATIONS / REQUESTS
// ═══════════════════════════════════════════════════════════════════

async function loadRequests() {
  const tbody = document.getElementById('reqBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><div class="spinner"></div></td></tr>';

  try {
    const params = new URLSearchParams();
    const statusFilter = document.getElementById('filterReqStatus').value;
    if (statusFilter) params.set('status', statusFilter);

    const qs = params.toString() ? `?${params}` : '';
    allRequests = await apiGet('/corrective/requests' + qs);

    // Client-side approval-status filter
    const approvalFilter = document.getElementById('filterApprovalStatus').value;
    let filtered = allRequests;
    if (approvalFilter) {
      filtered = allRequests.filter(r => r.approvalStatus === approvalFilter);
    }

    document.getElementById('countRequests').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        <p>Belum ada notifikasi corrective</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(req => {
      // Build action buttons based on status + approvalStatus
      let actions = '';

      // Pending notification → Planner can approve
      if (req.status === 'submitted' && req.approvalStatus === 'pending') {
        actions = `
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); approvePlanner('${req.id}')">Terima</button>
        `;
      }
      // Approved → Planner can generate SPK
      else if (req.status === 'approved' && !req.spkId) {
        actions = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openSpkPanel('${req.id}')">Generate SPK</button>`;
      }
      // SPK Created + waiting review → Kadis PP can approve/reject
      else if (req.approvalStatus === 'menunggu_review_awal_kadis_pp') {
        actions = `
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); approveKadisPP('${req.id}')">Approve</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger-color)" onclick="event.stopPropagation(); rejectKadisPP('${req.id}')">Tolak</button>
        `;
      }
      // SPK Issued
      else if (req.approvalStatus === 'spk_issued' || req.approvalStatus === 'eksekusi' || req.approvalStatus === 'menunggu_review_kadis_pp') {
        actions = `<span style="font-size:12px;color:var(--text-muted);">SPK: ${escHtml(req.spkNumber||req.spkId||'')}</span>`;
      }
      else if (req.approvalStatus === 'ditolak_kadis_pp_awal') {
        actions = `<span style="font-size:12px;color:var(--danger-color);">Ditolak oleh Kadis PP</span>`;
      }
      else {
        actions = `<span style="font-size:12px;color:var(--text-muted);">—</span>`;
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

  const photos = (req.images || []).filter(Boolean);
  const photosHtml = photos.length > 0
    ? `<div class="notif-photos">${photos.map(p => `<img src="/${p}" alt="Photo" onclick="window.open('/${p}','_blank')" />`).join('')}</div>`
    : '<span style="color:var(--text-muted)">Tidak ada foto</span>';

  document.getElementById('notifDetailContent').innerHTML = `
    <div class="detail-section">
      <h4>Informasi Notifikasi</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Notification ID</span><span class="value"><strong>${escHtml(req.id)}</strong></span></div>
        <div class="detail-item"><span class="label">Tanggal</span><span class="value">${fmtDateShort(req.notificationDate)}</span></div>
        <div class="detail-item"><span class="label">Tipe</span><span class="value">${escHtml(req.notificationType || '-')}</span></div>
        <div class="detail-item"><span class="label">Pelapor</span><span class="value">${escHtml(req.reportedBy || '-')}</span></div>
        <div class="detail-item"><span class="label">Equipment</span><span class="value">${escHtml(req.equipment || '-')}</span></div>
        <div class="detail-item"><span class="label">Lokasi Fungsional</span><span class="value">${escHtml(req.functionalLocation || '-')}</span></div>
        <div class="detail-item"><span class="label">Work Center</span><span class="value">${escHtml(req.workCenter || '-')}</span></div>
        <div class="detail-item"><span class="label">Required Start</span><span class="value">${fmtDateShort(req.requiredStart)}</span></div>
        <div class="detail-item"><span class="label">Required End</span><span class="value">${fmtDateShort(req.requiredEnd)}</span></div>
        <div class="detail-item"><span class="label">Submitted By</span><span class="value">${escHtml(req.submittedBy || '-')}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Deskripsi</h4>
      <div style="white-space:pre-wrap;font-size:13px;background:var(--bg-body);padding:12px;border-radius:6px;border:1px solid var(--border-color)">${escHtml(req.description || '-')}</div>
      ${req.longText ? `<div style="margin-top:8px;white-space:pre-wrap;font-size:13px;color:var(--text-muted)">${escHtml(req.longText)}</div>` : ''}
    </div>

    <div class="detail-section">
      <h4>Foto Laporan</h4>
      ${photosHtml}
    </div>

    <div class="detail-section">
      <h4>Status</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Status</span><span class="value">${statusBadge(req.status)}</span></div>
        <div class="detail-item"><span class="label">Approval Status</span><span class="value">${approvalTag(req.approvalStatus)}</span></div>
        ${req.spkId ? `<div class="detail-item"><span class="label">SPK ID</span><span class="value"><strong>${escHtml(req.spkId)}</strong></span></div>` : ''}
        ${req.spkNumber ? `<div class="detail-item"><span class="label">SPK Number</span><span class="value">${escHtml(req.spkNumber)}</span></div>` : ''}
      </div>
    </div>
  `;

  // Build footer actions
  const footer = document.getElementById('notifDetailFooter');
  let footerActions = '<button class="btn btn-ghost" onclick="closeNotifDetailPanel()">Tutup</button>';

  if (req.status === 'submitted' && req.approvalStatus === 'pending') {
    footerActions += ` <button class="btn btn-primary" onclick="closeNotifDetailPanel(); approvePlanner('${req.id}')">Terima Laporan</button>`;
  }
  if (req.status === 'approved' && !req.spkId) {
    footerActions += ` <button class="btn btn-primary" onclick="closeNotifDetailPanel(); openSpkPanel('${req.id}')">Generate SPK</button>`;
  }
  if (req.approvalStatus === 'menunggu_review_awal_kadis_pp') {
    footerActions += `
      <button class="btn btn-primary" onclick="closeNotifDetailPanel(); approveKadisPP('${req.id}')">Approve Kadis PP</button>
      <button class="btn btn-ghost" style="color:var(--danger-color)" onclick="closeNotifDetailPanel(); rejectKadisPP('${req.id}')">Tolak Kadis PP</button>
    `;
  }
  footer.innerHTML = footerActions;

  document.getElementById('notifDetailPanel').classList.add('visible');
  document.getElementById('overlay').classList.add('show');
}

function closeNotifDetailPanel() {
  document.getElementById('notifDetailPanel').classList.remove('visible');
  document.getElementById('overlay').classList.remove('show');
}

// ── Planner Approves Notification ────────────────────────────
async function approvePlanner(notifId) {
  showConfirmDialog(
    'Terima Laporan',
    'Apakah Anda yakin ingin menerima dan menyetujui laporan notifikasi ini? Status akan berubah menjadi "Approved" dan siap dibuatkan SPK.',
    async () => {
      try {
        await apiPost(`/corrective/requests/${notifId}/approve-planner`);
        showMessage('Laporan berhasil diterima!');
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

    // Filter out completed/rejected (those go in history)
    const active = allSpks.filter(s => s.status !== 'completed' && s.status !== 'rejected');
    document.getElementById('countSpk').textContent = active.length;

    if (active.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <p>Belum ada SPK Corrective aktif</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = active.map(spk => {
      let actions = `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showSpkDetail('${spk.spkId}')">Detail</button>`;

      if (spk.status === 'draft') {
        actions += ` <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openSpkEditPanel('${spk.spkId}')">Edit</button>`;
        actions += ` <button class="btn btn-ghost btn-sm" style="color:var(--danger-color)" onclick="event.stopPropagation(); deleteSpk('${spk.spkId}')">Hapus</button>`;
      }
      if (spk.status === 'awaiting_kadis_pusat') {
        actions += ` <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); approveSpkKadisPusat('${spk.spkId}')">Approve</button>`;
        actions += ` <button class="btn btn-ghost btn-sm" style="color:var(--danger-color)" onclick="event.stopPropagation(); rejectSpk('${spk.spkId}')">Tolak</button>`;
      }
      if (spk.status === 'awaiting_kadis_pelapor') {
        actions += ` <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); approveSpkKadisPelapor('${spk.spkId}')">Approve</button>`;
        actions += ` <button class="btn btn-ghost btn-sm" style="color:var(--danger-color)" onclick="event.stopPropagation(); rejectSpk('${spk.spkId}')">Tolak</button>`;
      }

      return `
        <tr onclick="showSpkDetail('${spk.spkId}')">
          <td><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></td>
          <td>${escHtml(spk.orderNumber || '-')}</td>
          <td>${fmtDateShort(spk.createdDate)}</td>
          <td>
            <div>${escHtml(spk.equipmentId || '-')}</div>
            <div style="font-size:12px;color:var(--text-muted)">${escHtml(spk.workCenter || '')}</div>
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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger-color)">Gagal memuat SPK</td></tr>';
  }
}

// ── SPK Detail Panel ─────────────────────────────────────────
function showSpkDetail(spkId) {
  const spk = allSpks.find(s => s.spkId === spkId) || allHistory.find(s => s.spkId === spkId);
  if (!spk) return;

  // Build status flow
  const steps = [
    { label: 'Draft', key: 'draft' },
    { label: 'Eksekusi', key: 'eksekusi' },
    { label: 'Kadis Pusat', key: 'awaiting_kadis_pusat' },
    { label: 'Kadis Pelapor', key: 'awaiting_kadis_pelapor' },
    { label: 'Selesai', key: 'completed' },
  ];
  const statusOrder = steps.map(s => s.key);
  const currentIdx = statusOrder.indexOf(spk.status);
  const isRejected = spk.status === 'rejected';

  const flowHtml = steps.map((step, i) => {
    let cls = '';
    if (isRejected) cls = i <= 0 ? 'done' : '';
    else if (i < currentIdx) cls = 'done';
    else if (i === currentIdx) cls = 'active';
    return `<span class="step ${cls}">${step.label}</span>` + (i < steps.length - 1 ? '<span class="arrow">→</span>' : '');
  }).join('');

  const rejectedHtml = isRejected ? `
    <div class="detail-section">
      <h4>Penolakan</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Ditolak Oleh</span><span class="value">${escHtml(spk.rejectedBy || '-')}</span></div>
        <div class="detail-item"><span class="label">Tanggal Ditolak</span><span class="value">${fmtDateShort(spk.rejectedAt)}</span></div>
        <div class="detail-item full"><span class="label">Catatan Penolakan</span><span class="value" style="color:var(--danger-color)">${escHtml(spk.rejectionNotes || 'Tidak ada catatan')}</span></div>
      </div>
    </div>
  ` : '';

  // Photos
  const beforePhotos = (spk.photos || []).filter(p => p.photoType === 'before');
  const afterPhotos = (spk.photos || []).filter(p => p.photoType === 'after');
  const photosHtml = (beforePhotos.length > 0 || afterPhotos.length > 0) ? `
    <div class="detail-section">
      <h4>Foto Dokumentasi</h4>
      ${beforePhotos.length > 0 ? `
        <div style="margin-bottom:8px"><strong style="font-size:12px;color:var(--text-muted)">SEBELUM:</strong></div>
        <div class="notif-photos">${beforePhotos.map(p => `<img src="/${p.photoPath}" alt="Before" onclick="window.open('/${p.photoPath}','_blank')" />`).join('')}</div>
      ` : ''}
      ${afterPhotos.length > 0 ? `
        <div style="margin-top:12px;margin-bottom:8px"><strong style="font-size:12px;color:var(--text-muted)">SESUDAH:</strong></div>
        <div class="notif-photos">${afterPhotos.map(p => `<img src="/${p.photoPath}" alt="After" onclick="window.open('/${p.photoPath}','_blank')" />`).join('')}</div>
      ` : ''}
    </div>
  ` : '';

  document.getElementById('detailContent').innerHTML = `
    <div class="status-flow">${flowHtml}</div>
    ${isRejected ? '<div style="text-align:center;margin-bottom:16px"><span class="badge badge-error" style="font-size:13px;padding:6px 16px">SPK DITOLAK</span></div>' : ''}

    <div class="detail-section">
      <h4>Informasi SPK</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">SPK Number</span><span class="value"><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></span></div>
        <div class="detail-item"><span class="label">Order Number</span><span class="value">${escHtml(spk.orderNumber || '-')}</span></div>
        <div class="detail-item"><span class="label">Equipment ID</span><span class="value">${escHtml(spk.equipmentId || '-')}</span></div>
        <div class="detail-item"><span class="label">Lokasi</span><span class="value">${escHtml(spk.location || '-')}</span></div>
        <div class="detail-item"><span class="label">Work Center</span><span class="value">${escHtml(spk.workCenter || '-')}</span></div>
        <div class="detail-item"><span class="label">Priority</span><span class="value">${priorityBadge(spk.priority)}</span></div>
        <div class="detail-item"><span class="label">Target Finish</span><span class="value">${fmtDateShort(spk.requestedFinishDate)}</span></div>
        <div class="detail-item"><span class="label">Damage Classification</span><span class="value">${escHtml(spk.damageClassification || '-')}</span></div>
        <div class="detail-item"><span class="label">Ctrl Key</span><span class="value">${escHtml(spk.ctrlKey || '-')}</span></div>
        <div class="detail-item"><span class="label">Unit</span><span class="value">${escHtml(spk.unit || '-')}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Perencanaan</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Planned Workers</span><span class="value">${spk.plannedWorker ?? '-'} orang</span></div>
        <div class="detail-item"><span class="label">Jam per Worker</span><span class="value">${spk.plannedHourPerWorker ?? '-'} jam</span></div>
        <div class="detail-item"><span class="label">Total Planned Hour</span><span class="value">${spk.totalPlannedHour ?? '-'} jam</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Eksekusi / Aktual</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Actual Start Date</span><span class="value">${spk.actualStartDate ? fmtDateShort(spk.actualStartDate) : '-'}</span></div>
        <div class="detail-item"><span class="label">Actual Workers</span><span class="value">${spk.actualWorker ?? '-'} orang</span></div>
        <div class="detail-item"><span class="label">Actual Jam</span><span class="value">${spk.actualHourPerWorker ?? '-'} jam</span></div>
        <div class="detail-item"><span class="label">Total Actual Hour</span><span class="value">${spk.totalActualHour ?? '-'} jam</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Job Description</h4>
      <div style="white-space:pre-wrap;font-size:13px;background:var(--bg-body);padding:12px;border-radius:6px;border:1px solid var(--border-color)">${escHtml(spk.jobDescription || '-')}</div>
    </div>

    ${spk.jobResultDescription ? `
    <div class="detail-section">
      <h4>Hasil Pekerjaan</h4>
      <div style="white-space:pre-wrap;font-size:13px;background:var(--bg-body);padding:12px;border-radius:6px;border:1px solid var(--border-color)">${escHtml(spk.jobResultDescription)}</div>
    </div>` : ''}

    ${rejectedHtml}

    <div class="detail-section">
      <h4>Approval Trail</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Kadis Pusat</span><span class="value">${spk.kadisPusatApprovedBy ? `✓ ${escHtml(spk.kadisPusatApprovedBy)} (${fmtDateShort(spk.kadisPusatApprovedAt)})` : '—'}</span></div>
        <div class="detail-item"><span class="label">Kadis Pelapor</span><span class="value">${spk.kadisPelaporApprovedBy ? `✓ ${escHtml(spk.kadisPelaporApprovedBy)} (${fmtDateShort(spk.kadisPelaporApprovedAt)})` : '—'}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Materials & Tools</h4>
      <table class="items-table">
        <tr><th>Type</th><th>Name</th><th>Qty</th><th>UOM</th></tr>
        ${(spk.items || []).map(i => `<tr><td>${escHtml(i.itemType)}</td><td>${escHtml(i.itemName)}</td><td>${i.quantity}</td><td>${escHtml(i.uom)}</td></tr>`).join('')}
        ${(!spk.items || spk.items.length === 0) ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Tidak ada item</td></tr>' : ''}
      </table>
    </div>

    ${photosHtml}
  `;

  // Build footer with actions
  const footer = document.getElementById('detailFooter');
  let footerHtml = '<button class="btn btn-ghost" onclick="closeDetailPanel()">Tutup</button>';

  if (spk.status === 'draft') {
    footerHtml += ` <button class="btn btn-ghost" onclick="closeDetailPanel(); openSpkEditPanel('${spk.spkId}')">Edit SPK</button>`;
    footerHtml += ` <button class="btn btn-ghost" style="color:var(--danger-color)" onclick="closeDetailPanel(); deleteSpk('${spk.spkId}')">Hapus SPK</button>`;
  }
  if (spk.status === 'awaiting_kadis_pusat') {
    footerHtml += ` <button class="btn btn-primary" onclick="closeDetailPanel(); approveSpkKadisPusat('${spk.spkId}')">Approve Kadis Pusat</button>`;
    footerHtml += ` <button class="btn btn-ghost" style="color:var(--danger-color)" onclick="closeDetailPanel(); rejectSpk('${spk.spkId}')">Tolak</button>`;
  }
  if (spk.status === 'awaiting_kadis_pelapor') {
    footerHtml += ` <button class="btn btn-primary" onclick="closeDetailPanel(); approveSpkKadisPelapor('${spk.spkId}')">Approve Kadis Pelapor</button>`;
    footerHtml += ` <button class="btn btn-ghost" style="color:var(--danger-color)" onclick="closeDetailPanel(); rejectSpk('${spk.spkId}')">Tolak</button>`;
  }
  footer.innerHTML = footerHtml;

  document.getElementById('detailPanel').classList.add('visible');
  document.getElementById('overlay').classList.add('show');
}

function closeDetailPanel() {
  document.getElementById('detailPanel').classList.remove('visible');
  document.getElementById('overlay').classList.remove('show');
}

// ── SPK Approve/Reject ───────────────────────────────────────
async function approveSpkKadisPusat(spkId) {
  showConfirmDialog(
    'Approve SPK — Kadis Pusat',
    'Menyetujui SPK ini akan memajukan status ke "Menunggu Kadis Pelapor". Lanjutkan?',
    async () => {
      try {
        await apiPost(`/corrective/spk/${spkId}/approve-kadis-pusat`);
        showMessage('SPK berhasil disetujui oleh Kadis Pusat!');
        refreshData();
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }
  );
}

async function approveSpkKadisPelapor(spkId) {
  showConfirmDialog(
    'Approve SPK — Kadis Pelapor',
    'Menyetujui SPK ini akan menyelesaikan pekerjaan corrective. Notifikasi terkait akan di-close. Lanjutkan?',
    async () => {
      try {
        await apiPost(`/corrective/spk/${spkId}/approve-kadis-pelapor`);
        showMessage('SPK berhasil diselesaikan!');
        refreshData();
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }
  );
}

async function rejectSpk(spkId) {
  showConfirmDialogWithNotes(
    'Tolak SPK',
    'SPK akan ditolak. Mohon berikan alasan penolakan:',
    async (notes) => {
      try {
        await apiPost(`/corrective/spk/${spkId}/reject`, { notes });
        showMessage('SPK berhasil ditolak.');
        refreshData();
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }
  );
}

async function deleteSpk(spkId) {
  showConfirmDialog(
    'Hapus SPK',
    'Yakin ingin menghapus SPK Corrective ini? Notifikasi terkait akan kembali ke status "Approved".',
    async () => {
      try {
        await apiDelete('/corrective/spk/' + spkId);
        showMessage('SPK berhasil dihapus');
        refreshData();
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3: HISTORY
// ═══════════════════════════════════════════════════════════════════

async function loadHistory() {
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><div class="spinner"></div></td></tr>';

  try {
    allHistory = await apiGet('/corrective/spk/history');

    const statusFilter = document.getElementById('filterHistoryStatus').value;
    let filtered = allHistory;
    if (statusFilter) {
      filtered = allHistory.filter(s => s.status === statusFilter);
    }

    document.getElementById('countHistory').textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <p>Belum ada riwayat SPK</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(spk => `
      <tr onclick="showSpkDetail('${spk.spkId}')">
        <td><strong>${escHtml(spk.spkNumber || spk.spkId)}</strong></td>
        <td>${escHtml(spk.orderNumber || '-')}</td>
        <td>
          <div>${escHtml(spk.equipmentId || '-')}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(spk.workCenter || '')}</div>
        </td>
        <td>${priorityBadge(spk.priority)}</td>
        <td>${spkStatusBadge(spk.status)}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(spk.jobResultDescription || '-')}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" onclick="showSpkDetail('${spk.spkId}')">Detail</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
    showMessage(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger-color)">Gagal memuat riwayat</td></tr>';
  }
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
  document.getElementById('panelTitle').textContent = 'Generate SPK Corrective';
  document.getElementById('panelSave').textContent = 'Generate SPK';

  document.getElementById('f_notificationId').value = req.id;
  document.getElementById('f_equipmentId').value = req.equipment || '';
  document.getElementById('f_location').value = req.functionalLocation || '';
  document.getElementById('f_jobDescription').value = req.description + (req.longText ? '\n' + req.longText : '');

  if (req.workCenter) {
    document.getElementById('f_workCenter').value = req.workCenter;
  }

  if (req.requiredEnd) {
    document.getElementById('f_requestedFinishDate').value = req.requiredEnd.substring(0, 10);
  } else {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    document.getElementById('f_requestedFinishDate').value = date.toISOString().split('T')[0];
  }

  openPanel();
}

function openSpkEditPanel(spkId) {
  const spk = allSpks.find(s => s.spkId === spkId);
  if (!spk) return;

  document.getElementById('spkForm').reset();
  document.getElementById('spkItemsBody').innerHTML = '';
  document.getElementById('f_spkId').value = spk.spkId;
  document.getElementById('panelTitle').textContent = 'Edit SPK Corrective';
  document.getElementById('panelSave').textContent = 'Simpan Perubahan';

  document.getElementById('f_notificationId').value = spk.notificationId;
  document.getElementById('f_equipmentId').value = spk.equipmentId || '';
  document.getElementById('f_location').value = spk.location || '';
  document.getElementById('f_jobDescription').value = spk.jobDescription || '';
  document.getElementById('f_workCenter').value = spk.workCenter || '';

  if (spk.requestedFinishDate) {
    document.getElementById('f_requestedFinishDate').value = spk.requestedFinishDate.substring(0, 10);
  }
  document.getElementById('f_orderNumber').value = spk.orderNumber || '';
  document.getElementById('f_spkNumber').value = spk.spkNumber || spk.spkId;
  document.getElementById('f_priority').value = spk.priority || 'medium';
  document.getElementById('f_damageClassification').value = spk.damageClassification || '';
  document.getElementById('f_ctrlKey').value = spk.ctrlKey || '';
  document.getElementById('f_unit').value = spk.unit || '';
  document.getElementById('f_plannedWorker').value = spk.plannedWorker || '';
  document.getElementById('f_plannedHourPerWorker').value = spk.plannedHourPerWorker || '';

  if (spk.items && spk.items.length > 0) {
    spk.items.forEach(i => {
      addSpkItem();
      const lastTr = document.getElementById('spkItemsBody').lastElementChild;
      lastTr.querySelector('.item-type').value = i.itemType;
      lastTr.querySelector('.item-name').value = i.itemName;
      lastTr.querySelector('.item-qty').value = i.quantity;
      lastTr.querySelector('.item-uom').value = i.uom;
    });
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
  if (!spkForm.reportValidity()) return;

  const btn = document.getElementById('panelSave');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Menyimpan...';

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
    items,
  };

  try {
    const editId = document.getElementById('f_spkId').value;
    if (editId) {
      await apiPut('/corrective/spk/' + editId, payload);
      showMessage('SPK Corrective berhasil diperbarui!');
    } else {
      await apiPost('/corrective/spk', payload);
      showMessage('SPK Corrective berhasil dibuat!');
    }

    closePanel();
    refreshData();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONFIRM DIALOG
// ═══════════════════════════════════════════════════════════════════

let _confirmCallback = null;

function showConfirmDialog(title, message, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = message;
  document.getElementById('confirmExtra').innerHTML = '';
  document.getElementById('confirmOk').textContent = 'OK';
  document.getElementById('confirmOk').className = 'btn btn-primary';
  _confirmCallback = onConfirm;
  document.getElementById('confirmOk').onclick = async () => {
    closeConfirmDialog();
    if (_confirmCallback) await _confirmCallback();
  };
  document.getElementById('confirmDialog').classList.add('show');
}

function showConfirmDialogWithNotes(title, message, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = message;
  document.getElementById('confirmExtra').innerHTML = '<textarea class="dialog-textarea" id="dialogNotes" placeholder="Catatan / alasan..."></textarea>';
  document.getElementById('confirmOk').textContent = 'Konfirmasi';
  document.getElementById('confirmOk').className = 'btn btn-primary';
  _confirmCallback = onConfirm;
  document.getElementById('confirmOk').onclick = async () => {
    const notes = document.getElementById('dialogNotes').value.trim();
    closeConfirmDialog();
    if (_confirmCallback) await _confirmCallback(notes);
  };
  document.getElementById('confirmDialog').classList.add('show');
}

function closeConfirmDialog() {
  document.getElementById('confirmDialog').classList.remove('show');
  _confirmCallback = null;
}
