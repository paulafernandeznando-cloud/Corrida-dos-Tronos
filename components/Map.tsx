
import React, { useEffect, useRef } from 'react';
import { Place, Coordinates } from '../types';

declare global {
  interface Window {
    L: any;
  }
}

interface MapProps {
  places: Place[];
  userLocation?: Coordinates;
  destination?: Place | null;
  celebratingPlaceName?: string | null;
  runPath?: Coordinates[];
}

export const Map: React.FC<MapProps> = ({ places, userLocation, destination, celebratingPlaceName, runPath }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const routingControlRef = useRef<any>(null);
  const runPolylineRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // Initialize map if not already initialized
    if (!leafletMapRef.current) {
      leafletMapRef.current = window.L.map(mapRef.current).setView([0, 0], 2);
      
      // Use a nice light tile layer
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(leafletMapRef.current);
    }

    const map = leafletMapRef.current;
    
    // --- 1. Handle Places Markers ---
    
    // Clear existing place markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Custom Throne Icon
    const createThroneIcon = (difficulty: string, isCelebrating: boolean) => {
      // Colors based on difficulty for the icon background/accent if needed, 
      // but mostly gold/royal for the throne theme.
      let accentColor = '#fbbf24'; // Amber-400 (Gold)

      const throneSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${accentColor}" stroke="#78350f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 21v-8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8" />
          <path d="M19 21v-8a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2v8" />
          <path d="M9 21v-8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8" />
          <path d="M2 21h20" />
          <path d="M5 11V7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4" />
          <circle cx="12" cy="7" r="1" fill="#78350f" stroke="none"/>
        </svg>
      `;

      return window.L.divIcon({
        className: `custom-throne-icon ${isCelebrating ? 'conquer-animation' : ''}`,
        html: `<div class="throne-marker-wrapper relative w-12 h-12 cursor-pointer">
                ${throneSvg}
                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-black/20 rounded-full blur-[2px]"></div>
               </div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 45], // Anchor at bottom center
        popupAnchor: [0, -45]
      });
    };

    const bounds = window.L.latLngBounds([]);

    places.forEach(place => {
      if (place.lat && place.lng) {
        const isCelebrating = celebratingPlaceName === place.name;

        const marker = window.L.marker([place.lat, place.lng], {
          icon: createThroneIcon(place.difficulty, isCelebrating)
        })
        .bindPopup(`
          <div class="font-sans min-w-[200px] text-center">
            <div class="text-3xl mb-1 animate-bounce">👑</div>
            <h3 class="font-bold text-slate-900 text-base mb-1">Trono de ${place.name}</h3>
            <p class="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">Conquiste este lugar!</p>
            <p class="text-sm text-slate-600 leading-tight text-left">${place.summary}</p>
          </div>
        `);
        
        marker.addTo(map);
        markersRef.current.push(marker);
        bounds.extend([place.lat, place.lng]);
        
        // If this is the selected destination, open popup unless we are tracking
        if (destination && destination.name === place.name && !runPath) {
           marker.openPopup();
        }
      }
    });

    // --- 2. Handle User Location Marker ---
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userIcon = window.L.divIcon({
        className: 'user-location-icon',
        html: `<div class="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg ring-2 ring-blue-400/50 pulse-ring"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      userMarkerRef.current = window.L.marker(
        [userLocation.latitude, userLocation.longitude], 
        { icon: userIcon, zIndexOffset: 1000 }
      )
      .addTo(map);
      
      bounds.extend([userLocation.latitude, userLocation.longitude]);
    }

    // --- 3. Handle Routing ---
    
    // Remove previous routing control
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }

    // If we have both user location and a selected destination, draw route
    if (userLocation && destination && window.L.Routing) {
      
      // Create the routing control
      routingControlRef.current = window.L.Routing.control({
        waypoints: [
          window.L.latLng(userLocation.latitude, userLocation.longitude),
          window.L.latLng(destination.lat, destination.lng)
        ],
        router: window.L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        lineOptions: {
          styles: [{ color: '#d97706', opacity: 0.6, weight: 6, dashArray: '1, 10' }] // Amber/Gold route color
        },
        show: false, // Hide the text instructions to focus on map/tracking
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false, // We manage bounds manually
        createMarker: function() { return null; }
      }).addTo(map);
    }

    // --- 4. Handle Run Path (Polyline) ---
    if (runPolylineRef.current) {
      map.removeLayer(runPolylineRef.current);
      runPolylineRef.current = null;
    }

    if (runPath && runPath.length > 0) {
      const latLngs = runPath.map(c => [c.latitude, c.longitude]);
      runPolylineRef.current = window.L.polyline(latLngs, {
        color: '#059669', // Emerald 600
        weight: 5,
        opacity: 1,
        lineJoin: 'round'
      }).addTo(map);
      
      // If tracking, keep view centered on user/path
      if (runPath.length > 1) {
        // const lastPoint = runPath[runPath.length - 1];
        // map.panTo([lastPoint.latitude, lastPoint.longitude], { animate: true });
        // Use bounds to keep both user and destination in view if needed, usually panTo user is better for tracking
      }
    }

    // Fit bounds logic
    if (!destination && markersRef.current.length > 0) {
       map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (destination && userLocation && !runPath) {
       // Initial route view
       map.fitBounds(bounds, { padding: [80, 80] });
    }

  }, [places, userLocation, destination, celebratingPlaceName, runPath]);

  return <div ref={mapRef} className="w-full h-full bg-amber-50/50 z-0" />;
};
