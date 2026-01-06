import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GeminiResponseData, Place, Coordinates, RunMetrics, RunHistoryEntry } from '../types';
import { Map } from './Map';
import { MiniMap } from './MiniMap';
import { calculateDistance, calculatePace, formatTime } from '../utils/geoUtils';

interface ResultDisplayProps {
  data: GeminiResponseData;
  userCoordinates?: Coordinates;
  onUpdateCoordinates: (coords: Coordinates) => void;
}

type SortOption = 'default' | 'difficulty' | 'distance' | 'popularity';

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ data, userCoordinates, onUpdateCoordinates }) => {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [detailsPlace, setDetailsPlace] = useState<Place | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  
  // Celebration State
  const [celebratingPlaceName, setCelebratingPlaceName] = useState<string | null>(null);

  // Running/Tracking State
  const [isTracking, setIsTracking] = useState(false);
  const [runMetrics, setRunMetrics] = useState<RunMetrics>({
    distanceKm: 0,
    elapsedTimeSeconds: 0,
    currentPace: '--:--',
    path: [],
    isTracking: false
  });
  
  const watchIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const lastLocationRef = useRef<Coordinates | null>(null);

  const hasPlaces = data.places && data.places.length > 0;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  const saveRunToHistory = () => {
    if (runMetrics.distanceKm === 0 && runMetrics.elapsedTimeSeconds === 0) return;

    try {
      const historyEntry: RunHistoryEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        placeName: selectedPlace?.name || "Corrida Livre",
        metrics: runMetrics
      };

      const existingHistoryStr = localStorage.getItem('runHistory');
      const history: RunHistoryEntry[] = existingHistoryStr ? JSON.parse(existingHistoryStr) : [];
      
      const newHistory = [...history, historyEntry];
      localStorage.setItem('runHistory', JSON.stringify(newHistory));
      
      alert(`Corrida finalizada e salva!\nDistância: ${runMetrics.distanceKm.toFixed(2)}km\nTempo: ${formatTime(runMetrics.elapsedTimeSeconds)}`);
    } catch (error) {
      console.error("Erro ao salvar histórico de corrida:", error);
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Save if we actually ran
    if (isTracking) {
      saveRunToHistory();
    }

    setIsTracking(false);
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocalização não suportada.");
      return;
    }

    setIsTracking(true);
    
    // Reset metrics for a fresh run
    setRunMetrics({
      distanceKm: 0,
      elapsedTimeSeconds: 0,
      currentPace: '--:--',
      path: userCoordinates ? [userCoordinates] : [],
      isTracking: true
    });
    
    lastLocationRef.current = userCoordinates || null;

    // Timer logic
    timerIntervalRef.current = setInterval(() => {
      setRunMetrics(prev => {
        const newTime = prev.elapsedTimeSeconds + 1;
        return {
          ...prev,
          elapsedTimeSeconds: newTime,
          currentPace: calculatePace(prev.distanceKm, newTime)
        };
      });
    }, 1000);

    // Geolocation tracking logic
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newCoords: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        // Update global user coordinates to move the marker
        onUpdateCoordinates(newCoords);

        // Calculate metrics
        if (lastLocationRef.current) {
           const dist = calculateDistance(
             lastLocationRef.current.latitude, 
             lastLocationRef.current.longitude,
             newCoords.latitude,
             newCoords.longitude
           );

           // Simple noise filter: ignore jumps < 5 meters to avoid jitter when standing still
           if (dist > 0.005) { 
             setRunMetrics(prev => {
               const newDist = prev.distanceKm + dist;
               return {
                 ...prev,
                 distanceKm: newDist,
                 path: [...prev.path, newCoords]
               };
             });
             lastLocationRef.current = newCoords;
           }
        } else {
          lastLocationRef.current = newCoords;
          setRunMetrics(prev => ({...prev, path: [newCoords]}));
        }
      },
      (error) => {
        console.warn("Tracking error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleRouteRequest = (place: Place) => {
    setDetailsPlace(null); // Close modal
    
    // Trigger Celebration Animation
    setCelebratingPlaceName(place.name);
    setTimeout(() => setCelebratingPlaceName(null), 5000); // Stop animation after 5s to match CSS sequence

    if (userCoordinates) {
      setSelectedPlace(place);
    } else {
      setIsLocating(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            onUpdateCoordinates(coords);
            setSelectedPlace(place);
            setIsLocating(false);
          },
          (error) => {
            console.error("Error getting location for route", error);
            alert("Precisamos da sua localização para traçar a rota.");
            setIsLocating(false);
          }
        );
      } else {
        alert("Seu navegador não suporta geolocalização.");
        setIsLocating(false);
      }
    }
  };

  // --- Sorting Logic ---

  const getDifficultyScore = (difficulty: string) => {
    const d = difficulty.toLowerCase();
    if (d.includes('iniciante')) return 1;
    if (d.includes('intermediário') || d.includes('intermediario')) return 2;
    if (d.includes('avançado') || d.includes('avancado')) return 3;
    return 2; // Default to medium
  };

  const getPopularityScore = (place: Place) => {
    // Sort by the visits of the #1 leaderboard entry
    return place.leaderboard?.[0]?.visits || 0;
  };

  const sortedPlaces = useMemo(() => {
    if (!data.places) return [];
    
    const placesCopy = [...data.places];

    switch (sortBy) {
      case 'difficulty':
        // Sort Easy -> Hard
        return placesCopy.sort((a, b) => getDifficultyScore(a.difficulty) - getDifficultyScore(b.difficulty));
      
      case 'popularity':
        // Sort High Visits -> Low Visits
        return placesCopy.sort((a, b) => getPopularityScore(b) - getPopularityScore(a));
      
      case 'distance':
        if (!userCoordinates) return placesCopy;
        // Sort Nearest -> Furthest
        return placesCopy.sort((a, b) => {
          const distA = calculateDistance(userCoordinates.latitude, userCoordinates.longitude, a.lat, a.lng);
          const distB = calculateDistance(userCoordinates.latitude, userCoordinates.longitude, b.lat, b.lng);
          return distA - distB;
        });

      default:
        return placesCopy;
    }
  }, [data.places, sortBy, userCoordinates]);

  const renderTextFallback = () => {
    return data.text.split('\n').map((line, i) => (
      <p key={i} className="mb-2 text-slate-600">{line}</p>
    ));
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* Map Section */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-amber-100 h-[500px] relative group ring-4 ring-amber-500/10">
        {hasPlaces ? (
          <Map 
            places={sortedPlaces} 
            userLocation={userCoordinates}
            destination={selectedPlace}
            celebratingPlaceName={celebratingPlaceName}
            runPath={runMetrics.path}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 p-8 text-center">
             <div className="prose max-w-none">
               {renderTextFallback()}
             </div>
          </div>
        )}
        
        {/* Game Map Overlay */}
        {hasPlaces && (
          <div className="absolute top-4 right-4 bg-amber-900/90 text-amber-50 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border border-amber-700 text-sm font-bold z-[400] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            Corrida dos Tronos
          </div>
        )}

        {/* Strava-style Tracking HUD - Only shows when a destination is selected */}
        {selectedPlace && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-4 z-[500] transition-all duration-300">
            {!isTracking ? (
               <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Destino</p>
                    <p className="font-bold text-slate-800 truncate">{selectedPlace.name}</p>
                  </div>
                  <button 
                    onClick={startTracking}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                    COMEÇAR
                  </button>
               </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                   <div className="text-left">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tempo</p>
                      <p className="text-3xl font-black text-slate-800 font-mono tracking-tighter">
                        {formatTime(runMetrics.elapsedTimeSeconds)}
                      </p>
                   </div>
                   <div className="text-right">
                      <div className="flex items-center gap-1 justify-end text-emerald-600 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        <span className="text-xs font-bold uppercase">Gravando</span>
                      </div>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Distância</p>
                      <p className="text-2xl font-bold text-slate-700">
                        {runMetrics.distanceKm.toFixed(2)} <span className="text-sm font-normal text-slate-400">km</span>
                      </p>
                   </div>
                   <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Pace Médio</p>
                      <p className="text-2xl font-bold text-slate-700">
                        {runMetrics.currentPace} <span className="text-sm font-normal text-slate-400">/km</span>
                      </p>
                   </div>
                </div>

                <button 
                  onClick={stopTracking}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                   PARAR CORRIDA
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter/Sort Bar */}
      {hasPlaces && (
        <div className="flex flex-wrap items-center gap-3 pb-2 overflow-x-auto">
          <span className="text-sm font-semibold text-slate-500 mr-1">Ordenar por:</span>
          
          <button
            onClick={() => setSortBy('default')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              sortBy === 'default'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            Recomendados
          </button>

          <button
            onClick={() => setSortBy('difficulty')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border flex items-center gap-1.5 ${
              sortBy === 'difficulty'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20"/><path d="m16 16 2.5-2.5"/><path d="M12 20V4"/><path d="m4 16 2.5-2.5"/></svg>
            Dificuldade (Fácil primeiro)
          </button>

          <button
            onClick={() => setSortBy('popularity')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border flex items-center gap-1.5 ${
              sortBy === 'popularity'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            Popularidade
          </button>

          <button
            onClick={() => {
              if (userCoordinates) setSortBy('distance');
              else alert("É necessário ativar sua localização para ordenar por distância.");
            }}
            disabled={!userCoordinates}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border flex items-center gap-1.5 ${
              sortBy === 'distance'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={!userCoordinates ? "Ative o GPS para usar este filtro" : "Mais próximos primeiro"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            Distância
          </button>
        </div>
      )}

      {/* Places Cards */}
      {hasPlaces && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {sortedPlaces.map((place, idx) => (
            <div 
              key={`${place.name}-${idx}`} 
              className={`bg-white rounded-xl shadow-md overflow-hidden border transition-all cursor-pointer relative ${
                selectedPlace?.name === place.name 
                  ? 'border-amber-500 ring-2 ring-amber-200 transform scale-[1.01]' 
                  : 'border-slate-100 hover:border-amber-300 hover:shadow-lg'
              }`}
              onClick={() => setSelectedPlace(place)}
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-slate-50 to-amber-50 p-5 border-b border-amber-100">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏰</span>
                    <h3 className="font-bold text-xl text-slate-800">{place.name}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                     <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${
                      place.difficulty.toLowerCase().includes('iniciante') ? 'bg-emerald-100 text-emerald-700' :
                      place.difficulty.toLowerCase().includes('avançado') ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {place.difficulty}
                    </span>
                    {userCoordinates && (
                       <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                          {calculateDistance(userCoordinates.latitude, userCoordinates.longitude, place.lat, place.lng).toFixed(1)} km daqui
                       </span>
                    )}
                  </div>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed line-clamp-2">{place.summary}</p>
              </div>

              {/* Leaderboard Section */}
              <div className="p-5 bg-white">
                 <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                   Reis do Trono
                 </h4>
                 
                 <div className="space-y-2 mb-5">
                   {place.leaderboard?.slice(0, 1).map((entry, i) => (
                     <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-amber-50 border border-amber-100">
                       <div className="flex items-center gap-3">
                         <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-sm bg-amber-400 ring-2 ring-amber-200">
                           {entry.rank}
                         </div>
                         <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${entry.avatarColor}`}></div>
                           <span className="font-medium text-slate-900">
                             {entry.name}
                           </span>
                           <span className="text-amber-500 text-[10px]">👑</span>
                         </div>
                       </div>
                       <span className="text-xs font-semibold text-amber-700">{entry.visits} wins</span>
                     </div>
                   ))}
                   <div className="text-xs text-center text-slate-400 pt-1 italic">
                      + {place.leaderboard ? place.leaderboard.length - 1 : 0} outros competidores
                   </div>
                 </div>
              
                {/* Action Buttons */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 mt-auto pt-3 border-t border-slate-100">
                  
                  {/* Conquer Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRouteRequest(place);
                    }}
                    className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm py-2.5 rounded-lg transition-all shadow-sm hover:shadow-md font-medium px-4"
                  >
                    {isLocating && selectedPlace?.name === place.name ? (
                      <span>...</span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                           <path d="m5 12 7-7 7 7"/>
                           <path d="M12 19V5"/>
                        </svg>
                        <span>Rota</span>
                      </>
                    )}
                  </button>

                   {/* Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailsPlace(place);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all hover:scale-105 flex items-center gap-1 text-sm font-medium"
                    title="Ver Detalhes"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span className="hidden sm:inline">Detalhes</span>
                  </button>

                  {/* Maps Link */}
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center justify-center"
                    title="Ver no Google Maps"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Details */}
      {detailsPlace && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDetailsPlace(null)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden transform transition-all animate-fade-in-up flex flex-col max-h-[85vh]" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21h20V9l-4 3-2-6-4 3-4-3-2 6-4-3v12z"/></svg>
              </div>
              
              <button 
                onClick={() => setDetailsPlace(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors z-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              <h2 className="text-3xl font-bold mb-2 relative z-10 drop-shadow-sm">{detailsPlace.name}</h2>
              <div className="flex items-center gap-2 relative z-10">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm border border-white/20 shadow-sm">
                  {detailsPlace.difficulty}
                </span>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Top Section: Info & Map */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Text Info */}
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                          Briefing da Missão
                        </h3>
                        <p className="text-slate-700 leading-relaxed text-lg border-l-4 border-amber-200 pl-4 italic">
                          "{detailsPlace.summary}"
                        </p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                           Coordenadas Táticas
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-[10px] text-slate-400">LATITUDE</div>
                                <div className="font-mono font-bold text-slate-700">{detailsPlace.lat.toFixed(5)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400">LONGITUDE</div>
                                <div className="font-mono font-bold text-slate-700">{detailsPlace.lng.toFixed(5)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Mini Map */}
                <div className="h-48 md:h-full min-h-[200px] bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200 relative">
                    <MiniMap lat={detailsPlace.lat} lng={detailsPlace.lng} />
                    <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-slate-600 pointer-events-none border border-slate-300">
                        VISUALIZAÇÃO SATÉLITE
                    </div>
                </div>
              </div>

              {/* Bottom Section: Leaderboard */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm">
                 <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                   <span className="text-lg">🏆</span> Hall da Fama (Top 3)
                 </h3>
                 <div className="space-y-3">
                   {detailsPlace.leaderboard?.map((entry, i) => (
                     <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-slate-100 transition-transform hover:scale-[1.01]">
                        <div className="flex items-center gap-3">
                          <div className={`
                           w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md
                           ${entry.rank === 1 ? 'bg-gradient-to-br from-amber-400 to-amber-600 ring-2 ring-amber-200' : 
                             entry.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 ring-2 ring-slate-200' : 
                             'bg-gradient-to-br from-orange-700 to-orange-900 ring-2 ring-orange-200'}
                         `}>
                           {entry.rank}
                         </div>
                         <div>
                           <div className="font-bold text-slate-800 flex items-center gap-1">
                             {entry.name}
                             {entry.rank === 1 && <span className="text-amber-500 ml-1">👑</span>}
                           </div>
                           <div className="text-xs text-slate-500">Corredor de Elite</div>
                         </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-600">{entry.visits}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Conquistas</div>
                        </div>
                     </div>
                   ))}
                 </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
              <button 
                onClick={() => setDetailsPlace(null)}
                className="flex-1 py-3 px-4 bg-white border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Fechar
              </button>
              <button 
                onClick={() => handleRouteRequest(detailsPlace)}
                className="flex-[2] py-3 px-4 bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                Iniciar Rota Real
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sources Footer */}
      {data.groundingChunks && data.groundingChunks.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
          <p className="text-xs text-slate-400 mb-2">Locais verificados pelo oráculo (Google Maps)</p>
          <div className="flex flex-wrap justify-center gap-2">
            {data.groundingChunks.map((chunk, index) => {
              if (!chunk.maps) return null;
              return (
                <a 
                  key={index} 
                  href={chunk.maps.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-amber-600 hover:underline"
                >
                  {chunk.maps.title}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};