/* ─── SPK Import Page — spk-import.js ─── */

// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════

var _parsedOrders = [];

var VALID_INTERVALS = ['1wk', '2wk', '4wk', '8wk', '12wk', '16wk', '24wk'];

// ══════════════════════════════════════════════════
// DRAG & DROP HANDLERS
// ══════════════════════════════════════════════════

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  var zone = document.getElementById('uploadZone');
  if (zone) zone.classList.add('dragover');
}

function handleDragLeave() {
  var zone = document.getElementById('uploadZone');
  if (zone) zone.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  var zone = document.getElementById('uploadZone');
  if (zone) zone.classList.remove('dragover');

  var files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length > 0) {
    processFile(files[0]);
  }
}

// ══════════════════════════════════════════════════
// FILE INPUT HANDLER
// HTML uses onchange="handleFileSelect(event)"
// Task spec also names it onFileSelected — both wired.
// ══════════════════════════════════════════════════

function handleFileSelect(e) {
  var file = e.target.files && e.target.files[0];
  if (file) processFile(file);
}

// Alias so both names work
function onFileSelected(e) {
  handleFileSelect(e);
}

// ══════════════════════════════════════════════════
// PROCESS FILE — validate, upload, preview
// ══════════════════════════════════════════════════

function processFile(file) {
  // Validate extension
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    showMessage('File harus berformat .xlsx', 'error');
    return;
  }

  // Update label and collapse zone
  var zone = document.getElementById('uploadZone');
  if (zone) zone.classList.add('has-file');
  var label = document.getElementById('uploadLabel');
  if (label) label.textContent = 'Mengupload ' + file.name + '...';

  var formData = new FormData();
  formData.append('file', file);

  fetch(window.API_BASE + '/spk/import-excel/preview', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + getToken()
      // No Content-Type — let browser set multipart boundary
    },
    body: formData
  })
    .then(function (res) {
      if (res.status === 401) {
        clearAuth();
        window.location.href = '/pages/login.html';
        return null;
      }
      if (!res.ok) {
        return res.json().catch(function () { return { error: res.statusText }; }).then(function (err) {
          throw new Error(err.error || ('HTTP ' + res.status));
        });
      }
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      _parsedOrders = data.orders || [];
      renderPreview(_parsedOrders);
    })
    .catch(function (err) {
      if (zone) zone.classList.remove('has-file');
      if (label) label.textContent = 'Klik atau seret file Excel ke sini';
      showMessage('Gagal membaca file: ' + err.message, 'error');
    });
}

// ══════════════════════════════════════════════════
// RENDER PREVIEW
// ══════════════════════════════════════════════════

function renderPreview(orders) {
  var section = document.getElementById('previewSection');
  var title = document.getElementById('previewTitle');
  var stats = document.getElementById('previewStats');
  var body = document.getElementById('previewBody');

  if (!section || !title || !stats || !body) return;

  // Show section
  section.style.display = '';

  // Title
  title.textContent = 'Preview — ' + orders.length + ' order';

  // Stats badges
  stats.textContent = '';

  var totalCount = orders.length;
  var existingCount = orders.filter(function (o) { return o.alreadyExists; }).length;
  var newCount = totalCount - existingCount;
  var autoCount = orders.filter(function (o) { return !o.alreadyExists && o.intervalResolution === 'auto'; }).length;
  var ambiguousCount = orders.filter(function (o) { return !o.alreadyExists && o.intervalResolution === 'ambiguous'; }).length;
  var unknownCount = orders.filter(function (o) { return !o.alreadyExists && o.intervalResolution === 'unknown'; }).length;

  var badgeDefs = [
    { label: 'Total: ' + totalCount, cls: 'grey' },
    { label: 'Baru: ' + newCount, cls: 'green' },
    { label: 'Sudah ada: ' + existingCount, cls: 'grey' },
    { label: 'Auto: ' + autoCount, cls: 'green' },
    { label: 'Pilih interval: ' + ambiguousCount, cls: 'amber' },
    { label: 'Tidak dikenali: ' + unknownCount, cls: 'red' }
  ];

  badgeDefs.forEach(function (def) {
    var badge = document.createElement('span');
    badge.className = 'stat-badge ' + def.cls;
    badge.textContent = def.label;
    stats.appendChild(badge);
  });

  // Table rows
  body.textContent = '';
  orders.forEach(function (order, idx) {
    body.appendChild(buildRow(order, idx));
  });

  updateFooter();
}

// ══════════════════════════════════════════════════
// BUILD ROW — safe DOM only, no innerHTML with data
// ══════════════════════════════════════════════════

function buildRow(order, idx) {
  var tr = document.createElement('tr');

  if (order.alreadyExists) {
    tr.style.opacity = '0.5';
  }

  // 1. Order number
  var td1 = document.createElement('td');
  var code1 = document.createElement('code');
  code1.textContent = order.orderNumber || '';
  td1.appendChild(code1);
  tr.appendChild(td1);

  // 2. Description (truncated via CSS, full text in title)
  var td2 = document.createElement('td');
  var desc = order.description || '';
  td2.setAttribute('title', desc);
  td2.style.maxWidth = '200px';
  td2.style.overflow = 'hidden';
  td2.style.textOverflow = 'ellipsis';
  td2.style.whiteSpace = 'nowrap';
  td2.textContent = desc;
  tr.appendChild(td2);

  // 3. Scheduled date
  var td3 = document.createElement('td');
  td3.style.whiteSpace = 'nowrap';
  td3.textContent = order.scheduledDate || '—';
  tr.appendChild(td3);

  // 4. Equipment / Building name
  var td4 = document.createElement('td');
  // Primary: display name (equipment name for regular, building name for Sipil)
  var name4 = document.createElement('div');
  name4.style.fontWeight = '500';
  name4.textContent = order.displayName || order.equipmentId || order.functionalLocation || '—';
  td4.appendChild(name4);
  // Subtitle: show the raw ID/FuncLoc code for reference
  var sub4 = document.createElement('div');
  sub4.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:2px';
  sub4.textContent = order.equipmentId || order.functionalLocation || '';
  if (sub4.textContent) td4.appendChild(sub4);
  tr.appendChild(td4);

  // 5. Category
  var td5 = document.createElement('td');
  td5.textContent = order.category || '—';
  tr.appendChild(td5);

  // 6. Interval cell
  var td6 = document.createElement('td');
  if (order.alreadyExists) {
    var existBadge = document.createElement('span');
    existBadge.className = 'res-badge res-existing';
    existBadge.textContent = '—';
    td6.appendChild(existBadge);
  } else if (order.intervalResolution === 'auto') {
    var autoBadge = document.createElement('span');
    autoBadge.className = 'res-badge res-auto';
    autoBadge.textContent = order.interval || '';
    td6.appendChild(autoBadge);
  } else if (order.intervalResolution === 'ambiguous') {
    var sel = document.createElement('select');
    sel.className = 'interval-select';
    sel.setAttribute('data-idx', String(idx));
    sel.setAttribute('onchange', 'onIntervalChange(this)');

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Pilih --';
    sel.appendChild(placeholder);

    var options = order.intervalOptions || [];
    options.forEach(function (opt) {
      var optEl = document.createElement('option');
      optEl.value = opt;
      optEl.textContent = opt;
      if (opt === order.interval) optEl.selected = true;
      sel.appendChild(optEl);
    });

    td6.appendChild(sel);
  } else if (order.intervalResolution === 'unknown') {
    var selU = document.createElement('select');
    selU.className = 'interval-select';
    selU.setAttribute('data-idx', String(idx));
    selU.setAttribute('onchange', 'onIntervalChange(this)');

    var placeholderU = document.createElement('option');
    placeholderU.value = '';
    placeholderU.textContent = '-- Pilih --';
    selU.appendChild(placeholderU);

    VALID_INTERVALS.forEach(function (iv) {
      var optEl = document.createElement('option');
      optEl.value = iv;
      optEl.textContent = iv;
      if (iv === order.interval) optEl.selected = true;
      selU.appendChild(optEl);
    });

    td6.appendChild(selU);
  }
  tr.appendChild(td6);

  // 7. Activity count
  var td7 = document.createElement('td');
  var actCount = (order.activitiesModel || []).length;
  td7.textContent = actCount + ' aktivitas';
  tr.appendChild(td7);

  // 8. Status badge
  var td8 = document.createElement('td');
  var statusBadgeEl = document.createElement('span');
  statusBadgeEl.className = 'res-badge';

  if (order.alreadyExists) {
    statusBadgeEl.classList.add('res-existing');
    statusBadgeEl.textContent = 'Sudah ada';
  } else if (order.intervalResolution === 'auto') {
    statusBadgeEl.classList.add('res-auto');
    statusBadgeEl.textContent = '\u2713 Auto';
  } else if (order.intervalResolution === 'ambiguous') {
    statusBadgeEl.classList.add('res-ambiguous');
    statusBadgeEl.textContent = '\u26A0 Pilih interval';
  } else {
    statusBadgeEl.classList.add('res-unknown');
    statusBadgeEl.textContent = '\u2717 Tidak dikenali';
  }

  td8.appendChild(statusBadgeEl);
  tr.appendChild(td8);

  return tr;
}

// ══════════════════════════════════════════════════
// INTERVAL CHANGE HANDLER
// ══════════════════════════════════════════════════

function onIntervalChange(selectEl) {
  var idx = parseInt(selectEl.dataset.idx, 10);
  if (isNaN(idx) || idx < 0 || idx >= _parsedOrders.length) return;
  _parsedOrders[idx].interval = selectEl.value || null;
  updateFooter();
}

// ══════════════════════════════════════════════════
// FOOTER STATE
// ══════════════════════════════════════════════════

function updateFooter() {
  var footerInfo = document.getElementById('footerInfo');
  var confirmBtn = document.getElementById('confirmBtn');
  var printBtn   = document.getElementById('printBtn');
  if (!footerInfo || !confirmBtn) return;

  var toImport = _parsedOrders.filter(function (o) { return !o.alreadyExists; });
  var ready = toImport.filter(function (o) { return !!o.interval; });
  var pending = toImport.filter(function (o) { return !o.interval; });
  var skipped = _parsedOrders.filter(function (o) { return o.alreadyExists; }).length;

  // Clear footer
  footerInfo.textContent = '';

  if (_parsedOrders.length === 0) {
    confirmBtn.disabled = true;
    if (printBtn) printBtn.disabled = true;
    var span = document.createElement('span');
    span.style.color = 'var(--text-muted)';
    span.textContent = 'Belum ada file dipilih';
    footerInfo.appendChild(span);
    return;
  }

  if (printBtn) printBtn.disabled = false;

  if (pending.length > 0) {
    confirmBtn.disabled = true;
    var warnSpan = document.createElement('span');
    warnSpan.style.color = '#7a5500';
    warnSpan.textContent = pending.length + ' order belum dipilih intervalnya. Pilih semua interval sebelum mengimport.';
    footerInfo.appendChild(warnSpan);
    return;
  }

  // All new orders have an interval set (or there are none)
  if (ready.length > 0) {
    confirmBtn.disabled = false;
  } else {
    confirmBtn.disabled = true;
  }

  var infoSpan = document.createElement('span');
  infoSpan.textContent = ready.length + ' order siap diimport';
  if (skipped > 0) {
    infoSpan.textContent += ' (' + skipped + ' dilewati \u2014 sudah ada)';
  }
  footerInfo.appendChild(infoSpan);
}

// ══════════════════════════════════════════════════
// CONFIRM IMPORT
// ══════════════════════════════════════════════════

function confirmImport() {
  var toImport = _parsedOrders.filter(function (o) { return !o.alreadyExists && !!o.interval; });
  if (toImport.length === 0) return;

  var confirmBtn = document.getElementById('confirmBtn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Mengimport...';
  }

  hideMessage();

  apiPost('/spk/import-excel/confirm', { orders: toImport })
    .then(function (result) {
      showMessage(result.message || 'Import berhasil', 'success');

      // Mark imported orders as alreadyExists
      var importedNumbers = result.spkNumbers || [];
      if (importedNumbers.length > 0) {
        _parsedOrders.forEach(function (order) {
          if (importedNumbers.indexOf(order.orderNumber) !== -1) {
            order.alreadyExists = true;
          }
        });
        renderPreview(_parsedOrders);
      }
    })
    .catch(function (err) {
      showMessage('Import gagal: ' + err.message, 'error');
    })
    .finally(function () {
      var btn = document.getElementById('confirmBtn');
      if (btn) {
        btn.textContent = 'Import SPK';
        // Re-enable state is determined by updateFooter (called in renderPreview)
        // If renderPreview was not called (error path), update footer manually
        updateFooter();
      }
    });
}

// ══════════════════════════════════════════════════
// PRINT PREVIEW
// ══════════════════════════════════════════════════

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function printPreview() {
  if (!_parsedOrders.length) return;

  var orders = _parsedOrders;
  var now = new Date();
  var dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  var totalCount     = orders.length;
  var newCount       = orders.filter(function(o) { return !o.alreadyExists; }).length;
  var existingCount  = orders.filter(function(o) { return o.alreadyExists; }).length;
  var autoCount      = orders.filter(function(o) { return !o.alreadyExists && o.intervalResolution === 'auto'; }).length;
  var ambiguousCount = orders.filter(function(o) { return !o.alreadyExists && o.intervalResolution === 'ambiguous'; }).length;
  var unknownCount   = orders.filter(function(o) { return !o.alreadyExists && (o.intervalResolution === 'unknown' || o.intervalResolution === 'partial'); }).length;

  function statusLabel(o) {
    if (o.alreadyExists)                      return 'Sudah Ada';
    if (o.intervalResolution === 'auto')      return 'Auto';
    if (o.intervalResolution === 'ambiguous') return 'Pilih Interval';
    if (o.intervalResolution === 'partial')   return 'Perlu Interval';
    return 'Tidak Dikenali';
  }

  function statusColor(o) {
    if (o.alreadyExists)                      return '#3949ab';
    if (o.intervalResolution === 'auto')      return '#1a6e2e';
    if (o.intervalResolution === 'ambiguous') return '#7a5500';
    return '#9e2a22';
  }

  var rows = orders.map(function(o, i) {
    var actCount    = (o.activitiesModel || []).length;
    var interval    = o.interval || '\u2014';
    var displayName = o.displayName || o.equipmentId || o.functionalLocation || '\u2014';
    var idCode      = o.equipmentId || o.functionalLocation || '';
    return '<tr>' +
      '<td style="text-align:center;color:#666">' + (i + 1) + '</td>' +
      '<td><code style="font-size:11px;background:#f4f4f4;padding:1px 4px;border-radius:3px">' + esc(o.orderNumber || '') + '</code></td>' +
      '<td>' + esc(o.description || '\u2014') + '</td>' +
      '<td>' +
        '<div style="font-weight:500">' + esc(displayName) + '</div>' +
        (idCode ? '<div style="font-size:10px;color:#888;margin-top:1px">' + esc(idCode) + '</div>' : '') +
      '</td>' +
      '<td style="text-align:center">' + esc(o.category || '\u2014') + '</td>' +
      '<td style="text-align:center;font-weight:600;color:#1B3A5C">' + esc(interval) + '</td>' +
      '<td style="text-align:center">' + actCount + '</td>' +
      '<td style="text-align:center;color:' + statusColor(o) + ';font-weight:600">' + statusLabel(o) + '</td>' +
    '</tr>';
  }).join('');

  var html = [
    '<!DOCTYPE html><html lang="id"><head>',
    '<meta charset="UTF-8"><title>Print Preview \u2014 Import SAP</title>',
    '<style>',
    'body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:20px}',
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1B3A5C;padding-bottom:10px;margin-bottom:16px}',
    '.hdr-l h1{margin:0 0 2px;font-size:15px;color:#1B3A5C}',
    '.hdr-l p{margin:0;font-size:11px;color:#555}',
    '.hdr-r{font-size:11px;color:#555;text-align:right}',
    '.summary{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}',
    '.box{border:1px solid #ddd;border-radius:6px;padding:8px 14px;min-width:80px}',
    '.box .val{font-size:20px;font-weight:700;color:#1B3A5C}',
    '.box .lbl{font-size:10px;color:#777;margin-top:2px}',
    'table{width:100%;border-collapse:collapse;font-size:11px}',
    'thead tr{background:#1B3A5C;color:#fff}',
    'thead th{padding:7px 8px;text-align:left;white-space:nowrap}',
    'tbody tr:nth-child(even){background:#f8f9fa}',
    'tbody td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}',
    '@media print{body{padding:0}@page{size:A4 landscape;margin:12mm 10mm}thead{display:table-header-group}}',
    '</style></head><body>',
    '<div class="hdr">',
      '<div class="hdr-l"><h1>Daftar SPK Import SAP \u2014 Preventive Maintenance</h1>',
      '<p>PT Krakatau Tirta Industri &nbsp;|&nbsp; KTI SmartCare</p></div>',
      '<div class="hdr-r">Tanggal cetak: ' + dateStr + '<br>Total order: ' + totalCount + '</div>',
    '</div>',
    '<div class="summary">',
      '<div class="box"><div class="val">' + totalCount + '</div><div class="lbl">Total Order</div></div>',
      '<div class="box"><div class="val" style="color:#1a6e2e">' + newCount + '</div><div class="lbl">Order Baru</div></div>',
      '<div class="box"><div class="val" style="color:#1a6e2e">' + autoCount + '</div><div class="lbl">Auto</div></div>',
      '<div class="box"><div class="val" style="color:#7a5500">' + ambiguousCount + '</div><div class="lbl">Pilih Interval</div></div>',
      '<div class="box"><div class="val" style="color:#9e2a22">' + unknownCount + '</div><div class="lbl">Tidak Dikenali</div></div>',
      '<div class="box"><div class="val" style="color:#3949ab">' + existingCount + '</div><div class="lbl">Sudah Ada</div></div>',
    '</div>',
    '<table><thead><tr>',
      '<th style="width:30px">No</th>',
      '<th>No. Order SAP</th>',
      '<th>Deskripsi</th>',
      '<th>Equipment / Bangunan</th>',
      '<th style="text-align:center">Kategori</th>',
      '<th style="text-align:center">Interval</th>',
      '<th style="text-align:center">Aktivitas</th>',
      '<th style="text-align:center">Status</th>',
    '</tr></thead>',
    '<tbody>' + rows + '</tbody></table>',
    '<script>window.onload=function(){window.print();}<\/script>',
    '</body></html>'
  ].join('');

  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var win  = window.open(url, '_blank');
  if (win) {
    win.addEventListener('afterprint', function() {
      URL.revokeObjectURL(url);
    });
  }
}

// ══════════════════════════════════════════════════
// RESET
// ══════════════════════════════════════════════════

function resetImport() {
  _parsedOrders = [];

  var fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';

  var zone2 = document.getElementById('uploadZone');
  if (zone2) zone2.classList.remove('has-file');

  var label = document.getElementById('uploadLabel');
  if (label) label.textContent = 'Klik atau seret file Excel ke sini';

  var section = document.getElementById('previewSection');
  if (section) section.style.display = 'none';

  var confirmBtn = document.getElementById('confirmBtn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Import SPK';
  }

  var footerInfo = document.getElementById('footerInfo');
  if (footerInfo) {
    footerInfo.textContent = '';
    var span = document.createElement('span');
    span.style.color = 'var(--text-muted)';
    span.textContent = 'Belum ada file dipilih';
    footerInfo.appendChild(span);
  }

  hideMessage();
}
