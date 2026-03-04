'use strict';

const path = require('path');
const fs = require('fs');
const { readJSON } = require('../../services/fileStore');

const MAPS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'maps');

// GET /api/maps
const getAll = (req, res) => {
  const plants = readJSON('plants.json');
  const result = plants.map(p => ({
    ...p,
    hasMap: fs.existsSync(path.join(MAPS_DIR, `${p.plantId}.geojson`)),
  }));
  res.json(result);
};

// GET /api/maps/:plantId
const getOne = (req, res) => {
  const { plantId } = req.params;
  const geojsonPath = path.join(MAPS_DIR, `${plantId}.geojson`);

  if (!fs.existsSync(geojsonPath)) {
    return res.status(404).json({ error: `No map data for plant "${plantId}"` });
  }

  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  res.json(geojson);
};

module.exports = { getAll, getOne };
