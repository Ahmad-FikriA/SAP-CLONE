'use strict';

const FunctionalLocation = require('../../models/FunctionalLocation');


exports.getAll = async (req, res, next) => {
    try {
        const where = {};
        if (req.query.parentId !== undefined) {
            where.parentId = req.query.parentId || null;
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
