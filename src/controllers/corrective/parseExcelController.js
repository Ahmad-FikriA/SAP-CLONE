'use strict';

const XLSX  = require('xlsx');
const JSZip = require('jszip');
const path  = require('path');
const fs    = require('fs');
const { v4: uuid } = require('uuid');

const STORAGE_DIR = path.join(__dirname, '..', '..', '..', 'storage', 'corrective');

// Ensure storage dir exists
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

/**
 * Cell mapping — label row → value column E (index 4)
 * Structure: { jsonKey: rowIndex (0-based) }
 */
const FIELD_MAP = {
  notificationDate: 5,   // R5 (0-based) = row 6 in Excel
  notificationType: 6,   // R6
  description:      7,   // R7 = "Description of Notification"
  functionalLocation: 9, // R9
  equipment:        10,  // R10
  requiredStart:    12,  // R12
  requiredEnd:      13,  // R13
  reportedBy:       15,  // R15
};

function cellVal(ws, row, col) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[addr];
  if (!cell) return null;
  return typeof cell.v === 'string' ? cell.v.trim() : cell.v;
}

function parseDateVal(raw) {
  if (!raw) return null;
  // If it's already a JS Date from xlsx
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  // If it's a string like "1/28/2026"
  const d = new Date(raw);
  return isNaN(d.getTime()) ? String(raw) : d.toISOString().split('T')[0];
}

// Find Long Text: starts after "Long Text :" label, collect non-empty rows until "Foto Kerusakan"
function extractLongText(ws, range) {
  let startRow = null;
  let endRow = range.e.r;

  for (let r = range.s.r; r <= range.e.r; r++) {
    const v = cellVal(ws, r, 2); // column C
    if (v && String(v).toLowerCase().includes('long text')) { startRow = r + 1; }
    if (v && String(v).toLowerCase().includes('foto kerusakan') && startRow !== null) { endRow = r - 1; break; }
  }

  if (startRow === null) return null;

  const parts = [];
  for (let r = startRow; r <= endRow; r++) {
    // Check columns C through G for text
    for (let c = 2; c <= 6; c++) {
      const v = cellVal(ws, r, c);
      if (v) parts.push(String(v));
    }
  }
  return parts.join(' ').trim() || null;
}

// POST /api/corrective/parse-excel
const parseExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File xlsx required (field: "file")' });

  const buffer = req.file.buffer;

  // ── 1. Parse spreadsheet data ─────────────────────────────────────────────
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref']);

  const result = {};
  for (const [key, row] of Object.entries(FIELD_MAP)) {
    const raw = cellVal(ws, row, 4); // column E (index 4)
    if (key.includes('Date') || key.includes('Start') || key.includes('End')) {
      result[key] = parseDateVal(raw);
    } else {
      result[key] = raw || null;
    }
  }

  result.longText = extractLongText(ws, range);

  // ── 2. Extract images via JSZip ───────────────────────────────────────────
  const zip = await JSZip.loadAsync(buffer);
  const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('xl/media/'));

  const savedImages = [];
  for (const mediaPath of mediaFiles) {
    const imgBuf = await zip.files[mediaPath].async('nodebuffer');
    const ext = path.extname(mediaPath) || '.png';
    const filename = `${uuid()}${ext}`;
    const destPath = path.join(STORAGE_DIR, filename);
    fs.writeFileSync(destPath, imgBuf);
    savedImages.push(`/storage/corrective/${filename}`);
  }

  result.images = savedImages;

  res.json(result);
};

module.exports = { parseExcel };
