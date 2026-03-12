'use strict';

const path = require('path');
const fs   = require('fs');
const Plant = require('../../models/Plant');

const MAPS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'maps');

// GET /api/maps
const getAll = async (req, res) => {
  const plants = await Plant.findAll();
  const result = plants.map(p => ({
    ...p.toJSON(),
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
  res.json(JSON.parse(fs.readFileSync(geojsonPath, 'utf8')));
};

// PUT /api/maps/:plantId
const save = (req, res) => {
  const { plantId } = req.params;
  const geojson = req.body;
  if (!geojson || geojson.type !== 'FeatureCollection') {
    return res.status(400).json({ error: 'Expected GeoJSON FeatureCollection' });
  }
  if (!fs.existsSync(MAPS_DIR)) {
    fs.mkdirSync(MAPS_DIR, { recursive: true });
  }
  const geojsonPath = path.join(MAPS_DIR, `${plantId}.geojson`);
  fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), 'utf8');
  res.json({ message: 'Map saved', plantId });
};

module.exports = { getAll, getOne, save };
