import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-emerald-200 rounded-full animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
      <p className="text-emerald-800 font-medium animate-pulse">Encontrando as melhores pistas...</p>
    </div>
  );
};