/* ─── Maps Editor ─── */
/* All user-supplied strings rendered via innerHTML use escHtml() which HTML-encodes
   &, <, >, " — consistent with the existing equipment.js / spk.js pattern. */

let map = null;
let plants = [];
let currentPlantId = null;
let osmFeatures = [];    // original non-custom features, round-tripped on save
let baseLayer = null;    // read-only OSM overlay (L.layerGroup)
let drawnItems = null;   // editable custom polygons (L.FeatureGroup)
let drawControl = null;
let editingLayer = null; // layer whose properties are open in panel

const FEATURE_TYPES = ['building', 'industrial', 'road', 'railway', 'water', 'reservoir'];

const GEOJSON_STYLES = {
  building:   { color: '#5D6D7E', weight: 1.5, fillColor: '#AEB6BF', fillOpacity: 0.45 },
  industrial: { color: '#7D3C98', weight: 1.5, fillColor: '#D2B4DE', fillOpacity: 0.30 },
  road:       { color: '#5D6D7E', weight: 2,   fillColor: '#5D6D7E', fillOpacity: 0 },
  railway:    { color: '#2C3E50', weight: 2,   dashArray: '6 4',    fillColor: '#2C3E50', fillOpacity: 0 },
  water:      { color: '#2980B9', weight: 1.5, fillColor: '#85C1E9', fillOpacity: 0.50 },
  reservoir:  { color: '#2980B9', weight: 1.5, fillColor: '#85C1E9', fillOpacity: 0.50 },
  default:    { color: '#7F8C8D', weight: 1.5, fillColor: '#BDC3C7', fillOpacity: 0.35 },
};

function styleForType(featureType) {
  return GEOJSON_STYLES[featureType] || GEOJSON_STYLES.default;
}

// ── Map Init ──────────────────────────────────────────────────────────────────

async function initMap() {
  map = L.map('mapsMap', { zoomControl: true, attributionControl: true });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 22,
  }).addTo(map);

  baseLayer = L.layerGroup().addTo(map);
  drawnItems = new L.FeatureGroup().addTo(map);

  drawControl = new L.Control.Draw({
    position: 'topleft',
    edit: {
      featureGroup: drawnItems,
      remove: true,
    },
    draw: {
      polygon: {
        allowIntersection: false,
        showArea: true,
        shapeOptions: Object.assign({}, GEOJSON_STYLES.default),
        snapDistance: 15,
      },
      rectangle: {
        shapeOptions: Object.assign({}, GEOJSON_STYLES.default),
      },
      polyline: false,
      circle: false,
      circlemarker: false,
      marker: false,
    },
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, function(e) {
    var layer = e.layer;
    if (!layer.feature) {
      layer.feature = { type: 'Feature', properties: { source: 'custom' } };
    }
    layer.feature.properties.source = 'custom';
    drawnItems.addLayer(layer);
    attachLayerClick(layer);
    openPropsPanel(layer);
    updateFeatureCount();
  });

  map.on(L.Draw.Event.DELETED, function() { updateFeatureCount(); });

  try {
    plants = await apiGet('/maps');
    renderPlantSelector();
    if (plants.length > 0) {
      await loadPlant(plants[0].plantId);
    } else {
      map.setView([-6.0135, 106.0219], 17);
    }
  } catch (e) {
    console.warn('[initMap] plants load failed:', e);
    map.setView([-6.0135, 106.0219], 17);
  }
}

// ── Plant Selector ────────────────────────────────────────────────────────────

function renderPlantSelector() {
  var sel = document.getElementById('plantSelector');
  if (!plants.length) {
    sel.innerHTML = '<option value="">Tidak ada plant</option>';
    return;
  }
  // Safe: escHtml on both values
  sel.innerHTML = plants.map(function(p) {
    return '<option value="' + escHtml(p.plantId) + '">' + escHtml(p.plantName) + ' \u2014 ' + escHtml(p.city || '') + '</option>';
  }).join('');
}

async function switchPlant() {
  var sel = document.getElementById('plantSelector');
  if (sel.value) await loadPlant(sel.value);
}

// ── Load GeoJSON for a plant ──────────────────────────────────────────────────

async function loadPlant(plantId) {
  currentPlantId = plantId;

  var sel = document.getElementById('plantSelector');
  if (sel) sel.value = plantId;

  hidePropsCard();
  editingLayer = null;
  baseLayer.clearLayers();
  drawnItems.clearLayers();
  osmFeatures = [];

  var plant = plants.find(function(p) { return p.plantId === plantId; });
  if (plant && plant.centerLat != null && plant.centerLon != null) {
    map.setView([plant.centerLat, plant.centerLon], plant.zoom || 17);
  } else {
    map.setView([-6.0135, 106.0219], 14);
  }

  try {
    var geojson = await apiGet('/maps/' + plantId);
    geojson.features.forEach(function(feature) {
      var props = feature.properties || {};
      if (props.source === 'custom') {
        // Editable custom layer
        var ft = props.featureType;
        var gl = L.geoJSON(feature, { style: function() { return styleForType(ft); } });
        gl.eachLayer(function(l) {
          l.feature = JSON.parse(JSON.stringify(feature));
          if (l.setStyle) l.setStyle(styleForType(ft));
          drawnItems.addLayer(l);
          attachLayerClick(l);
          if (props.name) {
            l.bindTooltip(props.name, { className: 'osm-tooltip', direction: 'top', offset: [0, -4] });
          }
        });
      } else {
        // Read-only OSM overlay
        osmFeatures.push(feature);
        L.geoJSON(feature, {
          style: function(f) { return styleForType(f.properties && f.properties.featureType); },
          pointToLayer: function(f, latlng) {
            return L.circleMarker(latlng, {
              radius: 4, color: '#7F8C8D', weight: 1,
              fillColor: '#BDC3C7', fillOpacity: 0.7,
            });
          },
          onEachFeature: function(f, l) {
            if (f.properties && f.properties.name) {
              l.bindTooltip(f.properties.name, {
                className: 'osm-tooltip', direction: 'top', offset: [0, -4],
              });
            }
          },
        }).addTo(baseLayer);
      }
    });
  } catch (e) {
    console.info('[loadPlant] No map data for ' + plantId + ' \u2014 ready to draw.');
  }

  updateFeatureCount();
}

// ── Click-to-edit for custom layers ──────────────────────────────────────────

function attachLayerClick(layer) {
  layer.on('click', function(e) {
    L.DomEvent.stopPropagation(e);
    openPropsPanel(layer);
  });
}

// ── Inline Properties Card ────────────────────────────────────────────────────

function openPropsPanel(layer) {
  editingLayer = layer;
  var props = (layer.feature && layer.feature.properties) || {};

  // Populate the static form fields in the inline card
  var nameInput = document.getElementById('p_name');
  var typeSelect = document.getElementById('p_featureType');
  var previewBox = document.getElementById('colorPreview');

  if (nameInput) nameInput.value = props.name || '';
  if (typeSelect) typeSelect.value = props.featureType || '';

  // Wire live preview (replace any previous listener by cloning the element)
  if (typeSelect) {
    var newSelect = typeSelect.cloneNode(true);
    newSelect.value = props.featureType || '';
    typeSelect.parentNode.replaceChild(newSelect, typeSelect);
    newSelect.addEventListener('change', updateColorPreview);
  }

  updateColorPreview();

  // Show the card and scroll it into view
  var card = document.getElementById('propsCard');
  if (card) {
    card.classList.add('visible');
    setTimeout(function() {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }
}

function updateColorPreview() {
  var typeSelect = document.getElementById('p_featureType');
  var previewBox = document.getElementById('colorPreview');
  if (!typeSelect || !previewBox) return;
  var s = styleForType(typeSelect.value);
  previewBox.style.background = s.fillColor || 'transparent';
  previewBox.style.borderColor = s.color || '#ccc';
  if (editingLayer && editingLayer.setStyle) editingLayer.setStyle(s);
}

function hidePropsCard() {
  var card = document.getElementById('propsCard');
  if (card) card.classList.remove('visible');
}

function saveProps() {
  if (!editingLayer) { hidePropsCard(); return; }

  var nameInput = document.getElementById('p_name');
  var typeSelect = document.getElementById('p_featureType');
  var name = nameInput ? nameInput.value.trim() : '';
  var featureType = typeSelect ? typeSelect.value : '';

  if (!editingLayer.feature) {
    editingLayer.feature = { type: 'Feature', properties: {} };
  }
  editingLayer.feature.properties.name = name;
  editingLayer.feature.properties.featureType = featureType;
  editingLayer.feature.properties.source = 'custom';

  if (editingLayer.setStyle) {
    editingLayer.setStyle(styleForType(featureType));
  }

  if (name) {
    editingLayer.bindTooltip(name, {
      className: 'osm-tooltip', direction: 'top', offset: [0, -4],
    });
  } else if (editingLayer.unbindTooltip) {
    editingLayer.unbindTooltip();
  }

  editingLayer = null;
  hidePropsCard();
  updateFeatureCount();
}

function cancelPropsPanel() {
  if (editingLayer) {
    var props = (editingLayer.feature && editingLayer.feature.properties) || {};
    if (editingLayer.setStyle) editingLayer.setStyle(styleForType(props.featureType));
    editingLayer = null;
  }
  hidePropsCard();
}

// ── Save to Server ────────────────────────────────────────────────────────────

async function saveMap() {
  if (!currentPlantId) {
    showMessage('Pilih plant terlebih dahulu', 'error');
    return;
  }

  var customFeatures = [];
  drawnItems.eachLayer(function(layer) {
    if (!layer.toGeoJSON) return;
    var f = layer.toGeoJSON();
    if (layer.feature && layer.feature.properties) {
      f.properties = Object.assign({}, f.properties, layer.feature.properties);
    }
    f.properties.source = 'custom';
    customFeatures.push(f);
  });

  var geojson = {
    type: 'FeatureCollection',
    features: osmFeatures.concat(customFeatures),
  };

  var saveBtn = document.getElementById('saveBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...'; }

  try {
    await apiPut('/maps/' + currentPlantId, geojson);
    showMessage('Peta ' + currentPlantId + ' disimpan \u2014 ' + customFeatures.length + ' area kustom');
  } catch (e) {
    showMessage(e.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Simpan Peta'; }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateFeatureCount() {
  var count = drawnItems.getLayers().length;
  var el = document.getElementById('customCount');
  if (el) el.textContent = count > 0 ? count + ' area kustom' : '';
}

// ── Init ──────────────────────────────────────────────────────────────────────
initMap();
