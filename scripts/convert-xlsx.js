'use strict';

/**
 * One-time script: Convert "Functional Location.xlsx" → JSON seed files.
 *
 * Outputs:
 *   data/functional_locations.json
 *   data/sap_equipment.json
 *   data/general_task_lists.json
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const XLSX_PATH = path.join(ROOT, 'Functional Location.xlsx');
const DATA_DIR = path.join(ROOT, 'data');

const wb = XLSX.readFile(XLSX_PATH);

// ─────────────────────────────────────────────────────────────────────────────
// 1) Functional Locations
// ─────────────────────────────────────────────────────────────────────────────
(() => {
    const ws = wb.Sheets['FuncLoc'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: ['funcLocId', 'description'] });

    // Skip the header row
    const data = rows.slice(1)
        .filter(r => r.funcLocId != null && r.funcLocId !== '')
        .map(r => {
            const id = String(r.funcLocId).trim();
            const parts = id.split('-');
            const level = parts.length - 1;          // A=0, A-A1=1, A-A1-01=2, ...
            const parentId = level > 0 ? parts.slice(0, -1).join('-') : null;
            return {
                funcLocId: id,
                description: String(r.description || '').trim(),
                parentId,
                level,
            };
        });

    fs.writeFileSync(
        path.join(DATA_DIR, 'functional_locations.json'),
        JSON.stringify(data, null, 2),
    );
    console.log(`  ✓  functional_locations.json  (${data.length} rows)`);
})();

// ─────────────────────────────────────────────────────────────────────────────
// 2) SAP Equipment
// ─────────────────────────────────────────────────────────────────────────────
(() => {
    const ws = wb.Sheets['Equipment'];
    const rows = XLSX.utils.sheet_to_json(ws, {
        header: ['equipmentNumber', 'description', 'validTo', 'planningPlant'],
    });

    const data = rows.slice(1)
        .filter(r => r.equipmentNumber != null)
        .map(r => ({
            equipmentNumber: String(r.equipmentNumber).trim(),
            description: String(r.description || '').trim(),
            planningPlant: String(r.planningPlant || '').trim() || 'KTI1',
        }));

    fs.writeFileSync(
        path.join(DATA_DIR, 'sap_equipment.json'),
        JSON.stringify(data, null, 2),
    );
    console.log(`  ✓  sap_equipment.json         (${data.length} rows)`);
})();

// ─────────────────────────────────────────────────────────────────────────────
// 3) General Task Lists (M, E, S, O)
// ─────────────────────────────────────────────────────────────────────────────
(() => {
    const CATEGORY_MAP = {
        'G.Task List M': 'Mekanik',
        'G. Task List E': 'Listrik',
        'G. Task List S': 'Sipil',
        'G. Task List O': 'Otomasi',
    };

    const allTaskLists = [];

    for (const [sheetName, category] of Object.entries(CATEGORY_MAP)) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;

        const rows = XLSX.utils.sheet_to_json(ws, { header: ['col1', 'col2'], defval: null });

        // Parse the taskList groups.
        // Pattern: row with KTI_XXXX header → next row = name + workCenter → subsequent rows = activities (until blank)
        let current = null;

        for (const row of rows) {
            const c1 = row.col1 ? String(row.col1).trim() : '';
            const c2 = row.col2 ? String(row.col2).trim() : '';

            // Detect task list header: starts with "KTI_" or " KTI_"
            const headerMatch = c1.match(/^\s*(KTI_\d+)\s+(.+)/);
            if (headerMatch) {
                // Save previous if any
                if (current) allTaskLists.push(current);

                current = {
                    taskListId: headerMatch[1],
                    taskListName: headerMatch[2].trim(),
                    category,
                    workCenter: c2 === 'Work Center' ? null : (c2 || null),
                    activities: [],
                };
                continue;
            }

            // Detect workCenter line (right after header)
            if (current && current.activities.length === 0 && c2 && c2 !== 'Work Center' && !c1.match(/^\d+\)/)) {
                current.workCenter = c2;
                // c1 might be a repeated name — skip
                continue;
            }

            // Detect activity line: starts with digit + ")"
            const actMatch = c1.match(/^(\d+)\)\s*(.+)/);
            if (actMatch && current) {
                current.activities.push({
                    stepNumber: parseInt(actMatch[1], 10),
                    operationText: actMatch[2].trim(),
                });
                continue;
            }

            // Blank line — skip
        }
        if (current) allTaskLists.push(current);
    }

    fs.writeFileSync(
        path.join(DATA_DIR, 'general_task_lists.json'),
        JSON.stringify(allTaskLists, null, 2),
    );
    console.log(`  ✓  general_task_lists.json    (${allTaskLists.length} task lists)`);
})();

console.log('\n  Done! JSON files written to data/\n');
