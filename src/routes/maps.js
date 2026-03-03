'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { readJSON } = require('../services/fileStore');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const MAPS_DIR = path.join(__dirname, '..', '..', 'data', 'maps');

// GET /api/maps — list available plants with map info
router.get('/', verifyToken, (req, res) => {
    const plants = readJSON('plants.json');
    // Annotate with hasMap flag
    const result = plants.map(p => ({
        ...p,
        hasMap: fs.existsSync(path.join(MAPS_DIR, `${p.plantId}.geojson`))
    }));
    res.json(result);
});

// GET /api/maps/:plantId — serve GeoJSON for a specific plant
router.get('/:plantId', verifyToken, (req, res) => {
    const { plantId } = req.params;
    const geojsonPath = path.join(MAPS_DIR, `${plantId}.geojson`);

    if (!fs.existsSync(geojsonPath)) {
        return res.status(404).json({ error: `No map data for plant "${plantId}"` });
    }

    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    res.json(geojson);
});

module.exports = router;
