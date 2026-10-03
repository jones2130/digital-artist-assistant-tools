import React, { useState } from 'react';
import { PhotoHeadStudio } from './PhotoHeadStudio';
import { PhotoHandStudio } from './PhotoHandStudio';
import { ProceduralGenerator } from './ProceduralGenerator';
import { ModelInspector } from './ModelInspector';
import { PaletteStudio } from './PaletteStudio';
import { Camera, Hand, Box, Search } from 'lucide-react';

interface AppTabsProps {
  basePath?: string;
}

type TabKey = 'loomis' | 'hand' | 'procedural' | 'inspector' | 'palette';

const VALID_TABS: Record<string, TabKey> = {
  loomis: 'loomis',
  hand: 'hand',
  palette: 'palette',
  procedural: 'procedural',
  inspector: 'inspector',
};

export const AppTabs: React.FC<AppTabsProps> = ({ basePath = '' }) => {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (VALID_TABS[hash]) return VALID_TABS[hash];
    }
    return 'loomis';
  });

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (VALID_TABS[hash]) {
        setActiveTab(VALID_TABS[hash]);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabClick = (tab: TabKey) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${tab}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Tabs */}
      <div className="flex flex-col md:flex-row flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => handleTabClick('loomis')}
          className={`w-full md:w-auto flex items-center justify-center md:justify-start gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border ${
            activeTab === 'loomis'
              ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-lg shadow-sky-950/40'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          📸 Photo to 3D Loomis Studio
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('hand')}
          className={`w-full md:w-auto flex items-center justify-center md:justify-start gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border ${
            activeTab === 'hand'
              ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-lg shadow-sky-950/40'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          🖐️ Photo to 3D Hand Studio
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('palette')}
          className={`w-full md:w-auto flex items-center justify-center md:justify-start gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border ${
            activeTab === 'palette'
              ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-lg shadow-amber-950/40'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          🎨 Pigment & Palette Studio
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('procedural')}
          className={`w-full md:w-auto flex items-center justify-center md:justify-start gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border ${
            activeTab === 'procedural'
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-950/40'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          🔮 3D Primative Generator
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('inspector')}
          className={`w-full md:w-auto flex items-center justify-center md:justify-start gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border ${
            activeTab === 'inspector'
              ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-lg shadow-purple-950/40'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          📂 Model Viewer & Inspector
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'loomis' && <PhotoHeadStudio basePath={basePath} />}
      {activeTab === 'hand' && <PhotoHandStudio basePath={basePath} />}
      {activeTab === 'palette' && <PaletteStudio />}
      {activeTab === 'procedural' && <ProceduralGenerator />}
      {activeTab === 'inspector' && <ModelInspector />}
    </div>
  );
};
