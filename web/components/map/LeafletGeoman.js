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
 * LeafletGeoman — Leaflet map with Geoman draw controls.
 * Exposes onMapReady(map, L, pm) for the parent to wire up draw event listeners.
 *
 * Wrap in next/dynamic with ssr: false at the import site.
 */
export default function LeafletGeoman({ onMapReady, className = 'h-96 w-full', center = [-6.2, 106.8], zoom = 13 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let map;

    async function init() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      await import('@geoman-io/leaflet-geoman-free');
      await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css');
      fixLeafletIcons(L);

      if (mapRef.current || !containerRef.current) return;

      map = L.map(containerRef.current).setView(center, zoom);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Add Geoman draw controls
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
