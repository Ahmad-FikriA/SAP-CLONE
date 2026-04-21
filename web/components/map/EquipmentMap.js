'use client';

import { useEffect, useRef } from 'react';
import React from 'react';
import { CATEGORY_MARKER_COLORS } from '@/lib/constants';

function fixLeafletIcons(L) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/** Build popup DOM element safely — no innerHTML */
function buildPopupEl(eq, color, qrId) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'min-width:160px;font-family:sans-serif;font-size:12px';

  const idEl = document.createElement('div');
  idEl.style.cssText = 'font-weight:700;font-size:13px';
  idEl.textContent = eq.equipmentId;
  wrap.appendChild(idEl);

  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'color:#555;margin:2px 0 4px';
  nameEl.textContent = eq.equipmentName;
  wrap.appendChild(nameEl);

  const catBadge = document.createElement('div');
  catBadge.style.cssText = `display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;background:${color}22;color:${color};margin-bottom:6px`;
  catBadge.textContent = eq.category || '—';
  wrap.appendChild(catBadge);

  const locEl = document.createElement('div');
  locEl.style.cssText = 'color:#666;font-size:11px';
  locEl.textContent = '📍 ' + (eq.functionalLocation || eq.functionalLocationId || '—');
  wrap.appendChild(locEl);

  const qrSection = document.createElement('div');
  qrSection.style.cssText = 'margin-top:8px;text-align:center';

  const qrLabel = document.createElement('div');
  qrLabel.style.cssText = 'font-size:10px;color:#888;margin-bottom:4px';
  qrLabel.textContent = 'Scan QR Code';
  qrSection.appendChild(qrLabel);

  const qrContainer = document.createElement('div');
  qrContainer.id = qrId;
  qrContainer.style.display = 'inline-block';
  qrSection.appendChild(qrContainer);

  wrap.appendChild(qrSection);
  return wrap;
}

/**
 * EquipmentMap — renders equipment as colored circle markers with QR popups.
 * onMapReady(updateFn) — parent calls updateFn(newEquipmentArray) to refresh markers.
 * onClickCoord(lat, lng) — called when user clicks the map (to pick coordinates).
 */
export default function EquipmentMap({ equipment, plants, plantId, onMapReady, onClickCoord, className = 'h-64 w-full' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const onClickCoordRef = useRef(onClickCoord);

  // Keep ref current so map click always has the latest callback
  useEffect(() => { onClickCoordRef.current = onClickCoord; }, [onClickCoord]);

  useEffect(() => {
    async function init() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      const QRCode = (await import('react-qr-code')).default;
      const { createRoot } = await import('react-dom/client');
      fixLeafletIcons(L);

      if (mapRef.current || !containerRef.current) return;

      const map = L.map(containerRef.current).setView([-6.2, 106.8], 13);
      mapRef.current = map;

      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri — Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN', maxZoom: 20 }
      );
      const streets = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap contributors', maxZoom: 19 }
      );
      const labels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { attribution: '', maxZoom: 20, opacity: 0.8 }
      );

      satellite.addTo(map);
      labels.addTo(map);

      L.control.layers(
        { 'Satelit (ESRI)': satellite, 'Street Map': streets },
        { 'Label': labels },
        { position: 'topright', collapsed: false }
      ).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersRef.current = markersLayer;

      // Wire map click → coordinate popup + optional form fill
      map.on('click', (e) => {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        const coordStr = `${lat}, ${lng}`;

        // Always show a popup with the coordinates and a copy button
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

        L.popup({ closeButton: true, maxWidth: 280 })
          .setLatLng(e.latlng)
          .setContent(wrapper)
          .openOn(map);

        // If form is open, also fill the lat/lng fields
        if (onClickCoordRef.current) onClickCoordRef.current(e.latlng.lat, e.latlng.lng);
      });

      function addMarkers(items) {
        markersLayer.clearLayers();
        (items || []).forEach((eq) => {
          if (eq.latitude == null || eq.longitude == null) return;
          const color = CATEGORY_MARKER_COLORS[eq.category] || '#6B7280';
          const qrId = `qr-${String(eq.equipmentId).replace(/[^a-zA-Z0-9]/g, '_')}`;

          const marker = L.circleMarker([eq.latitude, eq.longitude], {
            radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0.7,
          });

          marker.bindPopup(buildPopupEl(eq, color, qrId), { maxWidth: 240, minWidth: 180 });

          marker.on('popupopen', () => {
            setTimeout(() => {
              const container = document.getElementById(qrId);
              if (container && !container._qrMounted) {
                container._qrMounted = true;
                const root = createRoot(container);
                root.render(
                  React.createElement(QRCode, { value: String(eq.equipmentId), size: 88, bgColor: '#ffffff', fgColor: '#1a1a2e' })
                );
              }
            }, 60);
          });

          marker.addTo(markersLayer);
        });
      }

      const flyTo = (lat, lng, zoom = 17) => map.flyTo([lat, lng], zoom);

      if (onMapReady) onMapReady((newEquipment) => addMarkers(newEquipment), flyTo);
      if (equipment) addMarkers(equipment);
    }

    init();

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan to plant when plantId changes
  useEffect(() => {
    if (!mapRef.current || !plants) return;
    const plant = plants.find((p) => p.plantId === plantId);
    if (plant?.centerLat != null) {
      mapRef.current.setView([plant.centerLat, plant.centerLon], plant.zoom || 15);
    }
  }, [plantId, plants]);

  return <div ref={containerRef} className={className} />;
}
