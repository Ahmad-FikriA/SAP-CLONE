'use strict';

const sequelize = require('../../config/database');
const { GeneralTaskList, GeneralTaskListActivity } = require('../../models/GeneralTaskList');

/**
 * GET /api/task-lists
 * Query params: ?category=Mekanik  (optional)
 */
exports.getAll = async (req, res, next) => {
    try {
        const where = {};
        if (req.query.category) where.category = req.query.category;

        const rows = await GeneralTaskList.findAll({
            where,
            include: [{ model: GeneralTaskListActivity, as: 'activities', order: [['stepNumber', 'ASC']] }],
            order: [['taskListId', 'ASC']],
        });
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * GET /api/task-lists/:taskListId
 */
exports.getOne = async (req, res, next) => {
    try {
        const row = await GeneralTaskList.findByPk(req.params.taskListId, {
            include: [{ model: GeneralTaskListActivity, as: 'activities', order: [['stepNumber', 'ASC']] }],
        });
        if (!row) return res.status(404).json({ error: 'Task list not found' });
        res.json(row);
    } catch (err) { next(err); }
};

/**
 * POST /api/task-lists
 * Body: { taskListId, taskListName, category, workCenter?, activities: [{stepNumber, operationText}] }
 */
exports.create = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const { taskListId, taskListName, category, workCenter, activities = [] } = req.body;
        if (!taskListId || !taskListName || !category) {
            await t.rollback();
            return res.status(400).json({ error: 'taskListId, taskListName, dan category wajib diisi' });
        }
        const existing = await GeneralTaskList.findByPk(taskListId);
        if (existing) {
            await t.rollback();
            return res.status(409).json({ error: `Task list dengan ID '${taskListId}' sudah ada` });
        }
        await GeneralTaskList.create({ taskListId, taskListName, category, workCenter }, { transaction: t });
        if (activities.length) {
            await GeneralTaskListActivity.bulkCreate(
                activities.map((a, i) => ({
                    taskListId,
                    stepNumber: a.stepNumber != null ? a.stepNumber : (i + 1),
                    operationText: a.operationText,
                    measurementType: a.measurementType || null,
                    measurementUnit: a.measurementUnit || null,
                })),
                { transaction: t }
            );
        }
        await t.commit();
        const fresh = await GeneralTaskList.findByPk(taskListId, {
            include: [{ model: GeneralTaskListActivity, as: 'activities', order: [['stepNumber', 'ASC']] }],
        });
        res.status(201).json(fresh);
    } catch (err) { await t.rollback(); next(err); }
};

/**
 * PUT /api/task-lists/:taskListId
 * Body: { taskListName?, category?, workCenter?, activities? }
 * Replaces all activities if activities array is provided.
 */
exports.update = async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
        const tl = await GeneralTaskList.findByPk(req.params.taskListId);
        if (!tl) { await t.rollback(); return res.status(404).json({ error: 'Task list not found' }); }

        const { taskListName, category, workCenter, activities } = req.body;
        const updatePayload = {};
        if (taskListName !== undefined) updatePayload.taskListName = taskListName;
        if (category !== undefined) updatePayload.category = category;
        if (workCenter !== undefined) updatePayload.workCenter = workCenter;
        await tl.update(updatePayload, { transaction: t });

        if (Array.isArray(activities)) {
            await GeneralTaskListActivity.destroy({ where: { taskListId: tl.taskListId }, transaction: t });
            if (activities.length) {
                await GeneralTaskListActivity.bulkCreate(
                    activities.map((a, i) => ({
                        taskListId: tl.taskListId,
                        stepNumber: a.stepNumber != null ? a.stepNumber : (i + 1),
                        operationText: a.operationText,
                        measurementType: a.measurementType || null,
                        measurementUnit: a.measurementUnit || null,
                    })),
                    { transaction: t }
                );
            }
        }
        await t.commit();
        const fresh = await GeneralTaskList.findByPk(tl.taskListId, {
            include: [{ model: GeneralTaskListActivity, as: 'activities', order: [['stepNumber', 'ASC']] }],
        });
        res.json(fresh);
    } catch (err) { await t.rollback(); next(err); }
};

/**
 * DELETE /api/task-lists/:taskListId
 */
exports.remove = async (req, res, next) => {
    try {
        const count = await GeneralTaskList.destroy({ where: { taskListId: req.params.taskListId } });
        if (!count) return res.status(404).json({ error: 'Task list not found' });
        res.json({ message: 'Deleted' });
    } catch (err) { next(err); }
};

/**
 * POST /api/task-lists/import-excel
 * Accepts multipart/form-data field "file" (.xlsx or .csv).
 *
 * Supports three formats from SAP export:
 *
 * Format A — single sheet, flat rows (one row per activity):
 *   task_list_id | task_list_name | category | work_center | step_number | operation_text
 *
 * Format B — multi-sheet SAP block format (Functional Location.xlsx):
 *   Sheet names: "G.Task List M", "G. Task List E", "G. Task List S", "G. Task List O"
 *   Each sheet has blocks separated by blank rows:
 *     Row: "KTI_0001 PREV POMPA (with Grease Pump)"  ← taskListId + taskListName
 *     Row: "PREV POMPA (with Grease Pump)"  |  "M1-N01"   ← name again + workCenter
 *     Row: "1) Cek pompa ..."                         ← activity (strip leading "N) ")
 *     Row: ""                                         ← blank = end of block
 *
 * Format C — SAP CSV export ("General task list.csv"):
 *   Header: Type, Group, Grc, Description, Plant, PlGroup, Workctr
 *   Task list row: Type=A, Group=KTI_XXXX, Description=name, PlGroup=221/222, Workctr=M1-N01
 *   Activity row:  Type=empty, only Description filled (numbered "1) ...")
 *   Blank row between task lists
 *
 * Behavior: upsert — safe to re-import. Existing activities are replaced.
 */
exports.importExcel = async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded. Send field "file" as multipart/form-data.' });

    let XLSX;
    try { XLSX = require('xlsx'); } catch { return res.status(500).json({ error: 'xlsx package not installed' }); }

    const filename = (req.file.originalname || '').toLowerCase();
    const isCsv   = filename.endsWith('.csv');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', raw: false });

    // Detect format by sheet names
    const SAP_SHEET_MAP = {
        'G.Task List M':   'Mekanik',
        'G. Task List M':  'Mekanik',
        'G.Task List E':   'Listrik',
        'G. Task List E':  'Listrik',
        'G.Task List S':   'Sipil',
        'G. Task List S':  'Sipil',
        'G.Task List O':   'Otomasi',
        'G. Task List O':  'Otomasi',
    };

    const sapSheets = workbook.SheetNames.filter(n => SAP_SHEET_MAP[n]);
    const parsed = [];

    // ── PG code → category ───────────────────────────────────────────────────
    const PG_CAT = { '221': 'Mekanik', '222': 'Listrik', '223': 'Sipil', '224': 'Otomasi' };

    if (isCsv) {
        // ── Format C: SAP CSV export ─────────────────────────────────────────
        // Columns: Type, Group, Grc, Description, Plant, PlGroup, Workctr
        // Skip rows until the real header (contains "Group" or "Type" in first cell)
        const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', header: 1 });

        let headerIdx = -1;
        for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
            const cells = rawRows[i].map(c => String(c).trim().toLowerCase());
            if (cells.includes('group') || cells.includes('type')) { headerIdx = i; break; }
        }
        if (headerIdx === -1) return res.status(400).json({ error: 'CSV header not found. Expected columns: Type, Group, Description, PlGroup, Workctr' });

        const headers = rawRows[headerIdx].map(c => String(c).trim().toLowerCase());
        const col = {
            type:    headers.indexOf('type'),
            group:   headers.indexOf('group'),
            desc:    headers.indexOf('description'),
            plgroup: headers.indexOf('plgroup'),
            wc:      headers.indexOf('workctr'),
        };

        let current = null;
        for (let i = headerIdx + 1; i < rawRows.length; i++) {
            const row  = rawRows[i];
            const type = String(row[col.type] || '').trim().toUpperCase();
            const grp  = String(row[col.group] || '').trim();
            const desc = String(row[col.desc]  || '').trim();

            if (!desc && !grp) {
                // blank row — flush
                if (current) { parsed.push(current); current = null; }
                continue;
            }

            if (type === 'A' && grp) {
                // task list header row
                if (current) parsed.push(current);
                const plg = String(row[col.plgroup] || '').trim();
                const wc  = col.wc >= 0 ? String(row[col.wc] || '').trim() : null;
                current = {
                    taskListId:   grp,
                    taskListName: desc,
                    category:     PG_CAT[plg] || null,
                    workCenter:   wc || null,
                    activities:   [],
                };
                continue;
            }

            if (current && desc && !grp) {
                // activity row — strip leading "N) "
                const opText = desc.replace(/^\d+\)\s*/, '').trim();
                if (opText) {
                    current.activities.push({ stepNumber: current.activities.length + 1, operationText: opText });
                }
            }
        }
        if (current) parsed.push(current);

    } else if (sapSheets.length > 0) {
        // ── Format B: SAP block format ───────────────────────────────────────
        for (const sheetName of sapSheets) {
            const category = SAP_SHEET_MAP[sheetName];
            const ws = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

            let current = null;
            for (const row of rows) {
                const col0 = String(row[0] || '').trim();
                const col1 = String(row[1] || '').trim();

                if (!col0) {
                    // blank row — flush current block
                    if (current) { parsed.push(current); current = null; }
                    continue;
                }

                // New task list block: first column starts with KTI_ pattern
                if (/^KTI_\d+/.test(col0)) {
                    if (current) parsed.push(current);
                    const spaceIdx = col0.indexOf(' ');
                    const taskListId   = spaceIdx > -1 ? col0.slice(0, spaceIdx) : col0;
                    const taskListName = spaceIdx > -1 ? col0.slice(spaceIdx + 1).trim() : col0;
                    current = { taskListId, taskListName, category, workCenter: null, activities: [] };
                    continue;
                }

                if (!current) continue;

                // Second row of block: repeated name + workCenter
                if (current.activities.length === 0 && !current.workCenter && col1) {
                    current.workCenter = col1 || null;
                    continue;
                }

                // Activity row: strip leading "N) " numbering
                const opText = col0.replace(/^\d+\)\s*/, '').trim();
                if (opText) {
                    current.activities.push({ stepNumber: current.activities.length + 1, operationText: opText });
                }
            }
            if (current) parsed.push(current);
        }
    } else {
        // ── Format A: flat rows ──────────────────────────────────────────────
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) return res.status(400).json({ error: 'Sheet is empty' });

        function norm(s) { return String(s || '').toLowerCase().replace(/[\s_\-]/g, ''); }
        const sample = rows[0];
        const map = {};
        for (const k of Object.keys(sample)) {
            const n = norm(k);
            if (['tasklistid', 'tasklist', 'id'].includes(n))             map.taskListId   = k;
            if (['tasklistname', 'name', 'description'].includes(n))      map.taskListName = k;
            if (['category', 'cat', 'kategori'].includes(n))              map.category     = k;
            if (['workcenter', 'workctr', 'wc'].includes(n))              map.workCenter   = k;
            if (['stepnumber', 'step', 'no'].includes(n))                 map.stepNumber   = k;
            if (['operationtext', 'operation', 'activity', 'text'].includes(n)) map.opText = k;
        }
        if (!map.taskListId || !map.taskListName || !map.opText) {
            return res.status(400).json({
                error: 'Required columns not found: task_list_id, task_list_name, operation_text',
                foundColumns: Object.keys(sample),
            });
        }

        const VALID_CATS = { mekanik: 'Mekanik', mechanical: 'Mekanik', listrik: 'Listrik', electrical: 'Listrik', sipil: 'Sipil', civil: 'Sipil', otomasi: 'Otomasi', automation: 'Otomasi' };
        const grouped = {};
        for (const row of rows) {
            const id = String(row[map.taskListId] || '').trim();
            if (!id) continue;
            if (!grouped[id]) {
                const rawCat = map.category ? String(row[map.category] || '').toLowerCase().trim() : '';
                grouped[id] = {
                    taskListId:   id,
                    taskListName: String(row[map.taskListName] || '').trim(),
                    category:     VALID_CATS[rawCat] || null,
                    workCenter:   map.workCenter ? (String(row[map.workCenter] || '').trim() || null) : null,
                    activities:   [],
                };
            }
            const opText = String(row[map.opText] || '').trim();
            if (opText) {
                const step = map.stepNumber ? (parseInt(row[map.stepNumber], 10) || grouped[id].activities.length + 1) : grouped[id].activities.length + 1;
                grouped[id].activities.push({ stepNumber: step, operationText: opText });
            }
        }
        parsed.push(...Object.values(grouped));
    }

    if (!parsed.length) return res.status(400).json({ error: 'No task lists found in file' });

    // ── Upsert all parsed task lists ─────────────────────────────────────────
    let imported = 0, skipped = 0;
    const errors = [];

    for (const tl of parsed) {
        if (!tl.taskListId || !tl.taskListName || !tl.category) {
            errors.push(`Skipped: ${tl.taskListId || '?'} — missing taskListName or category`);
            skipped++;
            continue;
        }
        const t = await sequelize.transaction();
        try {
            await GeneralTaskList.upsert(
                { taskListId: tl.taskListId, taskListName: tl.taskListName, category: tl.category, workCenter: tl.workCenter || null },
                { transaction: t }
            );
            await GeneralTaskListActivity.destroy({ where: { taskListId: tl.taskListId }, transaction: t });
            if (tl.activities.length) {
                await GeneralTaskListActivity.bulkCreate(
                    tl.activities.map(a => ({ taskListId: tl.taskListId, stepNumber: a.stepNumber, operationText: a.operationText })),
                    { transaction: t }
                );
            }
            await t.commit();
            imported++;
        } catch (err) {
            await t.rollback();
            errors.push(`${tl.taskListId}: ${err.message}`);
            skipped++;
        }
    }

    res.json({
        message: `Import selesai: ${imported} task list diproses, ${skipped} dilewati`,
        imported,
        skipped,
        errors: errors.slice(0, 20),
    });
};
