'use client';

import { useEffect, useRef } from 'react';

// Fix Leaflet's default icon path issue in Next.js/webpack
function fixLeafletIcons(L) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/**
 * LeafletMap — mounts a Leaflet map and exposes it via the onMapReady(map, L) callback.
 * CSS is imported here so it only loads on the client.
 *
 * Usage:
 *   <LeafletMap onMapReady={(map, L) => { ... }} className="h-96" />
 *
 * Wrap in next/dynamic with ssr: false at the import site.
 */
export default function LeafletMap({ onMapReady, className = 'h-96 w-full', center = [-6.2, 106.8], zoom = 13 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let map;
    let L;

    async function init() {
      // Dynamic import so Leaflet only runs on client
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      fixLeafletIcons(L);

      if (mapRef.current || !containerRef.current) return;

      map = L.map(containerRef.current).setView(center, zoom);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      if (onMapReady) onMapReady(map, L);
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
