
import React, { useEffect, useRef } from 'react';

interface MiniMapProps {
  lat: number;
  lng: number;
}

export const MiniMap: React.FC<MiniMapProps> = ({ lat, lng }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    // Cleanup existing instance if strictly needed, though React usually handles unmount
    if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
    }

    // Initialize Map - simplified controls for a "preview" feel
    const map = window.L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: false,
      dragging: false,       // Keep it static
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      attributionControl: false,
      keyboard: false
    });

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    }).addTo(map);

    // Simple Throne Marker for MiniMap
    const throneIcon = window.L.divIcon({
        className: 'mini-map-throne',
        html: `<div class="text-4xl drop-shadow-lg filter drop-shadow-md" style="transform:translate(-50%, -50%)">👑</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20] // Center it
    });

    window.L.marker([lat, lng], { icon: throneIcon }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng]);

  return <div ref={mapContainerRef} className="w-full h-full bg-amber-50/50" />;
};
