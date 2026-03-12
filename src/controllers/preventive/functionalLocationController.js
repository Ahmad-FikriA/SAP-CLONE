'use strict';

const FunctionalLocation = require('../../models/FunctionalLocation');

/**
 * GET /api/functional-locations
 * Query params: ?parentId=A-A1  (optional, filters by parent)
 *               ?level=0        (optional, filters by depth level)
 */
exports.getAll = async (req, res, next) => {
    try {
        const where = {};
        if (req.query.parentId !== undefined) {
            where.parentId = req.query.parentId || null;   // parentId='' → root nodes
        }
        if (req.query.level !== undefined) {
            where.level = parseInt(req.query.level, 10);
        }

        const rows = await FunctionalLocation.findAll({
            where,
            include: [{ model: FunctionalLocation, as: 'children', attributes: ['funcLocId', 'description'] }],
            order: [['funcLocId', 'ASC']],
        });
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * GET /api/functional-locations/:funcLocId
 */
exports.getOne = async (req, res, next) => {
    try {
        const row = await FunctionalLocation.findByPk(req.params.funcLocId, {
            include: [
                { model: FunctionalLocation, as: 'children', attributes: ['funcLocId', 'description', 'level'] },
                { model: FunctionalLocation, as: 'parent', attributes: ['funcLocId', 'description'] },
            ],
        });
        if (!row) return res.status(404).json({ error: 'Functional location not found' });
        res.json(row);
    } catch (err) { next(err); }
};
