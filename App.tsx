
import React, { useState, useCallback } from 'react';
import { fetchRunningRoutes } from './services/geminiService';
import { GeminiResponseData, LoadingState, Coordinates } from './types';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ResultDisplay } from './components/ResultDisplay';
import { RunHistory } from './components/RunHistory';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [data, setData] = useState<GeminiResponseData | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() && !coordinates) return;

    setStatus(LoadingState.LOADING);
    setErrorMsg(null);
    setData(null);

    try {
      // Determine what string to pass to the API
      const searchLocation = query || "minha localização atual";
      const result = await fetchRunningRoutes(searchLocation, coordinates);
      setData(result);
      setStatus(LoadingState.SUCCESS);
    } catch (error) {
      console.error(error);
      setStatus(LoadingState.ERROR);
      setErrorMsg("Ocorreu um erro ao buscar rotas reais. Tente novamente.");
    }
  }, [query, coordinates]);

  const handleGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocalização não é suportada pelo seu navegador.");
      return;
    }

    setStatus(LoadingState.LOADING);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setCoordinates(coords);
        setQuery("Minha Posição"); // Update UI input for clarity
        
        // Trigger search immediately with coords
        fetchRunningRoutes("minha localização atual", coords)
          .then(result => {
            setData(result);
            setStatus(LoadingState.SUCCESS);
          })
          .catch(err => {
            console.error(err);
            setStatus(LoadingState.ERROR);
            setErrorMsg("Falha ao buscar domínios de corrida para sua localização.");
          });
      },
      (error) => {
        console.error("Geolocation error:", error);
        setStatus(LoadingState.IDLE);
        let msg = "Não foi possível obter sua localização.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Acesso ao GPS negado. Digite sua localização manualmente.";
        }
        setErrorMsg(msg);
      }
    );
  }, []);

  // Helper to update coordinates from ResultDisplay if user grants permission later
  const updateCoordinates = (coords: Coordinates) => {
    setCoordinates(coords);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header / Hero - Imperial Red/Amber Theme */}
      <header className="bg-gradient-to-r from-amber-600 to-orange-700 text-white pb-12 pt-8 px-4 shadow-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md border border-white/30 shadow-inner">
                {/* Crown Logo */}
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z"/>
                  <path d="M12 17H12.01"/>
                </svg>
             </div>
             <div>
               <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase italic">Corrida dos Tronos</h1>
               <p className="text-amber-100 text-sm font-medium">Onde os corredores viram reis</p>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4 -mt-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Search Card */}
          <div className="bg-white rounded-xl shadow-lg p-2 md:p-4 border border-slate-100 flex flex-col md:flex-row gap-2">
            <button
              onClick={handleGeolocation}
              type="button"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold transition-colors md:w-auto w-full whitespace-nowrap border border-amber-200"
              title="Detectar minha posição"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
                <line x1="12" y1="2" x2="12" y2="5"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="5" y2="12"/>
                <line x1="19" y1="12" x2="22" y2="12"/>
              </svg>
              <span className="md:hidden">Radar GPS</span>
            </button>
            
            <form onSubmit={handleSearch} className="flex-grow flex gap-2">
              <input
                type="text"
                placeholder="Qual reino deseja explorar? (Ex: Ibirapuera, SP)"
                className="flex-grow px-4 py-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="submit"
                disabled={status === LoadingState.LOADING}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-black uppercase transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px] shadow-lg shadow-amber-200"
              >
                {status === LoadingState.LOADING ? (
                   <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  "Explorar"
                )}
              </button>
            </form>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-start gap-3 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Initial State / Empty State */}
          {status === LoadingState.IDLE && !data && (
            <>
              <div className="text-center py-12 text-slate-400">
                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-100">
                   <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-700 mb-2">Seu trono aguarda...</h2>
                <p className="max-w-md mx-auto mb-8 text-slate-500">Mapeie os domínios de corrida ao seu redor e descubra quem são os atuais reis de cada pista.</p>
              </div>
              
              <RunHistory />
            </>
          )}

          {/* Loading State */}
          {status === LoadingState.LOADING && <LoadingSpinner />}

          {/* Results */}
          {status === LoadingState.SUCCESS && data && (
            <div className="animate-fade-in-up pb-12">
              <ResultDisplay 
                data={data} 
                userCoordinates={coordinates} 
                onUpdateCoordinates={updateCoordinates}
              />
            </div>
          )}
        </div>
      </main>
      
      <footer className="bg-white border-t border-slate-200 mt-auto py-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm font-medium">&copy; {new Date().getFullYear()} Corrida dos Tronos. Inteligência Artificial integrada ao Reino de Google Maps.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
