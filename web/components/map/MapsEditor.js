'use client';

import { useEffect, useRef } from 'react';

function fixLeafletIcons(L) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/**
 * MapsEditor — Leaflet map with Geoman draw controls.
 * Calls onMapReady(map, L) so the parent can wire draw event listeners and layer groups.
 */
export default function MapsEditor({ onMapReady, className = 'h-96 w-full', center = [-6.0135, 106.0219], zoom = 14 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    async function init() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      await import('@geoman-io/leaflet-geoman-free');
      await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css');
      fixLeafletIcons(L);

      if (mapRef.current || !containerRef.current) return;

      const map = L.map(containerRef.current).setView(center, zoom);
      mapRef.current = map;

      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri', maxZoom: 20 }
      );
      const streets = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap contributors', maxZoom: 22 }
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

      // Geoman controls — only polygon/rectangle drawing and edit/delete
      map.pm.addControls({
        position: 'topleft',
        drawMarker: false,
        drawCircle: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawText: false,
        rotateMode: false,
      });

      if (onMapReady) onMapReady(map, L, map.pm);
    }

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className={className} />;
}
