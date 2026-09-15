import React, { useState } from 'react';
import { PhotoHeadStudio } from './PhotoHeadStudio';
import { ProceduralGenerator } from './ProceduralGenerator';
import { ModelInspector } from './ModelInspector';
import { Camera, Box, Search } from 'lucide-react';

interface AppTabsProps {
  basePath?: string;
}

export const AppTabs: React.FC<AppTabsProps> = ({ basePath = '' }) => {
  const [activeTab, setActiveTab] = useState<'loomis' | 'procedural' | 'inspector'>('loomis');

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('loomis')}
          className={`flex items-center gap-2 px-5 py-3 m-3 rounded-xl font-bold text-sm transition-all border ${
            activeTab === 'loomis'
              ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-lg shadow-sky-950/40'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Camera className="w-4 h-4" /> 📸 Photo to 3D Loomis Studio
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('procedural')}
          className={`flex items-center gap-2 px-5 py-3 m-3 rounded-xl font-bold text-sm transition-all border ${
            activeTab === 'procedural'
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-950/40'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Box className="w-4 h-4" /> 🔮 3D Primative Generator
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inspector')}
          className={`flex items-center gap-2 px-5 py-3  m-3 rounded-xl font-bold text-sm transition-all border ${
            activeTab === 'inspector'
              ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-lg shadow-purple-950/40'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Search className="w-4 h-4" /> 📂 Model Viewer & Inspector
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'loomis' && <PhotoHeadStudio basePath={basePath} />}
      {activeTab === 'procedural' && <ProceduralGenerator />}
      {activeTab === 'inspector' && <ModelInspector />}
    </div>
  );
};

