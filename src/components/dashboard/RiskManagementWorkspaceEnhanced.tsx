'use client';

import { useState } from 'react';
import RiskManagementWorkspace from './RiskManagementWorkspace';
import DynamicRiskEngineWorkspace from './DynamicRiskEngineWorkspace';

type RiskTab = 'exposure' | 'dynamic-engine';

export default function RiskManagementWorkspaceEnhanced() {
  const [activeTab, setActiveTab] = useState<RiskTab>('exposure');

  const tabs: { id: RiskTab; label: string; icon: string }[] = [
    { id: 'exposure', label: 'Exposure Map', icon: '📊' },
    { id: 'dynamic-engine', label: 'Dynamic Risk Engine', icon: '⚙️' },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-mono text-sm font-semibold uppercase tracking-[0.16em] transition ${
              activeTab === tab.id
                ? 'border-b-2 border-emerald-400 text-emerald-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'exposure' && <RiskManagementWorkspace />}
        {activeTab === 'dynamic-engine' && <DynamicRiskEngineWorkspace />}
      </div>
    </div>
  );
}
