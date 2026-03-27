# SPK Scheduled Date & Week-Based Intervals

**Date:** 2026-03-27
**Status:** Approved

---

## Overview

Three changes:
1. Add `scheduledDate` (DATE) to the SPK model — the Monday of the week this SPK is active
2. Replace free-text interval values with week-based options: `1wk`, `2wk`, `4wk`, `8wk`, `12wk`, `14wk`, `16wk`
3. Add `?from=` / `?to=` date filter on `GET /api/spk` for Flutter period filtering

---

## Concepts

- **interval** — how often the equipment needs preventive maintenance (e.g., `4wk` = every 4 weeks)
- **scheduledDate** — the Monday of the specific week this SPK instance is due. Active window = scheduledDate (Mon) through scheduledDate + 4 days (Fri). Outside this window the SPK is not relevant for the current period.

---

## Section 1: Data Model

**File:** `src/models/Spk.js`

Add field:
```js
scheduledDate: {
  type: DataTypes.DATEONLY,
  allowNull: true,
  field: 'scheduled_date',
},
```

---

## Section 2: Seed Updates

**File:** `src/preventive_seed.js`

### Interval mapping (old → new)
| Old | New |
|-----|-----|
| `"1 Bulan"` | `"4wk"` |
| `"3 Bulan"` | `"12wk"` |
| `"6 Bulan"` | `"16wk"` |

### scheduledDate per SPK (all Mondays)
| SPK | scheduledDate |
|-----|--------------|
| SPK-M-001 | 2026-01-19 |
| SPK-M-002 | 2026-01-26 |
| SPK-M-003 | 2026-02-16 |
| SPK-M-004 | 2026-02-23 |
| SPK-M-005 | 2026-03-23 |
| SPK-M-006 | 2026-03-30 |
| SPK-L-001 | 2026-01-12 |
| SPK-L-002 | 2026-02-09 |
| SPK-L-003 | 2026-02-23 |
| SPK-L-004 | 2026-03-02 |
| SPK-S-001 | 2026-03-09 |
| SPK-O-001 | 2026-03-16 |
| SPK-M-007 | 2026-04-06 |
| SPK-L-005 | 2026-04-06 |
| SPK-S-002 | 2026-05-04 |
| SPK-O-002 | 2026-05-04 |

---

## Section 3: API

**File:** `src/controllers/preventive/spkController.js`

### GET /api/spk — new query params
- `?from=YYYY-MM-DD` — filter `scheduledDate >= from`
- `?to=YYYY-MM-DD` — filter `scheduledDate <= to`
- Both are optional and combinable
- Example: `?from=2026-04-06&to=2026-04-10` returns all SPKs scheduled for that Mon–Fri week

### Response shape
Add `scheduledDate` to the `fmt()` function output:
```js
scheduledDate: j.scheduledDate,
```

### POST /api/spk — create controller update
In the `create` handler, `scheduledDate` must be explicitly destructured from `req.body` and passed to `Spk.create()`:
```js
const { spkNumber, description, interval, category, status, durationActual, scheduledDate, equipmentModels = [], activitiesModel = [] } = req.body;
// ...
await Spk.create({ spkNumber, description, intervalPeriod: interval, category, status: status || 'pending', durationActual: durationActual ?? null, scheduledDate: scheduledDate ?? null }, { transaction: t });
```

The `update` handler uses `...rest` spread so `scheduledDate` passes through automatically.

### Implementation (in `getAll`)
```js
const { Op } = require('sequelize');
// existing where = {}
if (req.query.from) where.scheduledDate = { ...where.scheduledDate, [Op.gte]: req.query.from };
if (req.query.to)   where.scheduledDate = { ...where.scheduledDate, [Op.lte]: req.query.to };
```

---

## Section 4: Frontend Form

**File:** `public/js/spk.js`

### Interval dropdown
Replace current options (`1 Bulan`, `3 Bulan`, `6 Bulan`, etc.) with:
```js
const intervals = ['1wk', '2wk', '4wk', '8wk', '12wk', '14wk', '16wk'];
```

### Scheduled Date field
Add a date input to the form, in the same row as interval:
```html
<div class="form-group">
  <label>Tanggal Mulai *</label>
  <input type="date" id="f_scheduledDate" value="${spk && spk.scheduledDate ? spk.scheduledDate : ''}" />
</div>
```

### Save body
Include in the POST/PUT body:
```js
scheduledDate: document.getElementById('f_scheduledDate').value || null,
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/models/Spk.js` | Add `scheduledDate` field |
| `src/preventive_seed.js` | Update all intervals to wk format, add scheduledDate to each SPK |
| `src/controllers/preventive/spkController.js` | Add from/to filter, include scheduledDate in fmt() |
| `public/js/spk.js` | Update interval options, add scheduledDate date picker |
