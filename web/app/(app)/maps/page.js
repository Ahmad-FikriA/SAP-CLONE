'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { MapPin, Trash2, Save, Pencil } from 'lucide-react';

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

const TYPE_COLORS = {
  building:   'bg-gray-100 text-gray-600',
  industrial: 'bg-purple-100 text-purple-700',
  road:       'bg-slate-100 text-slate-600',
  railway:    'bg-zinc-100 text-zinc-700',
  water:      'bg-blue-100 text-blue-700',
  reservoir:  'bg-cyan-100 text-cyan-700',
};

function styleForType(ft) {
  return GEOJSON_STYLES[ft] || GEOJSON_STYLES.default;
}

const MapEditor = dynamic(() => import('@/components/map/MapsEditor'), { ssr: false });

export default function MapsPage() {
  const [plants, setPlants]       = useState([]);
  const [plantId, setPlantId]     = useState('');
  const [mapReady, setMapReady]   = useState(false);
  const [layerList, setLayerList] = useState([]);  // [{ id, name, featureType, lat, lng }]
  const [saving, setSaving]       = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [propName, setPropName]   = useState('');
  const [propType, setPropType]   = useState('');
  const [editingId, setEditingId] = useState(null); // leaflet id of layer being edited

  const mapRef          = useRef(null);
  const LRef            = useRef(null);
  const drawnItemsRef   = useRef(null);
  const osmFeaturesRef  = useRef([]);
  const editingLayerRef = useRef(null);
  const layerStoreRef   = useRef(new Map()); // leafletId → layer

  // Rebuild the table from drawnItems
  function refreshLayerList() {
    const list = [];
    layerStoreRef.current.clear();
    drawnItemsRef.current?.getLayers().forEach((layer) => {
      const id = layer._leaflet_id;
      const props = layer.feature?.properties || {};
      let lat = '—', lng = '—';
      try {
        const c = layer.getBounds().getCenter();
        lat = c.lat.toFixed(5);
        lng = c.lng.toFixed(5);
      } catch { /* point layers or degenerate geometry */ }
      list.push({ id, name: props.name || '', featureType: props.featureType || '', lat, lng });
      layerStoreRef.current.set(id, layer);
    });
    setLayerList(list);
  }

  useEffect(() => {
    apiGet('/maps').then((data) => {
      setPlants(data);
      if (data.length > 0) setPlantId(data[0].plantId);
    }).catch((e) => toast.error('Gagal memuat plants: ' + e.message));
  }, []);

  const onMapReady = useCallback((map, L) => {
    mapRef.current = map;
    LRef.current   = L;
    setMapReady(true);

    // Coordinate picker popup on click
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
      L.popup({ closeButton: true, maxWidth: 280 }).setLatLng(e.latlng).setContent(wrapper).openOn(map);
    });

    const drawnItems = new L.FeatureGroup().addTo(map);
    drawnItemsRef.current = drawnItems;

    map.on('pm:create', (e) => {
      const layer = e.layer;
      map.removeLayer(layer); // move out of map root
      if (!layer.feature) layer.feature = { type: 'Feature', properties: { source: 'custom' } };
      layer.feature.properties.source = 'custom';
      drawnItems.addLayer(layer);
      attachLayerClick(layer);
      openPropsForLayer(layer);
      refreshLayerList();
    });

    map.on('pm:remove', (e) => {
      drawnItemsRef.current?.removeLayer(e.layer);
      refreshLayerList();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function attachLayerClick(layer) {
    layer.on('click', (e) => {
      LRef.current?.DomEvent?.stopPropagation(e);
      openPropsForLayer(layer);
    });
  }

  function openPropsForLayer(layer) {
    editingLayerRef.current = layer;
    const props = layer.feature?.properties || {};
    setPropName(props.name || '');
    setPropType(props.featureType || '');
    setEditingId(layer._leaflet_id);
    setPropsOpen(true);
  }

  function openPropsById(id) {
    const layer = layerStoreRef.current.get(id);
    if (layer) openPropsForLayer(layer);
  }

  function focusLayer(id) {
    const layer = layerStoreRef.current.get(id);
    if (!layer || !mapRef.current) return;
    try {
      mapRef.current.flyTo(layer.getBounds().getCenter(), 17);
    } catch { /* point or degenerate */ }
  }

  function deleteLayer(id) {
    const layer = layerStoreRef.current.get(id);
    if (!layer) return;
    drawnItemsRef.current?.removeLayer(layer);
    if (editingId === id) { setPropsOpen(false); setEditingId(null); }
    refreshLayerList();
  }

  function handleTypeChange(type) {
    setPropType(type);
    if (editingLayerRef.current?.setStyle) editingLayerRef.current.setStyle(styleForType(type));
  }

  function applyProps() {
    const layer = editingLayerRef.current;
    if (!layer) { setPropsOpen(false); return; }
    if (!layer.feature) layer.feature = { type: 'Feature', properties: {} };
    layer.feature.properties.name        = propName;
    layer.feature.properties.featureType = propType;
    layer.feature.properties.source      = 'custom';
    if (layer.setStyle) layer.setStyle(styleForType(propType));
    if (propName) layer.bindTooltip(propName, { className: 'osm-tooltip', direction: 'top', offset: [0, -4] });
    else if (layer.unbindTooltip) layer.unbindTooltip();
    editingLayerRef.current = null;
    setPropsOpen(false);
    setEditingId(null);
    refreshLayerList();
  }

  function cancelProps() {
    const layer = editingLayerRef.current;
    if (layer?.setStyle) layer.setStyle(styleForType(layer.feature?.properties?.featureType));
    editingLayerRef.current = null;
    setPropsOpen(false);
    setEditingId(null);
  }

  async function loadPlantData(id) {
    if (!mapRef.current || !LRef.current || !drawnItemsRef.current) return;
    const L   = LRef.current;
    const map = mapRef.current;
    drawnItemsRef.current.clearLayers();
    osmFeaturesRef.current = [];
    editingLayerRef.current = null;
    setPropsOpen(false);
    setEditingId(null);

    const plant = plants.find((p) => p.plantId === id);
    if (plant?.centerLat != null) map.setView([plant.centerLat, plant.centerLon], plant.zoom || 17);
    else map.setView([-6.0135, 106.0219], 14);

    try {
      const geojson = await apiGet(`/maps/${id}`);
      if (!mapRef.current._osmBaseLayer) {
        mapRef.current._osmBaseLayer = L.layerGroup().addTo(map);
      }
      mapRef.current._osmBaseLayer.clearLayers();

      const seenCoords = new Set();
      geojson.features.forEach((feature) => {
        const props = feature.properties || {};
        if (props.source === 'custom') {
          const coordKey = JSON.stringify(feature.geometry?.coordinates);
          if (seenCoords.has(coordKey)) return; // skip duplicates from corrupted file
          seenCoords.add(coordKey);
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
      // No saved map yet — ready to draw
    }

    refreshLayerList();

    try {
      const bounds = drawnItemsRef.current.getBounds();
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } catch { /* empty or invalid */ }
  }

  function handlePlantChange(id) {
    setPlantId(id);
    // useEffect([plantId, mapReady]) handles the load — don't call directly or it double-loads
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
      toast.success(`Peta disimpan — ${customFeatures.length} area kustom`);
      refreshLayerList();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const previewStyle = styleForType(propType);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Maps Editor</h2>
          <p className="text-sm text-gray-500">Gambar dan kelola area kustom pada peta plant</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={plantId} onChange={(e) => handlePlantChange(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white min-w-[180px]">
            {plants.length === 0 && <option value="">Tidak ada plant</option>}
            {plants.map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName} — {p.city || ''}</option>)}
          </select>
          <Button size="sm" onClick={saveMap} disabled={saving} className="gap-1.5">
            <Save size={13} />
            {saving ? 'Menyimpan...' : 'Simpan Peta ke Server'}
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden relative z-0">
        <MapEditor onMapReady={onMapReady} className="h-[560px] w-full" />
      </div>

      <p className="text-xs text-gray-400">Klik peta untuk koordinat · Gunakan toolbar kiri untuk menggambar · Klik area untuk edit label</p>

      {/* Props panel — appears when a shape is selected */}
      {propsOpen && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 max-w-md">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-900">Label Area</h3>
            <span className="text-[10px] text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
              Belum disimpan ke server
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyProps}>Terapkan Label</Button>
            <Button variant="ghost" size="sm" onClick={cancelProps}>Batal</Button>
          </div>
        </div>
      )}

      {/* Area table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Area Kustom</h3>
            <p className="text-xs text-gray-400">{layerList.length} area · klik Simpan Peta ke Server untuk menyimpan perubahan</p>
          </div>
        </div>

        {layerList.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Belum ada area — gunakan toolbar gambar di peta
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipe</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lat</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lng</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {layerList.map((item, i) => (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${editingId === item.id ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {item.name || <span className="text-gray-300 italic">tanpa nama</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {item.featureType
                      ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[item.featureType] || 'bg-gray-100 text-gray-600'}`}>{item.featureType}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{item.lat}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{item.lng}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => focusLayer(item.id)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors" title="Fokus di peta">
                        <MapPin size={13} />
                      </button>
                      <button onClick={() => openPropsById(item.id)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Edit label">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteLayer(item.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Hapus area">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
