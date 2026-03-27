# SPK Numbering Redesign & Seed Period Expansion

**Date:** 2026-03-27
**Status:** Approved

---

## Overview

Two changes:
1. Rename all SPK numbers from `SPK-{CAT}-WK{n}` to `SPK-{CAT}-{NNN}` (sequential per category)
2. Update the frontend auto-suggest to match the new format
3. Add 4 new standalone SPKs in Apr/May 2026 for period filter testing

---

## New SPK Number Format

`SPK-{CAT}-{NNN}`

- `CAT` — single-letter category code: `M` (Mekanik), `L` (Listrik), `S` (Sipil), `O` (Otomasi)
- `NNN` — zero-padded 3-digit counter, **per category**, assigned chronologically (oldest = 001)

Examples: `SPK-M-001`, `SPK-L-004`, `SPK-O-002`

---

## Seed: SPK Renaming Map

| Old Number   | New Number  | Category | Month     | Status    |
|--------------|-------------|----------|-----------|-----------|
| SPK-M-WK3    | SPK-M-001   | Mekanik  | Jan 2026  | completed |
| SPK-M-WK4    | SPK-M-002   | Mekanik  | Jan 2026  | completed |
| SPK-M-WK7    | SPK-M-003   | Mekanik  | Feb 2026  | completed |
| SPK-M-WK8    | SPK-M-004   | Mekanik  | Feb 2026  | pending   |
| SPK-M-WK12   | SPK-M-005   | Mekanik  | Mar 2026  | pending   |
| SPK-M-WK13   | SPK-M-006   | Mekanik  | Mar 2026  | pending   |
| SPK-L-WK2    | SPK-L-001   | Listrik  | Jan 2026  | completed |
| SPK-L-WK6    | SPK-L-002   | Listrik  | Feb 2026  | completed |
| SPK-L-WK8    | SPK-L-003   | Listrik  | Feb 2026  | completed |
| SPK-L-WK9    | SPK-L-004   | Listrik  | Mar 2026  | in_progress |
| SPK-S-WK10   | SPK-S-001   | Sipil    | Mar 2026  | pending   |
| SPK-O-WK11   | SPK-O-001   | Otomasi  | Mar 2026  | pending   |

---

## Seed: New Apr/May SPKs (standalone, no LK)

| Number    | Category | Month    | Status  | Description |
|-----------|----------|----------|---------|-------------|
| SPK-M-007 | Mekanik  | Apr 2026 | pending | Perawatan Rutin Pompa Intake Cidanau 1M1 — Bulanan (April) |
| SPK-L-005 | Listrik  | Apr 2026 | pending | Inspeksi Panel Katodik Cidanau I — Bulanan (April) |
| SPK-S-002 | Sipil    | May 2026 | pending | Pemeriksaan Manhole SLD Basin — 3 Bulanan (Mei) |
| SPK-O-002 | Otomasi  | May 2026 | pending | Kalibrasi Sensor AWLR — 3 Bulanan (Mei) |

These reuse the same equipment and activities as their matching Mar 2026 SPKs.

---

## Seed: Reference Updates

**LK spkModels:**
- LK-JAN-MEK: `['SPK-M-001', 'SPK-M-002']`
- LK-JAN-LIS: `['SPK-L-001']`
- LK-FEB-MEK: `['SPK-M-004', 'SPK-M-003']`
- LK-FEB-LIS: `['SPK-L-002']`
- LK-MAR-MEK: `['SPK-M-006', 'SPK-M-005']`
- LK-MAR-LIS: `['SPK-L-004', 'SPK-L-003']`
- LK-MAR-SIP: `['SPK-S-001']`
- LK-MAR-OTO: `['SPK-O-001']`

**Submission spkNumber:**
- SUB-001: `SPK-L-003`
- SUB-002: `SPK-M-001`
- SUB-003: `SPK-M-002`
- SUB-004: `SPK-L-001`
- SUB-005: `SPK-M-003`
- SUB-006: `SPK-L-002`

---

## Frontend: suggestSpkNumber() Change

**File:** `public/js/spk.js`

**Current behavior:** Finds max `SPK-\d+-(\d+)` → returns `SPK-2026-NNN`

**New behavior:**
1. Read current value of `#f_category` dropdown
2. Map category to code: `Mekanik→M`, `Listrik→L`, `Sipil→S`, `Otomasi→O`
3. Find max `SPK-{CODE}-(\d+)` among all existing SPKs for that category
4. Return `SPK-{CODE}-{NNN}` (zero-padded 3 digits, max+1)

**Trigger:** Called on form open (create mode) and on category `change` event — only when not in edit mode.

---

## Files Changed

| File | Change |
|------|--------|
| `src/preventive_seed.js` | Rename all SPK numbers, update LK/submission refs, add 4 new SPKs |
| `public/js/spk.js` | Update `suggestSpkNumber()`, add category change listener |
