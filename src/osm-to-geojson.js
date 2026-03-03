#!/usr/bin/env node
'use strict';

/**
 * OSM → GeoJSON Converter
 *
 * Reads .osm XML files from data/maps/ and writes matching .geojson files.
 * Extracts:
 *   - Ways (buildings, areas, landuse) → Polygon features
 *   - Named nodes (POIs) → Point features
 *
 * Usage:  node src/osm-to-geojson.js [plantId]
 *         If plantId is omitted, converts ALL .osm files in data/maps/
 */

const fs = require('fs');
const path = require('path');

const MAPS_DIR = path.join(__dirname, '..', 'data', 'maps');

// ── Minimal XML parser (no dependencies) ────────────────────────────────────

function parseOSM(xml) {
    const nodes = {};
    const ways = [];
    const bounds = {};

    // Parse bounds
    const boundsMatch = xml.match(/<bounds\s+([^>]+)\/>/);
    if (boundsMatch) {
        const attrs = parseAttrs(boundsMatch[1]);
        bounds.minlat = +attrs.minlat;
        bounds.minlon = +attrs.minlon;
        bounds.maxlat = +attrs.maxlat;
        bounds.maxlon = +attrs.maxlon;
    }

    // Parse nodes
    const nodeRegex = /<node\s+([^>]*?)(\/?>)/g;
    let m;
    while ((m = nodeRegex.exec(xml)) !== null) {
        const attrs = parseAttrs(m[1]);
        const id = attrs.id;
        const lat = +attrs.lat;
        const lon = +attrs.lon;
        nodes[id] = { lat, lon, tags: {} };

        // If the node is NOT self-closing, parse inner tags
        if (m[2] === '>') {
            const closeIdx = xml.indexOf('</node>', m.index);
            if (closeIdx !== -1) {
                const inner = xml.substring(m.index, closeIdx);
                parseTags(inner, nodes[id].tags);
            }
        }
    }

    // Parse ways
    const wayRegex = /<way\s+([^>]*?)>([\s\S]*?)<\/way>/g;
    while ((m = wayRegex.exec(xml)) !== null) {
        const attrs = parseAttrs(m[1]);
        const inner = m[2];
        const way = { id: attrs.id, nodeRefs: [], tags: {} };

        const ndRegex = /<nd\s+ref="(\d+)"\s*\/>/g;
        let nd;
        while ((nd = ndRegex.exec(inner)) !== null) {
            way.nodeRefs.push(nd[1]);
        }
        parseTags(inner, way.tags);
        ways.push(way);
    }

    return { nodes, ways, bounds };
}

function parseAttrs(str) {
    const attrs = {};
    const re = /(\w+)="([^"]*)"/g;
    let m;
    while ((m = re.exec(str)) !== null) attrs[m[1]] = m[2];
    return attrs;
}

function parseTags(xml, tagObj) {
    const tagRegex = /<tag\s+k="([^"]*)"\s+v="([^"]*)"\s*\/>/g;
    let t;
    while ((t = tagRegex.exec(xml)) !== null) {
        tagObj[t[1]] = t[2];
    }
}

// ── Convert to GeoJSON ──────────────────────────────────────────────────────

function toGeoJSON(osmData) {
    const features = [];

    // Ways → Polygons / LineStrings
    for (const way of osmData.ways) {
        const coords = way.nodeRefs
            .map(ref => osmData.nodes[ref])
            .filter(Boolean)
            .map(n => [n.lon, n.lat]);

        if (coords.length < 2) continue;

        const isClosed = way.nodeRefs[0] === way.nodeRefs[way.nodeRefs.length - 1] && coords.length >= 4;
        const tags = way.tags;

        // Determine feature type label
        let featureType = 'area';
        if (tags.building) featureType = 'building';
        else if (tags.landuse) featureType = tags.landuse;
        else if (tags.natural) featureType = tags.natural;
        else if (tags.waterway) featureType = tags.waterway;
        else if (tags.highway) featureType = 'road';
        else if (tags.railway) featureType = 'railway';
        else if (tags.man_made) featureType = tags.man_made;
        else if (tags.amenity) featureType = tags.amenity;
        else if (tags.industrial) featureType = 'industrial';

        features.push({
            type: 'Feature',
            properties: {
                id: way.id,
                name: tags.name || null,
                featureType,
                ...tags
            },
            geometry: isClosed
                ? { type: 'Polygon', coordinates: [coords] }
                : { type: 'LineString', coordinates: coords }
        });
    }

    // Named nodes → Points (POIs only)
    for (const [id, node] of Object.entries(osmData.nodes)) {
        if (Object.keys(node.tags).length === 0) continue;
        // Skip nodes that are just structural (part of ways) with no meaningful tags
        if (!node.tags.name && !node.tags.amenity && !node.tags.shop && !node.tags.man_made) continue;

        features.push({
            type: 'Feature',
            properties: {
                id,
                name: node.tags.name || null,
                ...node.tags
            },
            geometry: {
                type: 'Point',
                coordinates: [node.lon, node.lat]
            }
        });
    }

    return {
        type: 'FeatureCollection',
        bbox: osmData.bounds.minlon
            ? [osmData.bounds.minlon, osmData.bounds.minlat, osmData.bounds.maxlon, osmData.bounds.maxlat]
            : undefined,
        features
    };
}

// ── Main ────────────────────────────────────────────────────────────────────

function convertFile(osmPath) {
    const xml = fs.readFileSync(osmPath, 'utf8');
    const osmData = parseOSM(xml);
    const geojson = toGeoJSON(osmData);

    const outPath = osmPath.replace(/\.osm$/, '.geojson');
    fs.writeFileSync(outPath, JSON.stringify(geojson, null, 2), 'utf8');

    const basename = path.basename(osmPath);
    console.log(`  ✓ ${basename} → ${path.basename(outPath)}  (${geojson.features.length} features)`);
    return geojson;
}

function main() {
    const targetId = process.argv[2]; // optional: convert only one file

    console.log('\n  OSM → GeoJSON Converter');
    console.log('  ─────────────────────────');

    if (targetId) {
        const filePath = path.join(MAPS_DIR, `${targetId}.osm`);
        if (!fs.existsSync(filePath)) {
            console.error(`  ✕ File not found: ${filePath}`);
            process.exit(1);
        }
        convertFile(filePath);
    } else {
        const files = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.osm'));
        if (!files.length) {
            console.log('  No .osm files found in data/maps/');
            return;
        }
        for (const file of files) {
            convertFile(path.join(MAPS_DIR, file));
        }
    }

    console.log('  Done.\n');
}

main();
