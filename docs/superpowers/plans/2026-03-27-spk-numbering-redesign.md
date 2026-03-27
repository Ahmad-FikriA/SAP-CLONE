# SPK Numbering Redesign & Seed Period Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename all SPK numbers from `SPK-{CAT}-WK{n}` to `SPK-{CAT}-{NNN}` (sequential per category), add 4 new Apr/May 2026 SPKs for period filter testing, and update the frontend auto-suggest to match.

**Architecture:** Two independent files change — `src/preventive_seed.js` (data) and `public/js/spk.js` (UI). Seed changes are a pure rename + additions. Frontend change replaces one function and adds one `onchange` attribute to the category `<select>`.

**Tech Stack:** Node.js / Express, Sequelize (MySQL), vanilla JS frontend. No test runner configured — verify by running `npm run seed` and checking the admin UI.

---

## File Map

| File | What changes |
|------|-------------|
| `src/preventive_seed.js` | Rename 12 SPK numbers, update 8 LK `spkModels` refs, update 6 submission `spkNumber` refs, add 4 new SPK entries |
| `public/js/spk.js` | Replace `suggestSpkNumber()`, add `onchange` to `#f_category` select |

---

## Task 1: Rename SPK numbers in seed + update LK and submission refs

**Files:**
- Modify: `src/preventive_seed.js`

Rename map (old → new):

| Old | New |
|-----|-----|
| SPK-M-WK3 | SPK-M-001 |
| SPK-M-WK4 | SPK-M-002 |
| SPK-M-WK7 | SPK-M-003 |
| SPK-M-WK8 | SPK-M-004 |
| SPK-M-WK12 | SPK-M-005 |
| SPK-M-WK13 | SPK-M-006 |
| SPK-L-WK2 | SPK-L-001 |
| SPK-L-WK6 | SPK-L-002 |
| SPK-L-WK8 | SPK-L-003 |
| SPK-L-WK9 | SPK-L-004 |
| SPK-S-WK10 | SPK-S-001 |
| SPK-O-WK11 | SPK-O-001 |

- [ ] **Step 1: Rename Mekanik SPK numbers**

In `src/preventive_seed.js`, change each `spkNumber:` in the `spk` array:

```js
// SPK-M-WK3 → SPK-M-001
spkNumber: 'SPK-M-001',

// SPK-M-WK13 → SPK-M-006
spkNumber: 'SPK-M-006',

// SPK-M-WK8 → SPK-M-004
spkNumber: 'SPK-M-004',

// SPK-M-WK4 → SPK-M-002
spkNumber: 'SPK-M-002',

// SPK-M-WK7 → SPK-M-003
spkNumber: 'SPK-M-003',

// SPK-M-WK12 → SPK-M-005
spkNumber: 'SPK-M-005',
```

- [ ] **Step 2: Rename Listrik, Sipil, Otomasi SPK numbers**

```js
// SPK-L-WK9 → SPK-L-004
spkNumber: 'SPK-L-004',

// SPK-L-WK8 → SPK-L-003
spkNumber: 'SPK-L-003',

// SPK-S-WK10 → SPK-S-001
spkNumber: 'SPK-S-001',

// SPK-O-WK11 → SPK-O-001
spkNumber: 'SPK-O-001',

// SPK-L-WK2 → SPK-L-001
spkNumber: 'SPK-L-001',

// SPK-L-WK6 → SPK-L-002
spkNumber: 'SPK-L-002',
```

- [ ] **Step 3: Update LK spkModels references**

Find the `lembarKerja` array and update the `spkModels` on each entry:

```js
{ lkNumber: 'LK-JAN-MEK', ..., spkModels: ['SPK-M-001', 'SPK-M-002'] },
{ lkNumber: 'LK-JAN-LIS', ..., spkModels: ['SPK-L-001'] },
{ lkNumber: 'LK-FEB-MEK', ..., spkModels: ['SPK-M-004', 'SPK-M-003'] },
{ lkNumber: 'LK-FEB-LIS', ..., spkModels: ['SPK-L-002'] },
{ lkNumber: 'LK-MAR-MEK', ..., spkModels: ['SPK-M-006', 'SPK-M-005'] },
{ lkNumber: 'LK-MAR-LIS', ..., spkModels: ['SPK-L-004', 'SPK-L-003'] },
{ lkNumber: 'LK-MAR-SIP', ..., spkModels: ['SPK-S-001'] },
{ lkNumber: 'LK-MAR-OTO', ..., spkModels: ['SPK-O-001'] },
```

- [ ] **Step 4: Update submission spkNumber references**

Find the `submissions` array and update each `spkNumber:`:

```js
{ id: 'SUB-001', spkNumber: 'SPK-L-003', ... },
{ id: 'SUB-002', spkNumber: 'SPK-M-001', ... },
{ id: 'SUB-003', spkNumber: 'SPK-M-002', ... },
{ id: 'SUB-004', spkNumber: 'SPK-L-001', ... },
{ id: 'SUB-005', spkNumber: 'SPK-M-003', ... },
{ id: 'SUB-006', spkNumber: 'SPK-L-002', ... },
```

- [ ] **Step 5: Commit**

```bash
git add src/preventive_seed.js
git commit -m "refactor(seed): rename SPK numbers from WK format to sequential per-category NNN"
```

---

## Task 2: Add 4 new Apr/May 2026 standalone SPKs to seed

**Files:**
- Modify: `src/preventive_seed.js`

These reuse the same equipment IDs and activity templates as their matching Mar 2026 SPKs. No LK entries.

- [ ] **Step 1: Append new SPKs to the `spk` array**

Add these 4 entries after the last existing SPK entry (before the closing `]` of the `spk` array):

```js
  // ── Apr/May 2026 — standalone for period filter testing ──────────────────
  {
    spkNumber: 'SPK-M-007',
    description: 'Perawatan Rutin Pompa Intake Cidanau 1M1 — Bulanan (April)',
    interval: '1 Bulan',
    category: 'Mekanik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000438', equipmentName: 'Pompa Intake Cidanau 1M1', functionalLocation: 'A-A1-01-005-004' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tekanan pompa intake (bar)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Cek kebocoran pipa dan fitting', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Pelumasan bearing motor pompa intake', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },
  {
    spkNumber: 'SPK-L-005',
    description: 'Inspeksi Panel Katodik Cidanau I — Bulanan (April)',
    interval: '1 Bulan',
    category: 'Listrik',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000640', equipmentName: 'Panel Katodik Cidanau I', functionalLocation: 'A-A1-01-005' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa tegangan output panel katodik (VDC)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Cek kondisi elektroda dan sambungan kabel', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Bersihkan terminal dan periksa korosi', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
    ],
  },
  {
    spkNumber: 'SPK-S-002',
    description: 'Pemeriksaan Manhole SLD Basin — 3 Bulanan (Mei)',
    interval: '3 Bulan',
    category: 'Sipil',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000327', equipmentName: 'Manhole SLD Basin', functionalLocation: 'A-A2-03-012' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Periksa kondisi struktur dan tutup manhole', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Bersihkan sedimen dan lumpur dalam basin', resultComment: null, durationPlan: 2.0, durationActual: null, isVerified: false },
    ],
  },
  {
    spkNumber: 'SPK-O-002',
    description: 'Kalibrasi Sensor AWLR — 3 Bulanan (Mei)',
    interval: '3 Bulan',
    category: 'Otomasi',
    status: 'pending',
    durationActual: null,
    equipmentModels: [
      { equipmentId: '2210000605', equipmentName: 'Sensor AWLR', functionalLocation: 'A-A1-01-001' },
    ],
    activitiesModel: [
      { activityNumber: 'ACT-001', operationText: 'Cek sinyal output sensor AWLR (4–20 mA)', resultComment: null, durationPlan: 0.5, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-002', operationText: 'Kalibrasi titik ukur level air (0–100%)', resultComment: null, durationPlan: 1.0, durationActual: null, isVerified: false },
      { activityNumber: 'ACT-003', operationText: 'Periksa kabel sinyal dan koneksi terminal', resultComment: null, durationPlan: 0.25, durationActual: null, isVerified: false },
    ],
  },
```

- [ ] **Step 2: Verify seed runs without error**

```bash
npm run seed
```

Expected output includes:
```
✓  spk            (16 inserted)
```
(12 existing + 4 new = 16)

- [ ] **Step 3: Commit**

```bash
git add src/preventive_seed.js
git commit -m "feat(seed): add Apr/May 2026 standalone SPKs for period filter testing"
```

---

## Task 3: Update frontend SPK number auto-suggest

**Files:**
- Modify: `public/js/spk.js` (lines ~251-258 and ~124-126)

- [ ] **Step 1: Replace `suggestSpkNumber()`**

Find and replace the entire `suggestSpkNumber` function (currently at ~line 251):

Old:
```js
function suggestSpkNumber() {
  const year = new Date().getFullYear();
  const max = allSpk.reduce(function (m, s) {
    const match = s.spkNumber.match(/SPK-\d+-(\d+)/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  return 'SPK-' + year + '-' + String(max + 1).padStart(3, '0');
}
```

New:
```js
function suggestSpkNumber() {
  const catCode = { Mekanik: 'M', Listrik: 'L', Sipil: 'S', Otomasi: 'O' };
  const cat = document.getElementById('f_category').value;
  const code = catCode[cat] || 'M';
  const prefix = 'SPK-' + code + '-';
  const max = allSpk.reduce(function (m, s) {
    if (!s.spkNumber.startsWith(prefix)) return m;
    const match = s.spkNumber.match(/SPK-[A-Z]+-(\d+)$/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  return prefix + String(max + 1).padStart(3, '0');
}
```

- [ ] **Step 2: Add `onchange` to the category select in `renderPanelForm`**

Find this line (~line 124):
```js
          <select id="f_category">
```

Replace with:
```js
          <select id="f_category" onchange="if(!editingSpkNumber)document.getElementById('f_spkNumber').value=suggestSpkNumber()">
```

- [ ] **Step 3: Verify in browser**

1. Start the server: `npm run dev`
2. Open the admin UI → SPK page → click "Tambah SPK"
3. Default category is `Mekanik` → SPK number field should show `SPK-M-008` (one after the highest Mekanik = SPK-M-007)
4. Change category to `Listrik` → field updates to `SPK-L-006`
5. Change to `Sipil` → `SPK-S-003`
6. Change to `Otomasi` → `SPK-O-003`
7. Open Edit on any existing SPK → SPK number field is readonly and does NOT change when category is touched

- [ ] **Step 4: Commit**

```bash
git add public/js/spk.js
git commit -m "feat(spk): auto-suggest SPK number as SPK-{CAT}-{NNN} based on selected category"
```
