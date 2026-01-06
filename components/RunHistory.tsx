import React, { useEffect, useState } from 'react';
import { RunHistoryEntry } from '../types';
import { formatTime } from '../utils/geoUtils';

export const RunHistory: React.FC = () => {
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);

  useEffect(() => {
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem('runHistory');
        if (stored) {
          const parsed: RunHistoryEntry[] = JSON.parse(stored);
          // Sort by date descending (newest first)
          setHistory(parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
      } catch (error) {
        console.error("Failed to load run history", error);
      }
    };

    loadHistory();
  }, []);

  if (history.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4 px-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
        </svg>
        <h2 className="text-lg font-bold text-slate-700 uppercase tracking-wider">Suas Conquistas Recentes</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {history.map((entry) => (
          <div key={entry.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
            {/* Header */}
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{entry.placeName}</h3>
                <p className="text-xs text-slate-400">{formatDate(entry.date)}</p>
              </div>
              <div className="bg-emerald-50 text-emerald-700 p-1.5 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Distância</div>
                <div className="text-slate-800 font-bold font-mono">
                  {entry.metrics.distanceKm.toFixed(2)} <span className="text-xs font-normal">km</span>
                </div>
              </div>
              
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Tempo</div>
                <div className="text-slate-800 font-bold font-mono">
                  {formatTime(entry.metrics.elapsedTimeSeconds)}
                </div>
              </div>

              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Pace</div>
                <div className="text-slate-800 font-bold font-mono">
                  {entry.metrics.currentPace}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
