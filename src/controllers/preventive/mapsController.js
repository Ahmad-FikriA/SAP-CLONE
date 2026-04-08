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

// Compute centroid of a GeoJSON polygon outer ring [[lon, lat], ...]
function computeCentroid(coords) {
  let sumLat = 0, sumLon = 0;
  const n = coords.length;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  return { lat: sumLat / n, lon: sumLon / n };
}

// PUT /api/maps/:plantId
const save = async (req, res) => {
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

  // Auto-update Plant.centerLat/centerLon from the first polygon's centroid.
  // This gives Flutter a fallback point even before it parses the full polygon.
  try {
    const firstPolygon = geojson.features.find(f => f.geometry?.type === 'Polygon');
    if (firstPolygon) {
      const ring = firstPolygon.geometry.coordinates[0]; // outer ring
      const { lat, lon } = computeCentroid(ring);
      await Plant.update({ centerLat: lat, centerLon: lon }, { where: { plantId } });
    }
  } catch (_) {
    // Non-fatal — centroid update is best-effort
  }

  res.json({ message: 'Map saved', plantId });
};

module.exports = { getAll, getOne, save };
