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
