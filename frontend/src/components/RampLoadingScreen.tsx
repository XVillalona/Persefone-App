import React, { useState, useEffect } from 'react';
import {
  Plane,
  CheckCircle2,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Luggage,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  X,
  Radio,
  Compass
} from 'lucide-react';

export interface RampLoadingScreenProps {
  progress?: number;
  hub?: 'PUJ' | 'SDQ' | string;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
  onClose?: () => void;
  isSimulated?: boolean;
}

interface EquipmentStage {
  id: string;
  name: string;
  badge: string;
  threshold: number;
  icon: React.ReactNode;
  detail: string;
  color: string;
}

export const RampLoadingScreen: React.FC<RampLoadingScreenProps> = ({
  progress: externalProgress,
  hub = 'PUJ',
  title = 'Perséfone • Despacho de Turnaround en Rampa',
  subtitle = 'Sincronizando operaciones en tiempo real y auditando hoja de servicios',
  onComplete,
  onClose,
  isSimulated = false,
}) => {
  const [internalProgress, setInternalProgress] = useState<number>(externalProgress ?? 0);
  const [isPlaying, setIsPlaying] = useState<boolean>(isSimulated);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);

  // Use external progress if provided and not simulated
  const currentProgress = isSimulated ? internalProgress : (externalProgress ?? internalProgress);

  // Auto simulation loop if in simulation mode
  useEffect(() => {
    if (!isSimulated || !isPlaying) return;

    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 100) {
          setIsPlaying(false);
          if (onComplete) onComplete();
          return 100;
        }
        const next = Math.min(100, prev + 1);
        if (next === 100 && onComplete) {
          onComplete();
        }
        return next;
      });
    }, 50 / speedMultiplier);

    return () => clearInterval(interval);
  }, [isSimulated, isPlaying, speedMultiplier, onComplete]);

  // Keep internal progress updated if external changes
  useEffect(() => {
    if (!isSimulated && externalProgress !== undefined) {
      setInternalProgress(externalProgress);
      if (externalProgress >= 100 && onComplete) {
        onComplete();
      }
    }
  }, [externalProgress, isSimulated, onComplete]);

  const stages: EquipmentStage[] = [
    {
      id: 'chocks_cones',
      name: 'Calzos & Conos de Seguridad',
      badge: 'Fase 1: Bloqueo',
      threshold: 18,
      icon: <ShieldAlert className="w-4 h-4 text-amber-400" />,
      detail: 'Parímetro de seguridad delimitado y calzos en tren principal y nariz.',
      color: '#f59e0b',
    },
    {
      id: 'gpu_power',
      name: 'Unidad GPU 400Hz (Ground Power)',
      badge: 'Fase 2: Energía',
      threshold: 38,
      icon: <Zap className="w-4 h-4 text-emerald-400" />,
      detail: 'Cable 115V/400Hz energizado a receptáculo delantero; APU apagada.',
      color: '#10b981',
    },
    {
      id: 'stairs',
      name: 'Escalera Motorizada L1',
      badge: 'Fase 3: Pasaje',
      threshold: 60,
      icon: <Layers className="w-4 h-4 text-sky-400" />,
      detail: 'Pasarela telescópica acoplada a puerta L1 con barandas de seguridad.',
      color: '#0ea5e9',
    },
    {
      id: 'conveyor',
      name: 'Cinta Transportadora & Carros',
      badge: 'Fase 4: Equipajes',
      threshold: 82,
      icon: <Luggage className="w-4 h-4 text-purple-400" />,
      detail: 'Cinta activa en bodega de carga con carritos de maletas en rotación.',
      color: '#a855f7',
    },
    {
      id: 'pushback',
      name: 'Remolcador Pesado (Pushback Tug)',
      badge: 'Fase 5: Despacho',
      threshold: 100,
      icon: <Plane className="w-4 h-4 text-rose-400" />,
      detail: 'Barra de remolque conectada a tren de nariz; listo para retroceso.',
      color: '#f43f5e',
    },
  ];

  const getStatusText = (pct: number) => {
    if (pct < 18) return 'Aeronave en posición // Colocando calzos y conos de rampa';
    if (pct < 38) return 'Conectando GPU de tierra 400Hz // Suministro eléctrico activo';
    if (pct < 60) return 'Acoplando escalera de pasajeros en puerta delantera L1';
    if (pct < 82) return 'Operando cinta de equipajes // Carga y descarga de bodegas';
    if (pct < 100) return 'Conectando remolcador de empuje y barra de tiro (Pushback)';
    return 'Despacho de rampa finalizado // Aeronave autorizada para remolque';
  };

  const activeHubName = hub === 'SDQ' ? 'Las Américas (SDQ / MDSD)' : 'Punta Cana (PUJ / MDPC)';

  return (
    <div className="ramp-loading-overlay">
      {/* Background dark studio glow */}
      <div className="ramp-loading-backdrop">
        <div className="ramp-radial-glow" />
        <div className="ramp-grid-lines" />
      </div>

      {/* Main Container */}
      <div className="ramp-loading-modal">
        {/* Top Header Bar */}
        <div className="ramp-modal-header">
          <div className="ramp-header-left">
            <div className="ramp-brand-crest">
              <span className="ramp-brand-icon">
                <Plane className="w-5 h-5 text-sky-400 transform -rotate-45" />
              </span>
              <div>
                <div className="ramp-brand-title">
                  PERSÉFONE <span className="ramp-hub-pill">{hub}</span>
                </div>
                <div className="ramp-brand-sub">{title}</div>
              </div>
            </div>
          </div>

          <div className="ramp-header-right">
            <div className="ramp-telemetry-badge">
              <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
              <span>{activeHubName}</span>
            </div>
            <div className="ramp-telemetry-badge">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>RAMP OPS V2.0</span>
            </div>
            {onClose && (
              <button
                type="button"
                className="ramp-close-btn"
                onClick={onClose}
                title="Cerrar vista"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Central Visual Ramp Scene */}
        <div className="ramp-scene-container">
          {/* Base Airplane Image */}
          <div className="ramp-plane-wrapper">
            <img
              src="/arajet-ramp.jpg"
              alt="Arajet Boeing 737 MAX en Rampa"
              className="ramp-plane-img"
            />

            {/* Stage 1: Chocks & Safety Cones (Threshold >= 1) */}
            <div
              className={`gse-layer gse-chocks-cones ${
                currentProgress >= 5 ? 'visible' : ''
              }`}
            >
              {/* Nose gear chocks */}
              <div className="gse-item gse-chock-nose" title="Calzos de Tren de Nariz">
                <div className="chock-block left" />
                <div className="chock-rope" />
                <div className="chock-block right" />
              </div>

              {/* Main gear chocks */}
              <div className="gse-item gse-chock-main" title="Calzos de Tren Principal">
                <div className="chock-block left" />
                <div className="chock-rope" />
                <div className="chock-block right" />
              </div>

              {/* Safety Traffic Cones with reflective stripes */}
              <div className="gse-item gse-cone gse-cone-nose" title="Cono de Seguridad Nariz">
                <div className="cone-top" />
                <div className="cone-stripe" />
                <div className="cone-base" />
              </div>

              <div className="gse-item gse-cone gse-cone-engine" title="Cono de Seguridad Motor CFM LEAP-1B">
                <div className="cone-top" />
                <div className="cone-stripe" />
                <div className="cone-base" />
              </div>

              <div className="gse-item gse-cone gse-cone-wingtip" title="Cono de Seguridad Extremo de Ala">
                <div className="cone-top" />
                <div className="cone-stripe" />
                <div className="cone-base" />
              </div>
            </div>

            {/* Stage 2: Ground Power Unit (GPU 400Hz) (Threshold >= 20) */}
            <div
              className={`gse-layer gse-gpu-layer ${
                currentProgress >= 20 ? 'visible' : ''
              }`}
            >
              <div className="gse-gpu-cart" title="Planta Eléctrica de Tierra GPU 400Hz">
                <div className="gpu-chassis">
                  <div className="gpu-roof-stripe" />
                  <div className="gpu-control-panel">
                    <span className="gpu-led green animate-pulse" />
                    <span className="gpu-voltage">115V 400Hz</span>
                  </div>
                  <div className="gpu-vent-grid">
                    <span /><span /><span />
                  </div>
                  <div className="gpu-wheels">
                    <span className="wheel w-left" />
                    <span className="wheel w-right" />
                  </div>
                  <div className="gpu-beacon animate-beacon" />
                </div>
                {/* Yellow/Black industrial power umbilical cable to aircraft nose */}
                <svg className="gpu-power-cable" viewBox="0 0 200 100">
                  <path
                    d="M 20 60 Q 90 95 180 20"
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="3.5"
                    strokeDasharray="6 3"
                    className="cable-pulse"
                  />
                </svg>
                <div className="gpu-aircraft-plug" title="Conexión Receptáculo Avión">
                  <span className="plug-spark" />
                </div>
              </div>
            </div>

            {/* Stage 3: Passenger Boarding Stairs (Threshold >= 40) */}
            <div
              className={`gse-layer gse-stairs-layer ${
                currentProgress >= 40 ? 'visible' : ''
              }`}
            >
              <div className="gse-stairs-vehicle" title="Escalera Autopropulsada Puerta L1">
                {/* Upper Docking Platform at Door L1 */}
                <div className="stairs-platform">
                  <div className="stairs-canopy" />
                  <div className="stairs-bumper" />
                  <div className="stairs-green-dock-light animate-ping-slow" />
                </div>

                {/* Stair Flight Steps */}
                <div className="stairs-flight">
                  <div className="stairs-railing left" />
                  <div className="stairs-steps-grid">
                    <span className="step-tread s1" />
                    <span className="step-tread s2" />
                    <span className="step-tread s3" />
                    <span className="step-tread s4" />
                    <span className="step-tread s5" />
                    <span className="step-tread s6" />
                  </div>
                  <div className="stairs-railing right" />
                </div>

                {/* Lower Vehicle Truck Chassis */}
                <div className="stairs-truck-base">
                  <div className="truck-cab">
                    <div className="cab-window" />
                  </div>
                  <div className="truck-wheels">
                    <span className="truck-wheel tw1" />
                    <span className="truck-wheel tw2" />
                  </div>
                  <div className="stairs-beacon animate-beacon" />
                </div>
              </div>
            </div>

            {/* Stage 4: Baggage Belt Loader & Baggage Train (Threshold >= 60) */}
            <div
              className={`gse-layer gse-baggage-layer ${
                currentProgress >= 60 ? 'visible' : ''
              }`}
            >
              {/* Conveyor Belt Loader */}
              <div className="gse-belt-loader" title="Cinta Transportadora de Equipaje (Belt Loader)">
                <div className="belt-boom">
                  <div className="belt-surface">
                    {/* Animated moving luggage pieces */}
                    <div className="belt-luggage l1" />
                    <div className="belt-luggage l2" />
                    <div className="belt-luggage l3" />
                  </div>
                  <div className="belt-handrail" />
                </div>
                <div className="belt-support-chassis">
                  <div className="belt-wheels">
                    <span className="b-wheel bw1" />
                    <span className="b-wheel bw2" />
                  </div>
                </div>
              </div>

              {/* Airport Baggage Carts Train */}
              <div className="gse-baggage-train" title="Carros de Equipaje">
                <div className="baggage-cart cart1">
                  <div className="cart-cover" />
                  <div className="cart-tubs">
                    <span className="tub t1" />
                    <span className="tub t2" />
                  </div>
                  <div className="cart-wheels">
                    <span className="cw cw1" />
                    <span className="cw cw2" />
                  </div>
                </div>
                <div className="baggage-cart cart2">
                  <div className="cart-cover" />
                  <div className="cart-tubs">
                    <span className="tub t3" />
                  </div>
                  <div className="cart-wheels">
                    <span className="cw cw1" />
                    <span className="cw cw2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 5: Heavy Pushback Tug & Towbar (Threshold >= 80) */}
            <div
              className={`gse-layer gse-pushback-layer ${
                currentProgress >= 80 ? 'visible' : ''
              }`}
            >
              <div className="gse-pushback-rig" title="Remolcador Pesado de Empuje (Pushback Tug)">
                {/* Heavy Duty Tractor Chassis */}
                <div className="pushback-tug-body">
                  <div className="tug-cab">
                    <div className="tug-windshield" />
                    <div className="tug-driver-silhouette" />
                  </div>
                  <div className="tug-warning-stripe" />
                  <div className="tug-beacon animate-beacon" />
                  <div className="tug-headlights">
                    <span className="beam left" />
                    <span className="beam right" />
                  </div>
                  <div className="tug-heavy-wheels">
                    <span className="tw-heavy twh1" />
                    <span className="tw-heavy twh2" />
                  </div>
                </div>

                {/* Steel Towbar connected to Boeing 737 nose gear */}
                <div className="pushback-towbar">
                  <div className="towbar-shaft" />
                  <div className="towbar-wheels" />
                  <div className="towbar-shear-pin" title="Pin de Bloqueo / Seguridad Conforme" />
                </div>

                {/* Ramp Marshaller Headset Operator */}
                <div className="ramp-marshaller-signal" title="Operador de Rampa: Señal Conforme">
                  <div className="marshaller-figure">
                    <span className="marshaller-headset" />
                    <span className="marshaller-vest" />
                    <span className="marshaller-wand left animate-wand" />
                    <span className="marshaller-wand right animate-wand" />
                  </div>
                </div>
              </div>
            </div>

            {/* Aeronautical HUD Reticle & Stage Indicators */}
            <div className="ramp-hud-reticle">
              <div className="hud-corner top-left" />
              <div className="hud-corner top-right" />
              <div className="hud-corner bottom-left" />
              <div className="hud-corner bottom-right" />

              <div className="hud-info-badge">
                <span className="hud-dot animate-ping" />
                <span className="hud-label">ESTADO:</span>
                <span className="hud-val">{getStatusText(currentProgress)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar & Real-time Metrics */}
        <div className="ramp-progress-section">
          <div className="ramp-progress-meta">
            <div className="ramp-meta-left">
              <div className="ramp-status-headline">
                {currentProgress < 100 ? (
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
                    {getStatusText(currentProgress)}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    DESPACHO DE RAMPA 100% COMPLETADO • LISTO PARA VUELO
                  </span>
                )}
              </div>
              <div className="ramp-status-sub">{subtitle}</div>
            </div>

            <div className="ramp-meta-right">
              <div className="ramp-percentage-display">
                <span className="pct-num">{Math.round(currentProgress)}</span>
                <span className="pct-symbol">%</span>
              </div>
            </div>
          </div>

          {/* Glowing Animated Progress Bar */}
          <div className="ramp-progress-track">
            <div
              className="ramp-progress-fill"
              style={{ width: `${currentProgress}%` }}
            >
              <div className="ramp-progress-flare" />
              <div className="ramp-progress-particles" />
            </div>

            {/* Stage Milestone Markers along track */}
            {stages.map((st) => (
              <div
                key={st.id}
                className={`ramp-milestone-marker ${
                  currentProgress >= st.threshold ? 'passed' : ''
                }`}
                style={{ left: `${st.threshold}%` }}
                title={`${st.name} (${st.threshold}%)`}
              >
                <div className="marker-pin" />
                <span className="marker-label">{st.threshold}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5 Ground Equipment Stages Checklist */}
        <div className="ramp-stages-grid">
          {stages.map((st, idx) => {
            const isCompleted = currentProgress >= st.threshold;
            const isCurrent =
              currentProgress < st.threshold &&
              (idx === 0 || currentProgress >= stages[idx - 1].threshold);

            return (
              <div
                key={st.id}
                className={`ramp-stage-card ${
                  isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'
                }`}
              >
                <div className="stage-card-header">
                  <div className="stage-icon-wrap">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      st.icon
                    )}
                  </div>
                  <span className="stage-badge">{st.badge}</span>
                </div>
                <div className="stage-name">{st.name}</div>
                <div className="stage-detail">{st.detail}</div>
                <div className="stage-status-indicator">
                  {isCompleted ? (
                    <span className="status-label done">Acoplado Conforme</span>
                  ) : isCurrent ? (
                    <span className="status-label active animate-pulse">En Proceso...</span>
                  ) : (
                    <span className="status-label waiting">En Espera ({st.threshold}%)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Interactive Simulation Controls (When in preview or simulation mode) */}
        {isSimulated && (
          <div className="ramp-sim-controls">
            <div className="sim-controls-left">
              <span className="sim-title">
                <Sparkles className="w-4 h-4 text-amber-400 inline mr-1" />
                Simulador de Turnaround
              </span>
              <span className="sim-sub">Controla la velocidad y prueba la animación</span>
            </div>

            <div className="sim-controls-center">
              <button
                type="button"
                className="sim-btn"
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? 'Pausar' : 'Reanudar'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pausar' : 'Iniciar'}
              </button>

              <button
                type="button"
                className="sim-btn"
                onClick={() => {
                  setInternalProgress(0);
                  setIsPlaying(true);
                }}
                title="Reiniciar desde 0%"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar
              </button>

              <div className="sim-speed-group">
                {[1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    className={`sim-speed-btn ${speedMultiplier === spd ? 'active' : ''}`}
                    onClick={() => setSpeedMultiplier(spd)}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-controls-right">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(currentProgress)}
                onChange={(e) => setInternalProgress(Number(e.target.value))}
                className="sim-slider"
              />
              <span className="sim-slider-val">{Math.round(currentProgress)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
