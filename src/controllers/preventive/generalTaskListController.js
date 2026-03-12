'use strict';

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
