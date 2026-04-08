'use strict';

const path = require('path');
const fs   = require('fs');
const { Op } = require('sequelize');
const Equipment = require('../../models/Equipment');

const MAPS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'maps');

// GET /api/equipment
// Query: ?category=Mekanik  ?search=pompa  ?limit=50  ?offset=0  ?funcLocId=A-A1-01
const getAll = async (req, res) => {
  const where = {};
  if (req.query.category) where.category = req.query.category;
  if (req.query.plantId) where.plantId = req.query.plantId;
  if (req.query.funcLocId) where.funcLocId = { [Op.like]: `${req.query.funcLocId}%` };
  if (req.query.search) {
    where[Op.or] = [
      { equipmentId: { [Op.like]: `%${req.query.search}%` } },
      { equipmentName: { [Op.like]: `%${req.query.search}%` } },
    ];
  }

  const limit = parseInt(req.query.limit, 10) || 500;
  const offset = parseInt(req.query.offset, 10) || 0;

  const { count, rows } = await Equipment.findAndCountAll({ where, limit, offset, order: [['equipmentId', 'ASC']] });
  res.json({ total: count, limit, offset, data: rows });
};

// POST /api/equipment
const create = async (req, res) => {
  const { equipmentId, equipmentName } = req.body;
  if (!equipmentId || !equipmentName) {
    return res.status(400).json({ error: 'equipmentId and equipmentName are required' });
  }
  const exists = await Equipment.findByPk(equipmentId);
  if (exists) return res.status(409).json({ error: 'equipmentId already exists' });

  const eq = await Equipment.create(req.body);
  res.status(201).json(eq);
};

// GET /api/equipment/:equipmentId
const getOne = async (req, res) => {
  const eq = await Equipment.findByPk(req.params.equipmentId);
  if (!eq) return res.status(404).json({ error: 'Equipment not found' });

  const result = eq.toJSON();

  // Resolve polygon from plant GeoJSON if feature name is set
  if (result.polygonFeatureName && result.plantId) {
    try {
      const geojsonPath = path.join(MAPS_DIR, `${result.plantId}.geojson`);
      if (fs.existsSync(geojsonPath)) {
        const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
        const feature = geojson.features.find(
          f => f.properties?.name === result.polygonFeatureName
            && f.geometry?.type === 'Polygon'
        );
        if (feature) {
          // GeoJSON is [lon, lat] — convert to [lat, lon] for mobile
          result.boundaryPolygon = feature.geometry.coordinates[0].map(
            ([lon, lat]) => [lat, lon]
          );
        }
      }
    } catch (_) {
      // GeoJSON read failure is non-fatal — omit boundaryPolygon
    }
  }

  res.json(result);
};

// PUT /api/equipment/:equipmentId
const update = async (req, res) => {
  const eq = await Equipment.findByPk(req.params.equipmentId);
  if (!eq) return res.status(404).json({ error: 'Equipment not found' });
  await eq.update({ ...req.body, equipmentId: eq.equipmentId });
  res.json(eq);
};

// POST /api/equipment/bulk-delete
const bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array required' });
  }
  const count = await Equipment.destroy({ where: { equipmentId: { [Op.in]: ids } } });
  res.json({ message: `Deleted ${count} equipment(s)` });
};

// DELETE /api/equipment/:equipmentId
const remove = async (req, res) => {
  const count = await Equipment.destroy({ where: { equipmentId: req.params.equipmentId } });
  if (!count) return res.status(404).json({ error: 'Equipment not found' });
  res.json({ message: 'Deleted' });
};

// POST /api/equipment/bulk-update
// Body: { ids: ["EQ001","EQ002"], plantId: "I-22L001", plantName: "PS I Cidanau" }
const bulkUpdate = async (req, res) => {
  const { ids, ...fields } = req.body;
  if (!Array.isArray(ids) || !ids.length)
    return res.status(400).json({ error: 'ids array required' });
  delete fields.equipmentId;
  const [count] = await Equipment.update(fields, {
    where: { equipmentId: { [Op.in]: ids } },
  });
  res.json({ message: `Updated ${count} equipment(s)` });
};

// POST /api/equipment/import-excel
// Expects multipart/form-data field "file" (.xlsx).
// Header row columns (case-insensitive, spaces/underscores ignored):
//   equipment_id | equipment_name | category | func_loc_id | functional_location
//   plant_id | plant_name
// Rows are upserted — safe to re-import after updates.
const importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Send field "file" as multipart/form-data.' });

  let XLSX;
  try { XLSX = require('xlsx'); } catch { return res.status(500).json({ error: 'xlsx package not installed. Run: npm install xlsx' }); }

  const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  // Normalise header names (lowercase, strip spaces/underscores/dashes)
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s_\.\-]/g, ''); }

  // SAP exports often have 1-2 title rows before the real header.
  // Scan raw rows until we find one that looks like a real header
  // (contains a cell that normalises to a known equipment field name).
  const KNOWN_HEADERS = new Set(['equipment', 'equipmentid', 'equipid', 'equipmentname', 'name', 'description', 'descriptionoftechnicalobject']);
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', header: 1 });
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    if (rawRows[i].some(cell => KNOWN_HEADERS.has(norm(cell)))) { headerRowIdx = i; break; }
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', range: headerRowIdx });

  if (!rows.length) return res.status(400).json({ error: 'Sheet is empty or has no data rows' });

  const sample = rows[0];
  const map    = {};
  for (const k of Object.keys(sample)) {
    const n = norm(k);
    if (['equipmentid', 'equipment', 'equip', 'equipid'].includes(n))                            map.equipmentId        = k;
    if (['equipmentname', 'name', 'equipname', 'description', 'descriptionoftechnicalobject'].includes(n)) map.equipmentName = k;
    if (['category', 'cat', 'kategori', 'pg', 'plannergroup'].includes(n))                       map.category           = k;
    if (['funclocid', 'funcloc', 'funclocation', 'funclocation', 'functionallocationid'].includes(n)) map.funcLocId       = k;
    if (['functionallocation'].includes(n))                                                       map.functionalLocation = k;
    // SAP "Location" column = plant section ID (e.g. I-22L001) — use as plantId
    // SAP "Plant" column = company code (e.g. KTI1) — lower priority, only use if no Location
    if (n === 'location')                                                                          map.plantId            = k;
    else if (['plantid', 'werkid'].includes(n))                                                   map.plantId            = map.plantId || k;
    if (n === 'plant' && !map.plantId)                                                            map.plantId            = k;
    if (['plantname', 'plantdesc', 'werk'].includes(n))                                           map.plantName          = k;
  }

  if (!map.equipmentId || !map.equipmentName) {
    return res.status(400).json({
      error: 'Could not find required columns: equipment_id and equipment_name',
      foundColumns: Object.keys(sample),
    });
  }

  // SAP PG column uses numeric codes; also accept text values
  const VALID_CATEGORIES = {
    mekanik: 'Mekanik', mechanical: 'Mekanik', '221': 'Mekanik',
    listrik: 'Listrik', electrical: 'Listrik', '222': 'Listrik',
    sipil: 'Sipil', civil: 'Sipil', '223': 'Sipil',
    otomasi: 'Otomasi', automation: 'Otomasi', '224': 'Otomasi',
  };

  let imported = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    const equipmentId   = String(row[map.equipmentId]   || '').trim();
    const equipmentName = String(row[map.equipmentName] || '').trim();
    if (!equipmentId || !equipmentName) { skipped++; continue; }

    const rawCat  = map.category ? String(row[map.category] || '').trim().toLowerCase() : '';
    const category = VALID_CATEGORIES[rawCat] || null;

    const vals = {
      equipmentName,
      category,
      funcLocId:          map.funcLocId          ? (String(row[map.funcLocId]          || '').trim() || null) : null,
      functionalLocation: map.functionalLocation ? (String(row[map.functionalLocation] || '').trim() || null) : null,
      plantId:            map.plantId            ? (String(row[map.plantId]            || '').trim() || null) : null,
      plantName:          map.plantName          ? (String(row[map.plantName]          || '').trim() || null) : null,
    };

    try {
      const [, created] = await Equipment.upsert({ equipmentId, ...vals });
      imported++;
      if (!created) skipped++; // counted as updated — subtract from "new" mentally
    } catch (err) {
      errors.push('Row skipped: ' + equipmentId + ' — ' + err.message);
      skipped++;
    }
  }

  res.json({
    message: 'Import selesai: ' + imported + ' baris diproses, ' + skipped + ' dilewati',
    imported,
    skipped,
    errors: errors.slice(0, 20),
  });
};

module.exports = { getAll, getOne, create, update, bulkDelete, bulkUpdate, remove, importExcel };
