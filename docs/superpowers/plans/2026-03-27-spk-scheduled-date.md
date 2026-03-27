# SPK Scheduled Date & Week-Based Intervals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `scheduledDate` (the Monday an SPK is active) to the SPK model, replace free-text intervals with week-based values, and expose a date-range filter on the list API for Flutter period filtering.

**Architecture:** Four independent file changes — model field, seed data, controller filter, frontend form. No new endpoints, no new files. Sequelize `alter: true` in the seed handles the schema migration automatically when `npm run seed` is run.

**Tech Stack:** Node.js / Express, Sequelize (MySQL), vanilla JS frontend. No test runner configured — verify by running `npm run seed` and inspecting the admin UI / API response.

---

## File Map

| File | Change |
|------|--------|
| `src/models/Spk.js` | Add `scheduledDate` DATEONLY field |
| `src/preventive_seed.js` | Update all intervals to wk format, add scheduledDate to each SPK |
| `src/controllers/preventive/spkController.js` | Add `from`/`to` query filter, add `scheduledDate` to `fmt()` and `create` handler |
| `public/js/spk.js` | Replace interval options, add scheduledDate date picker |

---

## Task 1: Add scheduledDate to Spk model

**Files:**
- Modify: `src/models/Spk.js`

- [ ] **Step 1: Add the field**

In `src/models/Spk.js`, after the `durationActual` field definition (line 13), add:

```js
const Spk = sequelize.define('Spk', {
  spkNumber:      { type: DataTypes.STRING(30), primaryKey: true, field: 'spk_number' },
  description:    { type: DataTypes.STRING(500), allowNull: false },
  intervalPeriod: { type: DataTypes.STRING(30),  allowNull: true, field: 'interval_period' },
  category:       { type: DataTypes.ENUM('Mekanik','Listrik','Sipil','Otomasi'), allowNull: false },
  status:         { type: DataTypes.ENUM('pending','in_progress','completed'), allowNull: false, defaultValue: 'pending' },
  durationActual: { type: DataTypes.DECIMAL(6,2), allowNull: true, field: 'duration_actual' },
  scheduledDate:  { type: DataTypes.DATEONLY,     allowNull: true, field: 'scheduled_date' },
}, {
  tableName: 'spk',
  underscored: true,
});
```

- [ ] **Step 2: Verify the file looks correct**

Read `src/models/Spk.js` and confirm `scheduledDate` appears after `durationActual` with `field: 'scheduled_date'`.

---

## Task 2: Update seed — intervals and scheduledDates

**Files:**
- Modify: `src/preventive_seed.js`

- [ ] **Step 1: Update all interval values**

Find every `interval:` field in the `spk` array and replace:

| Old value | New value |
|-----------|-----------|
| `'1 Bulan'` | `'4wk'` |
| `'3 Bulan'` | `'12wk'` |
| `'6 Bulan'` | `'16wk'` |

There are 16 SPK entries total. After replacement, no entry should have `'1 Bulan'`, `'3 Bulan'`, or `'6 Bulan'`.

- [ ] **Step 2: Add scheduledDate to every SPK entry**

Add `scheduledDate: 'YYYY-MM-DD'` to each SPK object using this exact mapping:

```js
// Mekanik
{ spkNumber: 'SPK-M-001', scheduledDate: '2026-01-19', ... }
{ spkNumber: 'SPK-M-002', scheduledDate: '2026-01-26', ... }
{ spkNumber: 'SPK-M-003', scheduledDate: '2026-02-16', ... }
{ spkNumber: 'SPK-M-004', scheduledDate: '2026-02-23', ... }
{ spkNumber: 'SPK-M-005', scheduledDate: '2026-03-23', ... }
{ spkNumber: 'SPK-M-006', scheduledDate: '2026-03-30', ... }
{ spkNumber: 'SPK-M-007', scheduledDate: '2026-04-06', ... }

// Listrik
{ spkNumber: 'SPK-L-001', scheduledDate: '2026-01-12', ... }
{ spkNumber: 'SPK-L-002', scheduledDate: '2026-02-09', ... }
{ spkNumber: 'SPK-L-003', scheduledDate: '2026-02-23', ... }
{ spkNumber: 'SPK-L-004', scheduledDate: '2026-03-02', ... }
{ spkNumber: 'SPK-L-005', scheduledDate: '2026-04-06', ... }

// Sipil
{ spkNumber: 'SPK-S-001', scheduledDate: '2026-03-09', ... }
{ spkNumber: 'SPK-S-002', scheduledDate: '2026-05-04', ... }

// Otomasi
{ spkNumber: 'SPK-O-001', scheduledDate: '2026-03-16', ... }
{ spkNumber: 'SPK-O-002', scheduledDate: '2026-05-04', ... }
```

- [ ] **Step 3: Update the Spk.create() call in main()**

In `src/preventive_seed.js`, find the `Spk.create()` call in `main()` (~line 514):

```js
await Spk.create({ spkNumber: s.spkNumber, description: s.description, intervalPeriod: s.interval, category: s.category, status: s.status, durationActual: s.durationActual });
```

Replace with:

```js
await Spk.create({ spkNumber: s.spkNumber, description: s.description, intervalPeriod: s.interval, category: s.category, status: s.status, durationActual: s.durationActual, scheduledDate: s.scheduledDate ?? null });
```

- [ ] **Step 4: Verify by running the seed**

```bash
npm run seed
```

Expected: seed completes without error. Then call the API:

```bash
curl http://localhost:3000/api/spk | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d); console.log(r.map(s=>s.spkNumber+' '+s.scheduledDate+' '+s.interval).join('\n'))"
```

Expected: 16 rows, each with a `scheduledDate` (Monday) and a `wk` interval value.

---

## Task 3: Add date filter and scheduledDate to controller

**Files:**
- Modify: `src/controllers/preventive/spkController.js`

- [ ] **Step 1: Add scheduledDate to fmt()**

In `spkController.js`, the `fmt` function currently returns an object starting at line 39. Add `scheduledDate` after `durationActual`:

```js
function fmt(spk) {
  const j = spk.toJSON();
  const lkEnds = (j.lkLinks || [])
    .map(link => link.lk?.periodeEnd)
    .filter(Boolean)
    .map(d => new Date(d));
  const dueDate = lkEnds.length > 0
    ? new Date(Math.min(...lkEnds))
    : null;
  return {
    spkNumber: j.spkNumber,
    description: j.description,
    interval: j.intervalPeriod,
    category: j.category,
    status: j.status,
    durationActual: j.durationActual,
    scheduledDate: j.scheduledDate ?? null,
    dueDate: dueDate ? dueDate.toISOString() : null,
    equipmentModels: (j.equipmentModels || []).map(em => ({
      equipmentId: em.equipmentId,
      equipmentName: em.equipmentName,
      functionalLocation: em.functionalLocation,
      latitude: em.equipmentDetails?.latitude ?? null,
      longitude: em.equipmentDetails?.longitude ?? null,
    })),
    activitiesModel: j.activitiesModel || [],
  };
}
```

- [ ] **Step 2: Add from/to filter to getAll**

In the `getAll` handler, after the existing `where` object is built (line 65), add:

```js
const getAll = async (req, res) => {
  if (req.query.category && !VALID_CATEGORIES.includes(req.query.category)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  const where = req.query.category ? { category: req.query.category } : {};

  if (req.query.from) where.scheduledDate = { ...where.scheduledDate, [Op.gte]: req.query.from };
  if (req.query.to)   where.scheduledDate = { ...where.scheduledDate, [Op.lte]: req.query.to };

  // If equipmentId is given... (rest of function unchanged)
```

- [ ] **Step 3: Add scheduledDate to the create handler**

Find the `create` handler (~line 95). Update the destructure and `Spk.create()` call:

```js
const create = async (req, res) => {
  const { spkNumber, description, interval, category, status, durationActual, scheduledDate, equipmentModels = [], activitiesModel = [] } = req.body;
  if (!spkNumber) return res.status(400).json({ error: 'spkNumber is required' });

  const exists = await Spk.findByPk(spkNumber);
  if (exists) return res.status(409).json({ error: 'spkNumber already exists' });

  const t = await sequelize.transaction();
  try {
    const spk = await Spk.create({
      spkNumber,
      description,
      intervalPeriod: interval,
      category,
      status: status || 'pending',
      durationActual: durationActual ?? null,
      scheduledDate: scheduledDate ?? null,
    }, { transaction: t });
    for (const eq of equipmentModels) await SpkEquipment.create({ ...eq, spkNumber }, { transaction: t });
    for (const act of activitiesModel) await SpkActivity.create({ ...act, spkNumber }, { transaction: t });
    await t.commit();
    const fresh = await Spk.findByPk(spkNumber, { include: INCLUDE_FULL });
    res.status(201).json(fmt(fresh));
  } catch (err) { await t.rollback(); throw err; }
};
```

- [ ] **Step 4: Verify filter works**

With server running after seed:

```bash
curl "http://localhost:3000/api/spk?from=2026-04-06&to=2026-04-10"
```

Expected: returns exactly 2 SPKs — `SPK-M-007` and `SPK-L-005` (both scheduled 2026-04-06).

```bash
curl "http://localhost:3000/api/spk?from=2026-01-01&to=2026-01-31"
```

Expected: returns `SPK-M-001`, `SPK-M-002`, `SPK-L-001` (January SPKs).

---

## Task 4: Update frontend form

**Files:**
- Modify: `public/js/spk.js`

- [ ] **Step 1: Replace interval options**

Find this line in `renderPanelForm` (~line 83):

```js
  const intervals = ['1 Minggu', '2 Minggu', '1 Bulan', '3 Bulan', '6 Bulan', '1 Tahun'];
```

Replace with:

```js
  const intervals = ['1wk', '2wk', '4wk', '8wk', '12wk', '14wk', '16wk'];
```

- [ ] **Step 2: Add scheduledDate field to the form**

Find the form row containing the interval select (~line 108):

```js
      <div class="form-group">
          <label>Interval *</label>
          <select id="f_interval">
            ${intervals.map(v => `<option ${spk && spk.interval === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
```

Replace that entire `<div class="form-row">` block (the one wrapping SPK Number and Interval) with:

```js
      <div class="form-row">
        <div class="form-group">
          <label>SPK Number *</label>
          <input id="f_spkNumber" value="${escHtml(spk ? spk.spkNumber : suggestSpkNumber())}" ${isEdit ? 'readonly' : ''} />
        </div>
        <div class="form-group">
          <label>Interval *</label>
          <select id="f_interval">
            ${intervals.map(v => `<option ${spk && spk.interval === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tanggal Mulai</label>
          <input type="date" id="f_scheduledDate" value="${escHtml(spk && spk.scheduledDate ? spk.scheduledDate : '')}" />
        </div>
      </div>
```

- [ ] **Step 3: Include scheduledDate in saveSpk()**

Find the `saveSpk` function (~line 261). Locate where `body` is constructed and add `scheduledDate`:

```js
async function saveSpk() {
  const spkNumber = document.getElementById('f_spkNumber').value.trim();
  const description = document.getElementById('f_description').value.trim();
  const interval = document.getElementById('f_interval').value;
  const category = document.getElementById('f_category').value;
  const status = document.getElementById('f_status').value;
  const scheduledDate = document.getElementById('f_scheduledDate').value || null;

  if (!spkNumber || !description) { alert('SPK Number dan Deskripsi wajib diisi.'); return; }

  // ... (equipment and activity collection unchanged) ...

  const body = {
    spkNumber, description, interval, category, status,
    scheduledDate,
    durationActual: null, equipmentModels: checkedEq, activitiesModel
  };
```

- [ ] **Step 4: Verify in browser**

1. Start server: `npm run dev`
2. Open admin UI → SPK page
3. Click "Tambah SPK" — confirm interval dropdown shows `1wk … 16wk` and a date input appears
4. Open Edit on `SPK-M-001` — confirm interval shows `4wk` and scheduledDate shows `2026-01-19`
5. Create a new SPK with a scheduledDate → save → confirm `scheduledDate` appears in the table row (or verify via API)
