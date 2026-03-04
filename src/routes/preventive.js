'use strict';

const express = require('express');
const { verifyToken } = require('../middleware/auth');

const spkController = require('../controllers/preventive/spkController');
const lembarKerjaController = require('../controllers/preventive/lembarKerjaController');
const equipmentController = require('../controllers/preventive/equipmentController');
const mapsController = require('../controllers/preventive/mapsController');
const submissionsController = require('../controllers/preventive/submissionsController');

// ── SPK ─────────────────────────────────────────────────────────────────────
const spkRouter = express.Router();
spkRouter.get('/', verifyToken, spkController.getAll);
spkRouter.post('/bulk-delete', verifyToken, spkController.bulkDelete);
spkRouter.get('/:spkNumber', verifyToken, spkController.getOne);
spkRouter.post('/', verifyToken, spkController.create);
spkRouter.put('/:spkNumber', verifyToken, spkController.update);
spkRouter.delete('/:spkNumber', verifyToken, spkController.remove);
spkRouter.post('/:spkNumber/submit', verifyToken, spkController.submit);
spkRouter.post('/:spkNumber/sync', verifyToken, spkController.sync);

// ── Lembar Kerja ─────────────────────────────────────────────────────────────
const lkRouter = express.Router();
lkRouter.get('/', verifyToken, lembarKerjaController.getAll);
lkRouter.post('/bulk-delete', verifyToken, lembarKerjaController.bulkDelete);
lkRouter.get('/:lkNumber', verifyToken, lembarKerjaController.getOne);
lkRouter.post('/', verifyToken, lembarKerjaController.create);
lkRouter.put('/:lkNumber', verifyToken, lembarKerjaController.update);
lkRouter.delete('/:lkNumber', verifyToken, lembarKerjaController.remove);
lkRouter.post('/:lkNumber/submit', verifyToken, lembarKerjaController.submit);
lkRouter.post('/:lkNumber/approve', verifyToken, lembarKerjaController.approve);
lkRouter.post('/:lkNumber/reject', verifyToken, lembarKerjaController.reject);

// ── Equipment ────────────────────────────────────────────────────────────────
const equipmentRouter = express.Router();
equipmentRouter.get('/', verifyToken, equipmentController.getAll);
equipmentRouter.post('/bulk-delete', verifyToken, equipmentController.bulkDelete);
equipmentRouter.post('/', verifyToken, equipmentController.create);
equipmentRouter.put('/:equipmentId', verifyToken, equipmentController.update);
equipmentRouter.delete('/:equipmentId', verifyToken, equipmentController.remove);

// ── Maps ─────────────────────────────────────────────────────────────────────
const mapsRouter = express.Router();
mapsRouter.get('/', verifyToken, mapsController.getAll);
mapsRouter.get('/:plantId', verifyToken, mapsController.getOne);

// ── Submissions ───────────────────────────────────────────────────────────────
const submissionsRouter = express.Router();
submissionsRouter.get('/', verifyToken, submissionsController.getAll);
submissionsRouter.post('/bulk-delete', verifyToken, submissionsController.bulkDelete);
submissionsRouter.get('/:id', verifyToken, submissionsController.getOne);
submissionsRouter.delete('/:id', verifyToken, submissionsController.remove);

module.exports = { spkRouter, lkRouter, equipmentRouter, mapsRouter, submissionsRouter };
