import React from 'react';
import { MapPin, Check } from 'lucide-react';

export interface HubInfo {
  code: 'PUJ' | 'SDQ';
  icao: string;
  name: string;
  city: string;
  status: 'OPERACIONAL' | 'ALERTA';
  turnaroundsToday: number;
  totalBilled: number;
}

interface HubSelectorProps {
  currentHub: 'PUJ' | 'SDQ';
  onHubChange: (hub: 'PUJ' | 'SDQ') => void;
  hubSummary?: {
    PUJ?: { total_ordenes: number; total_usd: number };
    SDQ?: { total_ordenes: number; total_usd: number };
  };
  compact?: boolean;
}

export const HUBS_DATA: Record<'PUJ' | 'SDQ', HubInfo> = {
  PUJ: {
    code: 'PUJ',
    icao: 'MDPC',
    name: 'Aeropuerto Internacional de Punta Cana',
    city: 'Punta Cana, La Altagracia',
    status: 'OPERACIONAL',
    turnaroundsToday: 10,
    totalBilled: 12450.0,
  },
  SDQ: {
    code: 'SDQ',
    icao: 'MDSD',
    name: 'Aeropuerto Internacional Las Américas',
    city: 'Santo Domingo, Distrito Nacional',
    status: 'OPERACIONAL',
    turnaroundsToday: 0,
    totalBilled: 0.0,
  },
};

export const HubSelector: React.FC<HubSelectorProps> = ({
  currentHub,
  onHubChange,
  hubSummary,
  compact = false,
}) => {
  const pujCount = hubSummary?.PUJ?.total_ordenes ?? HUBS_DATA.PUJ.turnaroundsToday;
  const sdqCount = hubSummary?.SDQ?.total_ordenes ?? HUBS_DATA.SDQ.turnaroundsToday;

  if (compact) {
    return (
      <div className="hub-selector-compact">
        {(['PUJ', 'SDQ'] as const).map((code) => {
          const isSelected = currentHub === code;
          const count = code === 'PUJ' ? pujCount : sdqCount;

          return (
            <button
              key={code}
              type="button"
              className={`hub-pill-btn ${isSelected ? 'active' : ''}`}
              onClick={() => onHubChange(code)}
            >
              <span className="hub-code">{code}</span>
              <span className="hub-count">{count}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="hub-selector-container">
      <div className="hub-selector-label">
        <MapPin className="w-3.5 h-3.5 text-sky-400 inline mr-1" />
        ESTACIÓN / HUB ACTIVO:
      </div>

      <div className="hub-cards-grid">
        {(['PUJ', 'SDQ'] as const).map((code) => {
          const hub = HUBS_DATA[code];
          const isSelected = currentHub === code;
          const orderCount = code === 'PUJ' ? pujCount : sdqCount;
          const billedUsd =
            code === 'PUJ'
              ? (hubSummary?.PUJ?.total_usd ?? hub.totalBilled)
              : (hubSummary?.SDQ?.total_usd ?? hub.totalBilled);

          return (
            <div
              key={code}
              className={`hub-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onHubChange(code)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onHubChange(code);
              }}
            >
              <div className="hub-card-header">
                <div className="hub-badge-group">
                  <span className="hub-iata">{code}</span>
                  <span className="hub-icao">{hub.icao}</span>
                </div>

                <div className="hub-status-pill">
                  <span className="pulse-indicator" />
                  {hub.status}
                </div>
              </div>

              <div className="hub-name">{hub.name}</div>
              <div className="hub-city">{hub.city}</div>

              <div className="hub-stats-row">
                <div className="hub-stat-item">
                  <span className="stat-label">Órdenes Lote:</span>
                  <span className="stat-val font-mono">{orderCount}</span>
                </div>
                <div className="hub-stat-item">
                  <span className="stat-label">Total Auditado:</span>
                  <span className="stat-val font-mono">${billedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {isSelected && (
                <div className="hub-active-banner">
                  <Check className="w-3.5 h-3.5" /> HUB SELECCIONADO
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
