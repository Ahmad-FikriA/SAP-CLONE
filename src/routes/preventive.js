'use strict';

const express = require('express');
const { verifyToken } = require('../middleware/auth');

const spkController = require('../controllers/preventive/spkController');
const lembarKerjaController = require('../controllers/preventive/lembarKerjaController');
const equipmentController = require('../controllers/preventive/equipmentController');
const mapsController = require('../controllers/preventive/mapsController');
const plantController = require('../controllers/preventive/plantController');
const submissionsController = require('../controllers/preventive/submissionsController');
const funcLocController = require('../controllers/preventive/functionalLocationController');
const taskListController = require('../controllers/preventive/generalTaskListController');
const equipmentMappingController = require('../controllers/preventive/equipmentMappingController');

// ── SPK ─────────────────────────────────────────────────────────────────────
const spkRouter = express.Router();
spkRouter.get('/', verifyToken, spkController.getAll);
spkRouter.post('/bulk-delete', verifyToken, spkController.bulkDelete);
spkRouter.post('/generate-from-task-list', verifyToken, spkController.generateFromTaskList);
spkRouter.get('/:spkNumber', verifyToken, spkController.getOne);
spkRouter.post('/', verifyToken, spkController.create);
spkRouter.put('/:spkNumber', verifyToken, spkController.update);
spkRouter.delete('/:spkNumber', verifyToken, spkController.remove);
spkRouter.post('/:spkNumber/submit', verifyToken, spkController.submit);
spkRouter.post('/:spkNumber/approve-kasie', verifyToken, spkController.approveKasie);
spkRouter.post('/:spkNumber/approve-kadis-perawatan', verifyToken, spkController.approveKadisPerawatan);
spkRouter.post('/:spkNumber/approve-kadis', verifyToken, spkController.approveKadis);
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
equipmentRouter.post('/bulk-update', verifyToken, equipmentController.bulkUpdate);
equipmentRouter.get('/:equipmentId', verifyToken, equipmentController.getOne);
equipmentRouter.post('/', verifyToken, equipmentController.create);
equipmentRouter.put('/:equipmentId', verifyToken, equipmentController.update);
equipmentRouter.delete('/:equipmentId', verifyToken, equipmentController.remove);

// ── Plants ───────────────────────────────────────────────────────────────────
const plantRouter = express.Router();
plantRouter.get('/', verifyToken, plantController.getAll);
plantRouter.post('/', verifyToken, plantController.create);
plantRouter.get('/:plantId', verifyToken, plantController.getOne);
plantRouter.put('/:plantId', verifyToken, plantController.update);
plantRouter.delete('/:plantId', verifyToken, plantController.remove);

// ── Maps ─────────────────────────────────────────────────────────────────────
const mapsRouter = express.Router();
mapsRouter.get('/', verifyToken, mapsController.getAll);
mapsRouter.get('/:plantId', verifyToken, mapsController.getOne);
mapsRouter.put('/:plantId', verifyToken, mapsController.save);

// ── Submissions ───────────────────────────────────────────────────────────────
const submissionsRouter = express.Router();
submissionsRouter.get('/', verifyToken, submissionsController.getAll);
submissionsRouter.get('/export', verifyToken, submissionsController.exportExcel);
submissionsRouter.post('/bulk-delete', verifyToken, submissionsController.bulkDelete);
submissionsRouter.get('/:id', verifyToken, submissionsController.getOne);
submissionsRouter.delete('/:id', verifyToken, submissionsController.remove);

// ── Functional Locations ─────────────────────────────────────────────────────
const funcLocRouter = express.Router();
funcLocRouter.get('/', verifyToken, funcLocController.getAll);
funcLocRouter.get('/:funcLocId', verifyToken, funcLocController.getOne);

// ── General Task Lists ───────────────────────────────────────────────────────
const taskListRouter = express.Router();
taskListRouter.get('/',                 verifyToken, taskListController.getAll);
taskListRouter.post('/',                verifyToken, taskListController.create);
taskListRouter.get('/:taskListId',      verifyToken, taskListController.getOne);
taskListRouter.put('/:taskListId',      verifyToken, taskListController.update);
taskListRouter.delete('/:taskListId',   verifyToken, taskListController.remove);

// Equipment Interval Mappings
const mappingRouter = express.Router();
mappingRouter.get('/',       verifyToken, equipmentMappingController.getAll);
mappingRouter.post('/bulk',  verifyToken, equipmentMappingController.bulkCreate);
mappingRouter.post('/',      verifyToken, equipmentMappingController.create);
mappingRouter.delete('/:id', verifyToken, equipmentMappingController.remove);

module.exports = { spkRouter, lkRouter, equipmentRouter, mapsRouter, submissionsRouter, funcLocRouter, taskListRouter, plantRouter, mappingRouter };
