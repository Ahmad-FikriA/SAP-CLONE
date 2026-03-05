/* ─── Equipment Page Logic ─── */

let allEquipment = [];
let editingEquipId = null;

// ── Leaflet Map ─────────────────────────────────────────────────────────────
let map = null;
let markersLayer = null;
let overlayLayer = null;
let plants = [];
let currentPlantId = null;

// Category → marker color mapping
const CATEGORY_COLORS = {
  Mekanik: '#0070D2',
  Listrik: '#E67E22',
  Sipil: '#27AE60',
  Otomasi: '#8E44AD'
};

// GeoJSON feature type → style
const GEOJSON_STYLES = {
  building: { color: '#5D6D7E', weight: 1.5, fillColor: '#AEB6BF', fillOpacity: 0.45 },
  industrial: { color: '#7D3C98', weight: 1.5, fillColor: '#D2B4DE', fillOpacity: 0.30 },
  road: { color: '#5D6D7E', weight: 2, fillOpacity: 0 },
  railway: { color: '#2C3E50', weight: 2, dashArray: '6 4', fillOpacity: 0 },
  water: { color: '#2980B9', weight: 1.5, fillColor: '#85C1E9', fillOpacity: 0.50 },
  reservoir: { color: '#2980B9', weight: 1.5, fillColor: '#85C1E9', fillOpacity: 0.50 },
  default: { color: '#7F8C8D', weight: 1, fillColor: '#BDC3C7', fillOpacity: 0.25 }
};

function createCircleIcon(color) {
  return L.divIcon({
    className: 'eq-marker',
    html: `<div class="eq-marker__dot" style="background:${color};box-shadow:0 0 0 3px ${color}44"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10]
  });
}

async function initMap() {
  // Create map
  map = L.map('equipmentMap', {
    zoomControl: true,
    attributionControl: true
  });

  // OSM tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 20
  }).addTo(map);

  // Layer groups
  markersLayer = L.layerGroup().addTo(map);
  overlayLayer = L.layerGroup().addTo(map);

  // Load plants
  try {
    plants = await apiGet('/maps');
    renderPlantSelector();
    if (plants.length > 0) {
      currentPlantId = plants[0].plantId;
      const plant = plants[0];
      map.setView([plant.centerLat, plant.centerLon], plant.zoom);
      loadMapOverlay(plant.plantId);
    } else {
      map.setView([-6.0135, 106.0219], 17);
    }
  } catch (e) {
    console.warn('[initMap] Could not load plants:', e);
    map.setView([-6.0135, 106.0219], 17);
  }

  // Enable click-to-show-coordinates on map
  map.on('click', onMapClickForCoords);
}

function renderPlantSelector() {
  const sel = document.getElementById('plantSelector');
  if (!plants.length) {
    sel.innerHTML = '<option value="">Tidak ada plant</option>';
    return;
  }
  sel.innerHTML = plants.map(p =>
    `<option value="${escHtml(p.plantId)}">${escHtml(p.plantName)} — ${escHtml(p.city || '')}</option>`
  ).join('');
}

function switchPlant() {
  const sel = document.getElementById('plantSelector');
  const plantId = sel.value;
  const plant = plants.find(p => p.plantId === plantId);
  if (!plant) return;

  currentPlantId = plantId;
  map.setView([plant.centerLat, plant.centerLon], plant.zoom);
  loadMapOverlay(plantId);
  updateMapMarkers();
}

async function loadMapOverlay(plantId) {
  overlayLayer.clearLayers();
  try {
    const geojson = await apiGet(`/maps/${plantId}`);
    L.geoJSON(geojson, {
      style: feature => {
        const ft = feature.properties.featureType || 'default';
        return GEOJSON_STYLES[ft] || GEOJSON_STYLES.default;
      },
      pointToLayer: (feature, latlng) => {
        // Named POIs from OSM
        return L.circleMarker(latlng, {
          radius: 4, color: '#7F8C8D', weight: 1,
          fillColor: '#BDC3C7', fillOpacity: 0.7
        });
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties.name) {
          layer.bindTooltip(feature.properties.name, {
            className: 'osm-tooltip',
            direction: 'top',
            offset: [0, -4]
          });
        }
      }
    }).addTo(overlayLayer);
  } catch (e) {
    console.warn('[loadMapOverlay]', e);
  }
}

function updateMapMarkers() {
  markersLayer.clearLayers();
  const filtered = currentPlantId
    ? allEquipment.filter(eq => eq.plantId === currentPlantId)
    : allEquipment;

  filtered.forEach(eq => {
    if (!eq.latitude || !eq.longitude) return;
    const color = CATEGORY_COLORS[eq.category] || '#6C757D';
    const marker = L.marker([eq.latitude, eq.longitude], {
      icon: createCircleIcon(color)
    });
    const qrContainerId = `qr-${eq.equipmentId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    marker.bindPopup(`
      <div class="eq-popup">
        <div class="eq-popup__id">${escHtml(eq.equipmentId)}</div>
        <div class="eq-popup__name">${escHtml(eq.equipmentName)}</div>
        <div class="eq-popup__meta">
          <span class="eq-popup__badge" style="background:${color}22;color:${color}">${escHtml(eq.category)}</span>
        </div>
        <div class="eq-popup__loc">📍 ${escHtml(eq.functionalLocation)}</div>
        <div class="eq-popup__qr" style="margin-top:8px;text-align:center;">
          <div style="font-size:11px;color:#666;margin-bottom:4px;">Scan QR Code</div>
          <div id="${qrContainerId}" style="display:inline-block;"></div>
        </div>
      </div>
    `, { maxWidth: 280, minWidth: 180 });
    marker.on('popupopen', () => {
      setTimeout(() => {
        const container = document.getElementById(qrContainerId);
        if (container && !container.hasChildNodes()) {
          new QRCode(container, {
            text: eq.equipmentId,
            width: 96,
            height: 96,
            colorDark: '#1a1a2e',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        }
      }, 50);
    });
    marker.addTo(markersLayer);
  });
}

function fitMapToMarkers() {
  if (!markersLayer || markersLayer.getLayers().length === 0) return;
  const group = L.featureGroup(markersLayer.getLayers());
  map.fitBounds(group.getBounds().pad(0.15));
}

// ── Load & render ──────────────────────────────────────────────────────────
async function loadEquipment() {
  const tbody = document.getElementById('equipBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="6"><div class="spinner"></div></td></tr>';
  try {
    const cat = document.getElementById('filterCategory').value;
    allEquipment = await apiGet('/equipment' + (cat ? `?category=${cat}` : ''));
    renderEquipment();
    updateMapMarkers();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">${e.message}</td></tr>`;
  }
}

function renderEquipment() {
  const tbody = document.getElementById('equipBody');
  if (!allEquipment.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }
  tbody.innerHTML = allEquipment.map(eq => `
    <tr>
      <td><strong>${escHtml(eq.equipmentId)}</strong></td>
      <td>${escHtml(eq.equipmentName)}</td>
      <td>${escHtml(eq.functionalLocation)}</td>
      <td><span class="badge badge-in_progress" style="background:${CATEGORY_COLORS[eq.category] || '#6C757D'}22;color:${CATEGORY_COLORS[eq.category] || '#6C757D'}">${escHtml(eq.category)}</span></td>
      <td class="text-small text-muted">${escHtml(eq.plantName || '—')}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="focusOnMap('${escHtml(eq.equipmentId)}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Map
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openEdit('${escHtml(eq.equipmentId)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEquipment('${escHtml(eq.equipmentId)}')">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Focus equipment on map ──────────────────────────────────────────────────
function focusOnMap(equipmentId) {
  const eq = allEquipment.find(e => e.equipmentId === equipmentId);
  if (!eq || !eq.latitude || !eq.longitude) return;
  map.setView([eq.latitude, eq.longitude], 19, { animate: true });
  // Open the marker popup
  markersLayer.eachLayer(layer => {
    const ll = layer.getLatLng();
    if (Math.abs(ll.lat - eq.latitude) < 0.0001 && Math.abs(ll.lng - eq.longitude) < 0.0001) {
      layer.openPopup();
    }
  });
  // Scroll to map
  document.getElementById('equipmentMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Panel ──────────────────────────────────────────────────────────────────
function openCreate() {
  editingEquipId = null;
  document.getElementById('panelTitle').textContent = 'Tambah Equipment';
  renderForm(null);
  openPanel();
}

function openEdit(id) {
  editingEquipId = id;
  document.getElementById('panelTitle').textContent = 'Edit Equipment';
  const eq = allEquipment.find(e => e.equipmentId === id);
  renderForm(eq);
  openPanel();
}

function renderForm(eq) {
  const cats = ['Mekanik', 'Listrik', 'Sipil', 'Otomasi'];
  const plantOpts = plants.map(p =>
    `<option value="${escHtml(p.plantId)}" ${eq?.plantId === p.plantId ? 'selected' : ''}>${escHtml(p.plantName)}</option>`
  ).join('');

  document.getElementById('panelBody').innerHTML = `
    <div class="form-section">
      <div class="form-section__title">Detail Equipment</div>
      <div class="form-row full">
        <div class="form-group">
          <label>Equipment ID *</label>
          <input id="f_equipId" value="${escHtml(eq?.equipmentId || '')}" ${eq ? 'readonly' : ''} placeholder="EQ-011" />
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Nama Equipment *</label>
          <input id="f_equipName" value="${escHtml(eq?.equipmentName || '')}" placeholder="Nama peralatan" />
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label>Functional Location *</label>
          <input id="f_location" value="${escHtml(eq?.functionalLocation || '')}" placeholder="Lokasi fungsi" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kategori *</label>
          <select id="f_category">
            ${cats.map(c => `<option ${eq?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Plant</label>
          <select id="f_plantId">
            ${plantOpts}
          </select>
        </div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section__title">Koordinat GPS</div>
      <div class="form-row">
        <div class="form-group">
          <label>Latitude</label>
          <input id="f_lat" type="number" step="any" value="${eq?.latitude || ''}" placeholder="-6.0135" />
        </div>
        <div class="form-group">
          <label>Longitude</label>
          <input id="f_lon" type="number" step="any" value="${eq?.longitude || ''}" placeholder="106.0219" />
        </div>
      </div>
      <div class="hint" style="font-size:11px;color:var(--text-muted);margin-top:4px">
        💡 Klik pada peta untuk mengambil koordinat secara otomatis
      </div>
    </div>
  `;

  // Allow click-to-pick coordinates from map
  if (map) {
    map.off('click', onMapClickForCoords);
    map.on('click', onMapClickForCoords);

    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }

    // Show marker if equipment already has coordinates
    if (eq && eq.latitude && eq.longitude) {
      tempMarker = L.marker([eq.latitude, eq.longitude]).addTo(map);
    }
  }
}

let tempMarker = null;

function onMapClickForCoords(e) {
  const lat = e.latlng.lat.toFixed(7);
  const lon = e.latlng.lng.toFixed(7);

  const latInput = document.getElementById('f_lat');
  const lonInput = document.getElementById('f_lon');
  const panelOpen = document.getElementById('panel') && document.getElementById('panel').classList.contains('show');

  // Fill form fields if panel is open
  if (panelOpen && latInput && lonInput) {
    latInput.value = lat;
    lonInput.value = lon;

    if (tempMarker) {
      map.removeLayer(tempMarker);
    }
    tempMarker = L.marker(e.latlng).addTo(map);
  }

  // Always show a coordinate popup on click
  L.popup({ closeButton: true, className: 'coord-popup' })
    .setLatLng(e.latlng)
    .setContent(`<div style="font-size:12px;font-family:monospace;"><strong>📍 Koordinat</strong><br>Lat: ${lat}<br>Lng: ${lon}</div>`)
    .openOn(map);
}

// Override global closePanel to clean up marker
const originalClosePanel = window.closePanel;
window.closePanel = function () {
  if (originalClosePanel) originalClosePanel();
  if (tempMarker && map) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }
};

// ── Save ────────────────────────────────────────────────────────────────────
async function saveEquipment() {
  const equipmentId = document.getElementById('f_equipId').value.trim();
  const equipmentName = document.getElementById('f_equipName').value.trim();
  const functionalLocation = document.getElementById('f_location').value.trim();
  const category = document.getElementById('f_category').value;
  const plantId = document.getElementById('f_plantId').value;
  const latitude = parseFloat(document.getElementById('f_lat').value) || null;
  const longitude = parseFloat(document.getElementById('f_lon').value) || null;

  if (!equipmentId || !equipmentName) { alert('ID dan Nama Equipment wajib diisi.'); return; }

  const plantObj = plants.find(p => p.plantId === plantId);
  const body = {
    equipmentId, equipmentName, functionalLocation, category,
    plantId, plantName: plantObj?.plantName || '',
    latitude, longitude
  };

  try {
    if (editingEquipId) {
      await apiPut(`/equipment/${editingEquipId}`, body);
      showMessage(`Equipment ${equipmentId} diperbarui`);
    } else {
      await apiPost('/equipment', body);
      showMessage(`Equipment ${equipmentId} ditambahkan`);
    }
    closePanel();
    loadEquipment();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Delete ──────────────────────────────────────────────────────────────────
async function deleteEquipment(id) {
  if (!window.confirm(`Hapus equipment ${id}?`)) return;
  try {
    await apiDelete(`/equipment/${id}`);
    showMessage(`Equipment ${id} dihapus`);
    loadEquipment();
  } catch (e) { showMessage(e.message, 'error'); }
}

// ── Init ────────────────────────────────────────────────────────────────────
initMap();
loadEquipment();
