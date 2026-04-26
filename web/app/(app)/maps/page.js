'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { GEOJSON_FEATURE_COLORS } from '@/lib/constants';

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

function styleForType(ft) {
  return GEOJSON_STYLES[ft] || GEOJSON_STYLES.default;
}

// Dynamically import the map component to avoid SSR issues
const MapEditor = dynamic(() => import('@/components/map/MapsEditor'), { ssr: false });

export default function MapsPage() {
  const [plants, setPlants] = useState([]);
  const [plantId, setPlantId] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [customCount, setCustomCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [propName, setPropName] = useState('');
  const [propType, setPropType] = useState('');

  // Map refs — passed down to and populated by MapEditor
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const osmFeaturesRef = useRef([]);
  const editingLayerRef = useRef(null);

  useEffect(() => {
    apiGet('/maps').then((data) => {
      setPlants(data);
      if (data.length > 0) setPlantId(data[0].plantId);
    }).catch((e) => toast.error('Gagal memuat plants: ' + e.message));
  }, []);

  const onMapReady = useCallback((map, L, pm) => {
    mapRef.current = map;
    LRef.current = L;
    setMapReady(true);

    // Coordinate picker — click anywhere to show a popup with lat/lng + copy button
    // Suppressed while a draw tool is active (Geoman)
    map.on('click', (e) => {
      if (map.pm.globalDrawModeEnabled()) return;

      const lat = e.latlng.lat.toFixed(6);
      const lng = e.latlng.lng.toFixed(6);
      const coordStr = `${lat}, ${lng}`;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;align-items:center;gap:8px;font-family:monospace;font-size:12px;white-space:nowrap';

      const text = document.createElement('span');
      text.textContent = coordStr;
      wrapper.appendChild(text);

      const btn = document.createElement('button');
      btn.textContent = 'Salin';
      btn.style.cssText = 'padding:2px 10px;background:#1B3A5C;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-family:sans-serif';
      btn.onclick = () => {
        navigator.clipboard.writeText(coordStr).then(() => {
          btn.textContent = '✓ Disalin';
          setTimeout(() => { btn.textContent = 'Salin'; }, 1500);
        });
      };
      wrapper.appendChild(btn);

      L.popup({ closeButton: true, maxWidth: 280, className: 'coord-popup' })
        .setLatLng(e.latlng)
        .setContent(wrapper)
        .openOn(map);
    });

    const drawnItems = new L.FeatureGroup().addTo(map);
    drawnItemsRef.current = drawnItems;

    // pm (geoman) events
    map.on('pm:create', (e) => {
      const layer = e.layer;
      // Geoman adds to the map root — explicitly move it into our FeatureGroup only
      map.removeLayer(layer);
      if (!layer.feature) layer.feature = { type: 'Feature', properties: { source: 'custom' } };
      layer.feature.properties.source = 'custom';
      drawnItems.addLayer(layer);
      attachLayerClick(layer);
      openProps(layer);
      setCustomCount(drawnItems.getLayers().length);
    });

    map.on('pm:remove', (e) => {
      drawnItemsRef.current?.removeLayer(e.layer);
      setCustomCount(drawnItemsRef.current?.getLayers().length || 0);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function attachLayerClick(layer) {
    layer.on('click', (e) => {
      LRef.current?.DomEvent?.stopPropagation(e);
      openProps(layer);
    });
  }

  function openProps(layer) {
    editingLayerRef.current = layer;
    const props = layer.feature?.properties || {};
    setPropName(props.name || '');
    setPropType(props.featureType || '');
    setPropsOpen(true);
  }

  function handleTypeChange(type) {
    setPropType(type);
    // Update layer style preview live
    if (editingLayerRef.current?.setStyle) {
      editingLayerRef.current.setStyle(styleForType(type));
    }
  }

  function saveProps() {
    const layer = editingLayerRef.current;
    if (!layer) { setPropsOpen(false); return; }
    if (!layer.feature) layer.feature = { type: 'Feature', properties: {} };
    layer.feature.properties.name = propName;
    layer.feature.properties.featureType = propType;
    layer.feature.properties.source = 'custom';
    if (layer.setStyle) layer.setStyle(styleForType(propType));
    if (propName) layer.bindTooltip(propName, { className: 'osm-tooltip', direction: 'top', offset: [0, -4] });
    else if (layer.unbindTooltip) layer.unbindTooltip();
    editingLayerRef.current = null;
    setPropsOpen(false);
    setCustomCount(drawnItemsRef.current?.getLayers().length || 0);
  }

  function cancelProps() {
    const layer = editingLayerRef.current;
    if (layer?.setStyle) layer.setStyle(styleForType(layer.feature?.properties?.featureType));
    editingLayerRef.current = null;
    setPropsOpen(false);
  }

  async function loadPlantData(id) {
    if (!mapRef.current || !LRef.current || !drawnItemsRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;
    drawnItemsRef.current.clearLayers();
    osmFeaturesRef.current = [];
    editingLayerRef.current = null;
    setPropsOpen(false);

    const plant = plants.find((p) => p.plantId === id);
    if (plant?.centerLat != null) map.setView([plant.centerLat, plant.centerLon], plant.zoom || 17);
    else map.setView([-6.0135, 106.0219], 14);

    try {
      const geojson = await apiGet(`/maps/${id}`);
      // We need a baseLayer for OSM features — use a separate layer group
      // For simplicity, add non-custom features to map directly (read-only)
      if (!mapRef.current._osmBaseLayer) {
        mapRef.current._osmBaseLayer = L.layerGroup().addTo(map);
      }
      mapRef.current._osmBaseLayer.clearLayers();

      geojson.features.forEach((feature) => {
        const props = feature.properties || {};
        if (props.source === 'custom') {
          const gl = L.geoJSON(feature, { style: () => styleForType(props.featureType) });
          gl.eachLayer((l) => {
            l.feature = JSON.parse(JSON.stringify(feature));
            if (l.setStyle) l.setStyle(styleForType(props.featureType));
            drawnItemsRef.current.addLayer(l);
            attachLayerClick(l);
            if (props.name) l.bindTooltip(props.name, { className: 'osm-tooltip', direction: 'top', offset: [0, -4] });
          });
        } else {
          osmFeaturesRef.current.push(feature);
          L.geoJSON(feature, {
            style: (f) => styleForType(f.properties?.featureType),
            pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 4, color: '#7F8C8D', weight: 1, fillColor: '#BDC3C7', fillOpacity: 0.7 }),
            onEachFeature: (f, l) => { if (f.properties?.name) l.bindTooltip(f.properties.name, { className: 'osm-tooltip', direction: 'top', offset: [0, -4] }); },
          }).addTo(mapRef.current._osmBaseLayer);
        }
      });
    } catch {
      // No map data yet — ready to draw
    }
    const count = drawnItemsRef.current.getLayers().length;
    setCustomCount(count);

    // Fit map to show all custom areas if any exist
    if (count > 0) {
      try {
        const bounds = drawnItemsRef.current.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      } catch { /* bounds might fail on empty/invalid layer */ }
    }
  }

  function handlePlantChange(id) {
    setPlantId(id);
    loadPlantData(id);
  }

  useEffect(() => {
    if (plantId && mapReady) loadPlantData(plantId);
  }, [plantId, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveMap() {
    if (!plantId) { toast.error('Pilih plant terlebih dahulu'); return; }
    const seen = new Set();
    const customFeatures = [];
    drawnItemsRef.current?.eachLayer((layer) => {
      if (!layer.toGeoJSON) return;
      const f = layer.toGeoJSON();
      if (layer.feature?.properties) f.properties = { ...f.properties, ...layer.feature.properties };
      f.properties.source = 'custom';
      const key = JSON.stringify(f.geometry?.coordinates);
      if (seen.has(key)) return;
      seen.add(key);
      customFeatures.push(f);
    });
    const geojson = { type: 'FeatureCollection', features: [...osmFeaturesRef.current, ...customFeatures] };
    setSaving(true);
    try {
      await apiPut(`/maps/${plantId}`, geojson);
      toast.success(`Peta ${plantId} disimpan — ${customFeatures.length} area kustom`);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const previewStyle = styleForType(propType);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Maps Editor</h2>
          <p className="text-sm text-gray-500">Edit area kustom pada peta plant</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={plantId} onChange={(e) => handlePlantChange(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white min-w-[180px]">
            {plants.length === 0 && <option value="">Tidak ada plant</option>}
            {plants.map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName} — {p.city || ''}</option>)}
          </select>
          {customCount > 0 && <span className="text-xs text-gray-500">{customCount} area kustom</span>}
          <Button size="sm" onClick={saveMap} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Peta'}</Button>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden relative z-0">
        <MapEditor onMapReady={onMapReady} className="h-[600px] w-full" />
      </div>

      <p className="text-xs text-gray-400">Klik pada peta untuk melihat koordinat (popup akan muncul di titik klik)</p>

      {/* Inline props card */}
      {propsOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 max-w-sm">
          <h3 className="text-sm font-semibold text-gray-800">Properti Area</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama</label>
            <input value={propName} onChange={(e) => setPropName(e.target.value)} placeholder="Nama area"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipe</label>
            <div className="flex items-center gap-2">
              <select value={propType} onChange={(e) => handleTypeChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">Pilih tipe...</option>
                {FEATURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="w-8 h-8 rounded border-2 shrink-0" style={{ background: previewStyle.fillColor, borderColor: previewStyle.color }} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveProps}>Simpan</Button>
            <Button variant="ghost" size="sm" onClick={cancelProps}>Batal</Button>
          </div>
        </div>
      )}
    </div>
  );
}
