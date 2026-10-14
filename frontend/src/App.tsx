import { useState, useEffect } from 'react';
import {
  Plane, UploadCloud, Calendar, Search, AlertTriangle,
  CheckCircle2, Clock, DollarSign, FileText, Settings, ShieldCheck,
  ZoomIn, ZoomOut, RotateCcw, AlertOctagon,
  TrendingUp, Download, Eye, X, Sparkles, MapPin, Trash2,
  Volume2, Wind, ListFilter, LayoutGrid, Compass
} from 'lucide-react';
import { RampLoadingScreen } from './components/RampLoadingScreen';
import { HubSelector, HUBS_DATA } from './components/HubSelector';

function playAirportChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First chime note: F5 (698.46 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(698.46, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.55);

    // Second chime note: C5 (523.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, now + 0.28);
    gain2.gain.setValueAtTime(0.25, now + 0.28);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.28);
    osc2.stop(now + 1.1);
  } catch {
    // Audio context not allowed or blocked
  }
}

function SplitFlapText({
  text,
  className = '',
  color = 'amber'
}: {
  text: string;
  className?: string;
  color?: 'amber' | 'white' | 'cyan';
}) {
  if (!text) return null;
  return (
    <span className={`split-flap-word ${className}`}>
      {text.split('').map((char, i) => (
        <span key={i} className={`split-flap-tile ${color}`}>
          {char}
        </span>
      ))}
    </span>
  );
}

interface CostLine {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  total: number;
  regla: string;
  es_adicional: boolean;
}

interface AlertItem {
  tipo: string;
  codigo: string;
  descripcion: string;
  clausula: string;
  monto: number;
}

interface OrderCalculation {
  numero_orden: string;
  aerolinea: string;
  matricula: string;
  tipo_aeronave: string;
  vuelo_entrante: string;
  vuelo_saliente: string;
  llegada: string;
  salida: string;
  tiempo_en_tierra_min: number;
  tiempo_incluido_min: number;
  excede_turnaround: boolean;
  exceso_tiempo_min: number;
  costo_base: number;
  costo_adicionales: number;
  costo_total_esperado: number;
  lineas_costo: CostLine[];
  alertas: AlertItem[];
  estado: 'CONFORME' | 'CON_ADICIONALES' | 'INCONSISTENTE' | 'REVISAR';
}

interface OrderRecord {
  id: number;
  numero_orden: string;
  pagina: number;
  fecha_agrupacion: string;
  aerolinea: string;
  matricula: string;
  tipo_aeronave: string;
  posicion: string;
  vuelo_entrante: string;
  vuelo_saliente: string;
  llegada: string;
  salida: string;
  estado: 'CONFORME' | 'CON_ADICIONALES' | 'INCONSISTENTE' | 'REVISAR';
  costo_base: number;
  costo_adicionales: number;
  costo_total_esperado: number;
  tiempo_en_tierra_min: number;
  excede_turnaround: boolean;
  confianza_promedio: number;
  validada: boolean;
  hub?: string;
  imagen_path?: string;
  calculation: OrderCalculation;
  data: any;
}

export function App() {
  const [activeTab, setActiveTab] = useState<'diario' | 'subir' | 'kpi' | 'ajustes'>('diario');
  const [currentHub, setCurrentHub] = useState<'PUJ' | 'SDQ'>('PUJ');
  const [hubSummary, setHubSummary] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'fids' | 'stands'>('fids');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // No mostrar datos en pantalla de inicio hasta que el usuario seleccione una fecha
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  
  // Modal / Split-View
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [editedData, setEditedData] = useState<any>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Ramp Loading Screen Modal (Real upload or simulated preview)
  const [showRampScreen, setShowRampScreen] = useState(false);
  const [rampProgress, setRampProgress] = useState(0);
  const [rampTitle, setRampTitle] = useState('Perséfone • Despacho de Turnaround');
  const [rampSubtitle, setRampSubtitle] = useState('Sincronizando operaciones de rampa');
  const [rampIsSimulated, setRampIsSimulated] = useState(false);

  // KPI & Tariffs
  const [kpiData, setKpiData] = useState<any>(null);
  const [tariffsJsonText, setTariffsJsonText] = useState('');

  // Gestión y Eliminación de Fechas / Lotes
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);
  const [isDeletingDate, setIsDeletingDate] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // 1. Cargar Hub Summary y fechas disponibles
  const fetchHubSummary = async () => {
    try {
      const res = await fetch('/api/hubs');
      if (res.ok) {
        const hs = await res.json();
        setHubSummary(hs);
      }
    } catch (e) {
      console.error("Error fetching hubs:", e);
    }
  };

  const fetchDatesAndOrders = async (targetHub = currentHub, targetDate = selectedDate) => {
    try {
      const resDates = await fetch(`/api/dates?hub=${targetHub}`);
      if (resDates.ok) {
        const d = await resDates.json();
        setAvailableDates(d);
      }
      
      // Si hay una fecha seleccionada no vacía, buscar las órdenes
      if (targetDate && targetDate.trim() !== '') {
        const resOrders = await fetch(`/api/orders?fecha=${targetDate}&hub=${targetHub}`);
        if (resOrders.ok) {
          const o = await resOrders.json();
          setOrders(o);
        }
      } else {
        // Pantalla inicial limpia sin órdenes hasta seleccionar fecha
        setOrders([]);
      }
    } catch (e) {
      console.error("Error fetching data:", e);
    }
  };

  const handleDeleteDate = async (fecha: string) => {
    if (!fecha) return;
    setIsDeletingDate(true);
    try {
      const res = await fetch(`/api/dates/${fecha}?hub=${currentHub}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const result = await res.json();
        setDeleteNotice(`Lote del ${fecha} eliminado exitosamente (${result.deleted_count} órdenes removidas). Ya puedes volver a cargar.`);
        setDateToDelete(null);
        if (selectedDate === fecha) {
          setSelectedDate('');
        }
        await fetchHubSummary();
        await fetchDatesAndOrders(currentHub, selectedDate === fecha ? '' : selectedDate);
        setTimeout(() => setDeleteNotice(null), 6000);
      } else {
        alert('Error al intentar eliminar las órdenes de la fecha seleccionada.');
      }
    } catch (err) {
      console.error("Error deleting date:", err);
      alert('Error de conexión con el servidor al eliminar la fecha.');
    } finally {
      setIsDeletingDate(false);
    }
  };

  useEffect(() => {
    fetchHubSummary();
    fetchDatesAndOrders(currentHub, selectedDate);
  }, [currentHub, selectedDate]);

  useEffect(() => {
    // Cargar KPI y tarifas al montar o cambiar HUB
    fetch(`/api/kpi?hub=${currentHub}`).then(r => r.json()).then(setKpiData).catch(console.error);
    fetch('/api/tariffs').then(r => r.json()).then(t => {
      setTariffsJsonText(JSON.stringify(t, null, 2));
    }).catch(console.error);
  }, [currentHub]);

  // Filtrado reactivo de órdenes
  useEffect(() => {
    let res = [...orders];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(o => 
        o.numero_orden.toLowerCase().includes(q) ||
        (o.matricula || '').toLowerCase().includes(q) ||
        (o.vuelo_entrante || '').toLowerCase().includes(q) ||
        (o.vuelo_saliente || '').toLowerCase().includes(q) ||
        (o.posicion || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'TODOS') {
      res = res.filter(o => o.estado === statusFilter);
    }
    setFilteredOrders(res);
  }, [orders, searchQuery, statusFilter]);

  // Selección de orden para ver detalle
  const handleOpenDetail = (order: OrderRecord) => {
    setSelectedOrder(order);
    setEditedData(JSON.parse(JSON.stringify(order.data)));
    setZoomLevel(1);
  };

  // Recálculo en vivo al editar campos
  const handleFieldChange = async (field: string, val: any) => {
    if (!selectedOrder || !editedData) return;
    const updated = { ...editedData, [field]: val };
    setEditedData(updated);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.numero_orden}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const respJson = await res.json();
        // Actualizar en el estado local
        const updatedRecord: OrderRecord = {
          ...selectedOrder,
          data: updated,
          calculation: respJson.calculation,
          estado: respJson.calculation.estado,
          costo_base: respJson.calculation.costo_base,
          costo_adicionales: respJson.calculation.costo_adicionales,
          costo_total_esperado: respJson.calculation.costo_total_esperado,
          tiempo_en_tierra_min: respJson.calculation.tiempo_en_tierra_min,
          excede_turnaround: respJson.calculation.excede_turnaround
        };
        setSelectedOrder(updatedRecord);
        setOrders(prev => prev.map(o => o.numero_orden === selectedOrder.numero_orden ? updatedRecord : o));
      }
    } catch (e) {
      console.error("Error updating order:", e);
    }
  };

  const handleValidateOrder = async () => {
    if (!selectedOrder) return;
    setSavingOrder(true);
    try {
      await fetch(`/api/orders/${selectedOrder.numero_orden}/validate`, { method: 'POST' });
      setSelectedOrder({ ...selectedOrder, validada: true });
      setOrders(prev => prev.map(o => o.numero_orden === selectedOrder.numero_orden ? { ...o, validada: true } : o));
    } catch (e) {
      console.error("Error validating:", e);
    } finally {
      setSavingOrder(false);
    }
  };

  // Subida de PDF con Pantalla de Carga de Rampa Progresiva
  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.endsWith('.pdf')) {
      alert("Por favor selecciona un archivo PDF válido.");
      return;
    }

    setRampIsSimulated(false);
    setRampProgress(10);
    setRampTitle(`Perséfone • Procesando Lote de Rampa en HUB ${currentHub}`);
    setRampSubtitle(`Rasterizando páginas de ${file.name} a 200 DPI y extrayendo órdenes...`);
    setShowRampScreen(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('hub', currentHub);

    // Animación visual de progreso por fases
    const progInterval = setInterval(() => {
      setRampProgress((prev) => {
        if (prev < 35) {
          setRampSubtitle("Conectando GPU 400Hz y analizando formularios de rampa...");
          return prev + 5;
        } else if (prev < 65) {
          setRampSubtitle("Acoplando escaleras L1 y extrayendo matrículas y tiempos...");
          return prev + 6;
        } else if (prev < 85) {
          setRampSubtitle("Operando cinta de equipajes y ejecutando motor de reglas determinista...");
          return prev + 4;
        }
        return prev;
      });
    }, 400);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(progInterval);

      if (res.ok) {
        const data = await res.json();
        const uploadedDate = data.fecha_detectada || '';
        setRampProgress(100);
        setRampSubtitle(`¡Despacho completado! Se procesaron ${data.total_paginas} órdenes en HUB ${currentHub} para ${uploadedDate}.`);
        
        setTimeout(() => {
          setShowRampScreen(false);
          setActiveTab('diario');
          if (uploadedDate) {
            setSelectedDate(uploadedDate);
            fetchDatesAndOrders(currentHub, uploadedDate);
          } else {
            fetchDatesAndOrders(currentHub, '');
          }
          fetchHubSummary();
        }, 1800);
      } else {
        clearInterval(progInterval);
        alert("Error al procesar el archivo PDF.");
        setShowRampScreen(false);
      }
    } catch (e) {
      clearInterval(progInterval);
      console.error(e);
      alert("Error en la subida de archivo.");
      setShowRampScreen(false);
    }
  };

  // Abrir simulador interactivo de pantalla de carga
  const handleOpenSimulator = () => {
    setRampIsSimulated(true);
    setRampProgress(0);
    setRampTitle(`Perséfone • Simulador de Turnaround de Rampa [${currentHub}]`);
    setRampSubtitle("Demostración visual de acoplamiento progresivo de equipos de tierra");
    setShowRampScreen(true);
  };

  // Totales del día
  const totalEsperado = orders.reduce((acc, o) => acc + (o.costo_total_esperado || 0), 0);
  const totalAdicionales = orders.reduce((acc, o) => acc + (o.costo_adicionales || 0), 0);
  const countConforme = orders.filter(o => o.estado === 'CONFORME').length;
  const countAdicionales = orders.filter(o => o.estado === 'CON_ADICIONALES').length;
  const countInconsistente = orders.filter(o => o.estado === 'INCONSISTENTE').length;
  const countRevisar = orders.filter(o => o.estado === 'REVISAR').length;

  // Exportar a CSV
  const handleExportCSV = () => {
    if (!selectedDate) {
      alert("Selecciona una fecha de operación antes de exportar.");
      return;
    }
    const headers = ["HUB", "Numero_Orden", "Aerolinea", "Matricula", "Llegada", "Salida", "Turnaround_Min", "Excede_70m", "Costo_Base_USD", "Adicionales_USD", "Total_USD", "Estado"];
    const rows = orders.map(o => [
      o.hub || currentHub,
      o.numero_orden,
      o.aerolinea,
      o.matricula,
      o.llegada,
      o.salida,
      o.tiempo_en_tierra_min,
      o.excede_turnaround ? "SI" : "NO",
      o.costo_base,
      o.costo_adicionales,
      o.costo_total_esperado,
      o.estado
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Persefone_Reporte_${currentHub}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-container">
      {/* Pantalla de Carga de Rampa (Modal Overlay) */}
      {showRampScreen && (
        <RampLoadingScreen
          progress={rampProgress}
          hub={currentHub}
          title={rampTitle}
          subtitle={rampSubtitle}
          isSimulated={rampIsSimulated}
          onClose={() => setShowRampScreen(false)}
        />
      )}

      {/* Cinta de Telemetría y Radar Aeroportuario */}
      <div className="airport-telemetry-ribbon">
        <div className="telemetry-item">
          <span className="radar-dot" />
          <span style={{ color: '#10b981', fontWeight: 800 }}>RADAR EN VIVO:</span>
          <span style={{ color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
            {HUBS_DATA[currentHub].icao} • {currentHub} RAMP TOWER
          </span>
        </div>

        <div className="telemetry-item" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          <Wind className="w-3.5 h-3.5 text-sky-400" />
          <span>RWY {currentHub === 'PUJ' ? '08/26' : '17/35'} OPERATIVA • 090°/11KT • CAVOK • QNH 1014 hPa</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="airport-clock-display">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="station-time">
              {currentHub} {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </span>
            <span className="zulu-time">
              {currentTime.toISOString().substring(11, 19)} UTC
            </span>
          </div>

          <button
            type="button"
            className="airport-chime-toggle"
            onClick={playAirportChime}
            title="Reproducir anuncio sonoro de terminal aeroportuaria"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Chime Aeropuerto</span>
          </button>
        </div>
      </div>

      {/* Encabezado Corporativo Perséfone */}
      <header className="app-header">
        <div className="header-top">
          {/* Logo y Branding Perséfone */}
          <div className="brand-persefone-crest">
            <div className="persefone-logo-icon">
              <Plane className="w-6 h-6 transform -rotate-45" />
            </div>
            <div>
              <h1 className="brand-persefone-title">
                PERSÉFONE
                <span className="brand-hub-indicator">
                  {currentHub} • {HUBS_DATA[currentHub].icao}
                </span>
              </h1>
              <p className="brand-persefone-sub">
                Aviation Ground Handling & Billing Audit System • F-RAM-AVL-MAG 04
              </p>
            </div>
          </div>

          {/* Selector de HUB Rápido y Acciones */}
          <div className="header-actions-group">
            {/* HUB Switcher Compacto */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                <MapPin className="w-3.5 h-3.5 text-sky-400 inline mr-0.5" /> HUB:
              </span>
              <HubSelector
                currentHub={currentHub}
                onHubChange={(hub) => {
                  setCurrentHub(hub);
                  setSelectedDate(''); // Reiniciar fecha al cambiar de estación
                }}
                hubSummary={hubSummary}
                compact={true}
              />
            </div>

            {/* Botón Simulador de Pantalla de Carga */}
            <button
              type="button"
              className="ramp-demo-trigger-btn"
              onClick={handleOpenSimulator}
              title="Abrir simulación de pantalla de carga con acoplamiento de equipos de rampa"
            >
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <span>Simulador de Rampa (0-100%)</span>
            </button>

            {/* Exportar Reporte */}
            <button
              onClick={handleExportCSV}
              className="inspect-btn"
              style={{ background: '#ffffff', color: '#0f172a', fontWeight: 700 }}
              title="Descargar liquidación del día en CSV"
            >
              <Download size={15} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'diario' ? 'active' : ''}`}
            onClick={() => setActiveTab('diario')}
          >
            <Calendar size={16} /> Operaciones en Rampa {selectedDate ? `(${orders.length})` : ''}
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'subir' ? 'active' : ''}`}
            onClick={() => setActiveTab('subir')}
          >
            <UploadCloud size={16} /> Subir PDF de Lote [{currentHub}]
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'kpi' ? 'active' : ''}`}
            onClick={() => setActiveTab('kpi')}
          >
            <TrendingUp size={16} /> KPI Arajet ({currentHub})
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'ajustes' ? 'active' : ''}`}
            onClick={() => setActiveTab('ajustes')}
          >
            <Settings size={16} /> Tarifas & Ajustes
          </button>
        </nav>
      </header>

      {/* Cuerpo Principal */}
      <main className="main-content">
        {/* PESTAÑA 1: VISTA DIARIA */}
        {activeTab === 'diario' && (
          <div>
            {/* Banner de Estado del HUB Activo (Limpio, sin clima ni pista) */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '12px',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontFamily: 'JetBrains Mono, monospace'
                }}>
                  {currentHub} / {HUBS_DATA[currentHub].icao}
                </span>
                <div>
                  <strong style={{ fontSize: '0.92rem' }}>{HUBS_DATA[currentHub].name}</strong>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                    {HUBS_DATA[currentHub].city}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem' }}>
                <span className="status-pill conforme" style={{ fontSize: '0.7rem' }}>
                  ● OPERACIONAL
                </span>
              </div>
            </div>

            {/* Banner de Notificación de Operaciones (p.ej. Eliminación de Lote) */}
            {deleteNotice && (
              <div className="persefone-toast-success" style={{
                background: '#ecfdf5',
                border: '1px solid #10b981',
                color: '#065f46',
                borderRadius: '8px',
                padding: '0.85rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}>
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span style={{ flex: 1 }}>{deleteNotice}</span>
                <button
                  type="button"
                  onClick={() => setDeleteNotice(null)}
                  style={{ background: 'transparent', border: 'none', color: '#065f46', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* CONDICIONAL: SI NO HAY FECHA SELECCIONADA, MOSTRAR PANTALLA DE SELECCIÓN INICIAL */}
            {!selectedDate ? (
              <div className="select-date-prompt-card">
                <div className="prompt-icon-circle">
                  <Calendar size={36} />
                </div>
                <h2>Selecciona una Fecha de Operación</h2>
                <p>
                  Para auditar las órdenes de servicio de <strong>HUB {currentHub}</strong>, elige una fecha disponible del listado o ingresa una fecha manualmente.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%', maxWidth: '680px' }}>
                  {availableDates.length > 0 ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Lotes Registrados en HUB {currentHub} ({availableDates.length}):
                      </span>
                      {availableDates.map((ad, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.85rem 1.2rem',
                            background: '#0e182b',
                            border: '1px solid rgba(56, 189, 248, 0.22)',
                            borderRadius: '10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              background: 'rgba(2, 132, 199, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 800,
                              fontSize: '0.9rem'
                            }}>
                              📅 {ad.fecha_agrupacion}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                                {ad.total_ordenes} turnarounds registrados
                              </span>
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                Total liquidación esperada: <strong style={{ color: '#38bdf8' }}>${ad.total_usd?.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedDate(ad.fecha_agrupacion)}
                              className="inspect-btn"
                              style={{ background: '#0284c7', color: '#ffffff', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                            >
                              Abrir Lote
                            </button>
                            <button
                              type="button"
                              onClick={() => setDateToDelete(ad.fecha_agrupacion)}
                              className="delete-date-btn"
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                borderRadius: '6px',
                                padding: '0.4rem 0.65rem',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 600
                              }}
                              title={`Eliminar lote del ${ad.fecha_agrupacion} para volver a cargar`}
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-dates-notice">
                      No hay órdenes registradas para {currentHub}. Puedes ir a la pestaña <strong>"Subir PDF de Lote"</strong> para cargar tu primer archivo.
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
                    <span>O seleccionar fecha en calendario:</span>
                    <input
                      type="date"
                      className="date-select-input"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* SI HAY FECHA SELECCIONADA: MOSTRAR DATOS, KPIS Y GRILLA DE ÓRDENES */
              <>
                {/* Barra Superior de KPI del Día */}
                <div className="kpi-summary-grid">
                  <div className="kpi-card">
                    <div className="kpi-icon-box kpi-icon-navy"><Plane size={24} /></div>
                    <div>
                      <div className="kpi-info-label">Turnarounds en {currentHub}</div>
                      <div className="kpi-info-val">{orders.length}</div>
                      <div className="kpi-info-sub">{selectedDate}</div>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-icon-box kpi-icon-green"><DollarSign size={24} /></div>
                    <div>
                      <div className="kpi-info-label">Costo Total Esperado</div>
                      <div className="kpi-info-val">${totalEsperado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      <div className="kpi-info-sub">Base: ${(orders.length * 500).toLocaleString()} USD</div>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-icon-box kpi-icon-amber"><AlertTriangle size={24} /></div>
                    <div>
                      <div className="kpi-info-label">Cargos Adicionales</div>
                      <div className="kpi-info-val">${totalAdicionales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      <div className="kpi-info-sub">{countAdicionales} órdenes con recargo</div>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-icon-box kpi-icon-red"><AlertOctagon size={24} /></div>
                    <div>
                      <div className="kpi-info-label">Semáforo de Cumplimiento</div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span className="status-pill conforme" style={{ fontSize: '0.7rem' }}>🟢 {countConforme}</span>
                        <span className="status-pill con_adicionales" style={{ fontSize: '0.7rem' }}>🟠 {countAdicionales}</span>
                        <span className="status-pill inconsistente" style={{ fontSize: '0.7rem' }}>🔴 {countInconsistente}</span>
                        <span className="status-pill revisar" style={{ fontSize: '0.7rem' }}>⚪ {countRevisar}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barra de Filtros y Búsqueda */}
                <div className="controls-bar">
                  <div className="date-selector-group">
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Fecha:</span>
                    {availableDates.length > 0 ? (
                      <select
                        className="filter-select"
                        style={{ fontWeight: 700 }}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      >
                        {availableDates.map((ad, idx) => (
                          <option key={idx} value={ad.fecha_agrupacion}>
                            {ad.fecha_agrupacion} ({ad.total_ordenes} órdenes)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="date"
                        className="date-select-input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedDate('')}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      title="Quitar fecha y volver al selector inicial"
                    >
                      Cambiar Fecha
                    </button>

                    {/* Botón para Eliminar Fecha / Lote Activo */}
                    <button
                      type="button"
                      onClick={() => setDateToDelete(selectedDate)}
                      className="delete-date-btn"
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        color: '#b91c1c',
                        cursor: 'pointer',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={`Eliminar todas las órdenes cargadas para el ${selectedDate} para volver a subir`}
                    >
                      <Trash2 size={13} /> Eliminar Fecha
                    </button>
                  </div>

                  <div className="filters-group">
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Buscar orden, matrícula, vuelo..."
                        className="search-input"
                        style={{ paddingLeft: '32px' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <select
                      className="filter-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="TODOS">Todos los Estados</option>
                      <option value="CONFORME">🟢 Solo Conformes</option>
                      <option value="CON_ADICIONALES">🟠 Solo con Adicionales</option>
                      <option value="INCONSISTENTE">🔴 Solo Inconsistentes</option>
                      <option value="REVISAR">⚪ Solo a Revisar</option>
                    </select>
                  </div>
                </div>

                {/* Selector de Modo de Visualización (FIDS Split-Flap vs Bahías VDGS) */}
                <div className="view-mode-bar">
                  <div className="view-mode-toggle">
                    <button
                      type="button"
                      className={`view-mode-btn ${viewMode === 'fids' ? 'active' : ''}`}
                      onClick={() => setViewMode('fids')}
                      title="Ver como Tablero Electromecánico Split-Flap de Salidas / Llegadas del Aeropuerto"
                    >
                      <ListFilter size={15} /> Tablero FIDS Split-Flap ({filteredOrders.length})
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn ${viewMode === 'stands' ? 'active' : ''}`}
                      onClick={() => setViewMode('stands')}
                      title="Ver como Bahías de Estacionamiento en Rampa (VDGS)"
                    >
                      <LayoutGrid size={15} /> Bahías de Rampa / Gates ({filteredOrders.length})
                    </button>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>ESTACIÓN {currentHub} • TIEMPO CONTRATO: 70 MIN</span>
                  </div>
                </div>

                {/* VISTA 1: TABLERO FIDS ELECTROMECÁNICO (SPLIT-FLAP FLIGHT DEPARTURES BOARD) */}
                {viewMode === 'fids' && (
                  <div className="fids-board-wrapper">
                    <div className="fids-board-header">
                      <div className="fids-board-title">
                        <span className="radar-dot" />
                        <span>TABLERO FIDS DE OPERACIONES • {currentHub} ({HUBS_DATA[currentHub].icao})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                        <span>FECHA: <strong style={{ color: '#f8fafc' }}>{selectedDate}</strong></span>
                        <span>•</span>
                        <span>TURNAROUNDS: <strong style={{ color: '#38bdf8' }}>{filteredOrders.length}</strong></span>
                      </div>
                    </div>

                    <div className="fids-table-responsive">
                      <table className="fids-table">
                        <thead>
                          <tr>
                            <th>ORDEN</th>
                            <th>VUELO</th>
                            <th>AERONAVE / MATRÍCULA</th>
                            <th>RUTA</th>
                            <th>PUERTA</th>
                            <th>HORARIO</th>
                            <th>TIEMPO EN TIERRA</th>
                            <th>EQUIPOS GSE</th>
                            <th>LIQUIDACIÓN</th>
                            <th>ESTADO</th>
                            <th style={{ textAlign: 'right' }}>ACCIÓN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                <Plane size={36} className="text-slate-500 mx-auto mb-2" />
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                                  No hay vuelos registrados para el tablero FIDS en {selectedDate}
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredOrders.map((order) => {
                              const statusClass = order.estado.toLowerCase();
                              const statusLabel = 
                                order.estado === 'CONFORME' ? 'CONFORME' :
                                order.estado === 'CON_ADICIONALES' ? 'SERVICIOS EXTRAS' :
                                order.estado === 'INCONSISTENTE' ? 'INCONSISTENTE' : 'REVISAR';

                              const arrivalTime = order.llegada ? order.llegada.split('T')[1] || order.llegada.slice(-5) : '--:--';
                              const departureTime = order.salida ? order.salida.split('T')[1] || order.salida.slice(-5) : '--:--';
                              const turnMin = order.tiempo_en_tierra_min ?? 0;
                              const budgetNominal = Math.min(100, (turnMin / 70) * 100);
                              const hasExcess = order.excede_turnaround;

                              return (
                                <tr
                                  key={order.numero_orden}
                                  className="fids-row"
                                  onClick={() => handleOpenDetail(order)}
                                >
                                  {/* # Orden */}
                                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#38bdf8' }}>
                                    #{order.numero_orden}
                                  </td>

                                  {/* Vuelo */}
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <SplitFlapText text={order.vuelo_entrante || 'INB'} color="amber" />
                                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>➔ {order.vuelo_saliente || 'OUT'}</span>
                                    </div>
                                  </td>

                                  {/* Aeronave */}
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <SplitFlapText text={order.matricula || 'N/A'} color="white" />
                                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{order.tipo_aeronave}</span>
                                    </div>
                                  </td>

                                  {/* Ruta */}
                                  <td>
                                    <div className="airport-route-badge">
                                      <span className="iata-tag">{order.data?.origen || currentHub}</span>
                                      <span className="iata-arrow">➔</span>
                                      <span className="iata-tag">{order.data?.destino || 'DEST'}</span>
                                    </div>
                                  </td>

                                  {/* Gate */}
                                  <td>
                                    <span className="airport-gate-badge">
                                      GATE {order.posicion || 'B29'}
                                    </span>
                                  </td>

                                  {/* Horario */}
                                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                                    <span style={{ color: '#f8fafc' }}>{arrivalTime}</span>
                                    <span style={{ color: '#64748b', margin: '0 4px' }}>➔</span>
                                    <span style={{ color: '#f8fafc' }}>{departureTime}</span>
                                  </td>

                                  {/* Tiempo en Tierra Gauge */}
                                  <td>
                                    <div className="turnaround-gauge-wrap">
                                      <div className="turnaround-gauge-track">
                                        <div
                                          className={`turnaround-gauge-fill ${hasExcess ? 'danger' : turnMin > 55 ? 'warning' : ''}`}
                                          style={{ width: `${hasExcess ? 100 : budgetNominal}%` }}
                                        />
                                      </div>
                                      <div className="turnaround-gauge-labels">
                                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>{turnMin} min</span>
                                        <span style={{ color: hasExcess ? '#f87171' : '#64748b' }}>
                                          {hasExcess ? `+${order.calculation?.exceso_tiempo_min}m exc.` : 'max 70m'}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Equipos GSE */}
                                  <td>
                                    <div className="gse-icons-group">
                                      {order.calculation?.lineas_costo.map((line, idx) => (
                                        <span
                                          key={idx}
                                          className={`gse-badge-pill ${line.es_adicional ? 'charged' : 'standard'}`}
                                          title={`${line.descripcion} - ${line.regla}`}
                                        >
                                          {line.codigo.includes('GPU') ? '⚡ GPU' :
                                           line.codigo.includes('WATER') ? '💧 AGUA' :
                                           line.codigo.includes('LAVATORY') ? '🚽 BAÑO' :
                                           line.codigo.includes('PUSHBACK') ? '🚜 TUG' :
                                           line.codigo.includes('COBUS') ? '🚌 BUS' : line.codigo}
                                        </span>
                                      ))}
                                    </div>
                                  </td>

                                  {/* Total Liquidación */}
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#38bdf8', fontSize: '0.95rem' }}>
                                        ${order.costo_total_esperado?.toFixed(2)} USD
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                        Base ${order.costo_base} + Extra ${order.costo_adicionales}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Estado */}
                                  <td>
                                    <span className={`fids-status-badge ${statusClass}`}>
                                      ● {statusLabel}
                                    </span>
                                  </td>

                                  {/* Acción */}
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      className="inspect-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenDetail(order);
                                      }}
                                    >
                                      <Eye size={13} /> Auditar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* VISTA 2: BAHÍAS DE ESTACIONAMIENTO EN RAMPA (VDGS APPRON STANDS) */}
                {viewMode === 'stands' && (
                  <div className="orders-grid">
                    {filteredOrders.length === 0 ? (
                      <div style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '3rem',
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px dashed #cbd5e1'
                      }}>
                        <Plane size={36} className="text-slate-400 mx-auto mb-2" />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                          No hay órdenes registradas para HUB {currentHub} en la fecha {selectedDate}
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                          Verifica el filtro o carga las facturas en la pestaña "Subir PDF de Lote".
                        </p>
                      </div>
                    ) : (
                      filteredOrders.map((order) => {
                        const statusClass = order.estado.toLowerCase();
                        const statusLabel = 
                          order.estado === 'CONFORME' ? '🟢 Conforme' :
                          order.estado === 'CON_ADICIONALES' ? '🟠 Con Adicionales' :
                          order.estado === 'INCONSISTENTE' ? '🔴 Inconsistente' : '⚪ Revisar';

                        const arrivalTime = order.llegada ? order.llegada.split('T')[1] || order.llegada.slice(-5) : '--:--';
                        const departureTime = order.salida ? order.salida.split('T')[1] || order.salida.slice(-5) : '--:--';
                        const turnMin = order.tiempo_en_tierra_min ?? 0;
                        const budgetNominal = Math.min(100, (turnMin / 70) * 100);
                        const hasExcess = order.excede_turnaround;

                        return (
                          <div
                            key={order.numero_orden}
                            className={`stand-guidance-card ${statusClass}`}
                            onClick={() => handleOpenDetail(order)}
                          >
                            <div>
                              {/* Cabecera de Bahía y Puerta */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span className="airport-gate-badge">
                                    GATE {order.posicion || 'B29'}
                                  </span>
                                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                                    #{order.numero_orden}
                                  </span>
                                  {order.validada && (
                                    <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                                      <CheckCircle2 size={12} /> Validada
                                    </span>
                                  )}
                                </div>
                                <span className={`fids-status-badge ${statusClass}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                                  {statusLabel}
                                </span>
                              </div>

                              {/* Rutas y Split-Flap de Vuelo */}
                              <div style={{ background: '#070e1b', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                  <SplitFlapText text={order.vuelo_entrante || 'INB'} color="amber" />
                                  <span style={{ color: '#38bdf8', fontSize: '0.8rem' }}>✈</span>
                                  <SplitFlapText text={order.vuelo_saliente || 'OUT'} color="amber" />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                  <span>{order.aerolinea} • {order.tipo_aeronave}</span>
                                  <SplitFlapText text={order.matricula || 'N/A'} color="white" />
                                </div>
                              </div>

                              {/* Tiempos en Tierra y Turnaround Gauge */}
                              <div style={{ background: '#0f172a', borderRadius: '8px', padding: '0.65rem 0.75rem', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
                                    <Clock size={13} className="text-sky-400" />
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f8fafc' }}>
                                      {arrivalTime} ➔ {departureTime}
                                    </span>
                                  </div>
                                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: hasExcess ? '#f87171' : '#10b981' }}>
                                    {turnMin} min {hasExcess ? `(+${order.calculation?.exceso_tiempo_min}m)` : ''}
                                  </span>
                                </div>

                                <div className="turnaround-gauge-track" style={{ height: '5px' }}>
                                  <div
                                    className={`turnaround-gauge-fill ${hasExcess ? 'danger' : turnMin > 55 ? 'warning' : ''}`}
                                    style={{ width: `${hasExcess ? 100 : budgetNominal}%` }}
                                  />
                                </div>
                              </div>

                              {/* Chips de Servicios */}
                              <div className="gse-icons-group" style={{ marginBottom: '0.5rem' }}>
                                {order.calculation?.lineas_costo.map((line, idx) => (
                                  <span
                                    key={idx}
                                    className={`gse-badge-pill ${line.es_adicional ? 'charged' : 'standard'}`}
                                    title={line.regla}
                                  >
                                    {line.codigo} {line.total > 0 ? `($${line.total})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Pie de Tarjeta con Costos */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderTop: '1px solid #1e293b',
                              paddingTop: '0.65rem',
                              marginTop: 'auto'
                            }}>
                              <div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                  Base ${order.costo_base} + Extra ${order.costo_adicionales}
                                </div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#38bdf8', fontSize: '1rem' }}>
                                  ${order.costo_total_esperado?.toFixed(2)} USD
                                </div>
                              </div>

                              <button className="inspect-btn">
                                <Eye size={13} /> Auditar
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PESTAÑA 2: SUBIR PDF CON SELECTOR DE HUB PREVIO */}
        {activeTab === 'subir' && (
          <div style={{ maxWidth: '880px', margin: '0 auto' }}>
            {/* Paso 1: Selector de HUB Obligatorio antes de cargar */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #0b192c 0%, #1e3e62 100%)',
                color: '#ffffff',
                padding: '1.25rem 1.5rem',
                borderRadius: '14px',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    1. Selección de HUB de Operación
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    Selecciona el aeropuerto (PUJ o SDQ) al que corresponden las órdenes de servicio del lote antes de subir el archivo.
                  </p>
                </div>
                <span className="brand-hub-indicator" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                  ACTIVO: {currentHub}
                </span>
              </div>

              {/* Componente Interactivo de Tarjetas de HUB (Limpio) */}
              <HubSelector
                currentHub={currentHub}
                onHubChange={(hub) => setCurrentHub(hub)}
                hubSummary={hubSummary}
              />
            </div>

            {/* Paso 2: Zona de Carga de PDF */}
            <div>
              <div style={{ marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                2. Carga y Rasterizado del Archivo PDF (Formulario F-RAM)
              </div>

              <div
                className="upload-card-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => {
                  const el = document.getElementById('pdf-file-input');
                  el?.click();
                }}
              >
                <input
                  type="file"
                  id="pdf-file-input"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="upload-icon-circle">
                  <UploadCloud size={32} />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--primary-navy)' }}>
                  Arrastra tu PDF para procesar en HUB {currentHub}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem', maxWidth: '580px', margin: '0 auto 1.25rem' }}>
                  Formulario F-RAM-AVL-MAG 04 (Rev. 02 Jun-2023). Al cargar el documento se activará la pantalla de carga con adición secuencial de equipos de rampa (escalera, remolcador, cinta de equipajes) y se abrirá directamente en la nueva fecha detectada.
                </p>
                <button className="btn-primary" style={{ margin: '0 auto' }}>
                  Seleccionar Archivo PDF para {currentHub}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: KPI ARAJET */}
        {activeTab === 'kpi' && kpiData && (
          <div className="settings-wrap" style={{ maxWidth: '960px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <TrendingUp size={28} className="text-sky-600" />
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                    KPI de Volumen Arajet • Concesión 3 [{currentHub}]
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Control de umbral mensual de 226 vuelos para tarifas preferenciales.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`hub-pill-btn ${currentHub === 'PUJ' ? 'active' : ''}`}
                  onClick={() => setCurrentHub('PUJ')}
                  style={{ background: currentHub === 'PUJ' ? '#0284c7' : '#e2e8f0', color: currentHub === 'PUJ' ? '#fff' : '#0f172a' }}
                >
                  PUJ
                </button>
                <button
                  type="button"
                  className={`hub-pill-btn ${currentHub === 'SDQ' ? 'active' : ''}`}
                  onClick={() => setCurrentHub('SDQ')}
                  style={{ background: currentHub === 'SDQ' ? '#0284c7' : '#e2e8f0', color: currentHub === 'SDQ' ? '#fff' : '#0f172a' }}
                >
                  SDQ
                </button>
              </div>
            </div>

            <div className="kpi-summary-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="kpi-card">
                <div>
                  <div className="kpi-info-label">Umbral Mínimo Requerido</div>
                  <div className="kpi-info-val">{kpiData.umbral_minimo_mensual} vuelos/mes</div>
                  <div className="kpi-info-sub">Concesión 3 Cláusula</div>
                </div>
              </div>
              <div className="kpi-card">
                <div>
                  <div className="kpi-info-label">Vuelos Registrados Mes</div>
                  <div className="kpi-info-val" style={{ color: '#059669' }}>{kpiData.vuelos_calculados} vuelos</div>
                  <div className="kpi-info-sub">{kpiData.turnarounds_registrados} turnarounds (x2 segmentos)</div>
                </div>
              </div>
              <div className="kpi-card">
                <div>
                  <div className="kpi-info-label">Promedio Móvil 4 Meses</div>
                  <div className="kpi-info-val">{kpiData.promedio_movil_4_meses} vuelos/mes</div>
                  <div className="kpi-info-sub">Estado: <strong>CUMPLE CONDICIÓN</strong></div>
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>📌 Regla Contractual Arajet (Concesión 3):</h3>
              <p style={{ color: '#334155', lineHeight: 1.6 }}>
                "Si en cualquier mes el Carrier opera menos de 226 vuelos Y el promedio móvil de 4 meses también cae por debajo de 226 vuelos, AVIAM se reserva el derecho de emitir una factura de ajuste aplicando retroactivamente las tarifas estándar del Tarifario 2022/2025 en lugar de los precios concesionados."
              </p>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: AJUSTES Y TARIFARIO */}
        {activeTab === 'ajustes' && (
          <div className="settings-wrap" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Configuración de Tarifas & Reglas (`tarifas.json`)</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Edita valores, recargos por hora, feriados dominicanos y cláusulas en vivo.
                </p>
              </div>
              <button
                className="btn-success"
                onClick={async () => {
                  try {
                    const parsed = JSON.parse(tariffsJsonText);
                    const res = await fetch('/api/tariffs', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(parsed)
                    });
                    if (res.ok) alert("¡Tarifas actualizadas correctamente!");
                  } catch (e) {
                    alert("JSON inválido. Revisa la sintaxis.");
                  }
                }}
              >
                Guardar Configuración
              </button>
            </div>

            <textarea
              style={{
                width: '100%',
                height: '500px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.82rem',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#0f172a',
                color: '#f8fafc',
                lineHeight: 1.5
              }}
              value={tariffsJsonText}
              onChange={(e) => setTariffsJsonText(e.target.value)}
            />
          </div>
        )}
      </main>

      {/* PANEL SPLIT-VIEW (DETALLE Y EDICIÓN) */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content-split">
            {/* Header del Modal */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="order-number" style={{ fontSize: '1.3rem' }}>
                  Orden #{selectedOrder.numero_orden}
                </span>
                <span className="brand-hub-indicator">
                  {selectedOrder.hub || currentHub}
                </span>
                <span className="position-badge">POS: {selectedOrder.posicion || 'B29'}</span>
                <span className={`status-pill ${selectedOrder.estado.toLowerCase()}`}>
                  {selectedOrder.estado}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Página {selectedOrder.pagina}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  className="btn-success"
                  onClick={handleValidateOrder}
                  disabled={savingOrder || selectedOrder.validada}
                >
                  <ShieldCheck size={16} /> {selectedOrder.validada ? 'Orden Validada' : 'Marcar como Validada'}
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.4rem' }}
                >
                  <X size={22} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Cuerpo Split: Imagen Escaneada a la izquierda, Datos y Cálculos a la derecha */}
            <div className="modal-body-split">
              {/* Panel Izquierdo: Visor de Imagen con Zoom */}
              <div className="image-viewer-pane">
                <div className="image-toolbar">
                  <span>Visor de Documento F-RAM Original</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
                    <button className="image-tool-btn" onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}>
                      <ZoomIn size={14} /> Zoom +
                    </button>
                    <button className="image-tool-btn" onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}>
                      <ZoomOut size={14} /> Zoom -
                    </button>
                    <button className="image-tool-btn" onClick={() => setZoomLevel(1)}>
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                </div>

                <div className="image-scroll-box">
                  <img
                    src={`/api/orders/${selectedOrder.numero_orden}/image`}
                    alt={`Orden ${selectedOrder.numero_orden}`}
                    className="scanned-order-img"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                </div>
              </div>

              {/* Panel Derecho: Datos Extraídos Editables & Desglose Determinista */}
              <div className="data-editor-pane">
                {/* Alertas Detectadas */}
                {selectedOrder.calculation?.alertas.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 className="section-subtitle" style={{ color: '#dc2626' }}>
                      <AlertTriangle size={16} /> Alertas de Liquidación & Extracción
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedOrder.calculation.alertas.map((al, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: al.tipo === 'ERROR' || al.tipo === 'INCONSISTENTE' ? '#fef2f2' : '#fffbeb',
                            border: `1px solid ${al.tipo === 'ERROR' || al.tipo === 'INCONSISTENTE' ? '#fecaca' : '#fde68a'}`,
                            padding: '0.6rem 0.85rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <strong>[{al.codigo}]</strong> {al.descripcion}
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                            Regla aplicada: {al.clausula}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulario Editable */}
                <h4 className="section-subtitle">
                  <FileText size={16} /> Información Operacional (Editable en vivo)
                </h4>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Fecha / Hora Llegada</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editedData?.llegada || ''}
                      onChange={(e) => handleFieldChange('llegada', e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Fecha / Hora Salida</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editedData?.salida || ''}
                      onChange={(e) => handleFieldChange('salida', e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Vuelo Entrante</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editedData?.vuelo_entrante || ''}
                      onChange={(e) => handleFieldChange('vuelo_entrante', e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Vuelo Saliente</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editedData?.vuelo_saliente || ''}
                      onChange={(e) => handleFieldChange('vuelo_saliente', e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Matrícula</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editedData?.matricula || ''}
                      onChange={(e) => handleFieldChange('matricula', e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Posición / Gate</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editedData?.posicion || ''}
                      onChange={(e) => handleFieldChange('posicion', e.target.value)}
                    />
                  </div>
                </div>

                {/* Tabla de Desglose de Liquidación con Cláusulas */}
                <h4 className="section-subtitle">
                  <DollarSign size={16} /> Desglose de Costos (Motor Determinista)
                </h4>

                <table className="breakdown-table">
                  <thead>
                    <tr>
                      <th>Concepto / Servicio</th>
                      <th>Cant.</th>
                      <th>Precio Unit.</th>
                      <th>Total USD</th>
                      <th>Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.calculation?.lineas_costo.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{line.descripcion}</strong>
                          <span className="rule-citation">{line.regla}</span>
                        </td>
                        <td>{line.cantidad} {line.unidad}</td>
                        <td>${line.precio_unitario.toFixed(2)}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                          ${line.total.toFixed(2)}
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: line.es_adicional ? '#fff7ed' : '#f0fdf4',
                            color: line.es_adicional ? '#c2410c' : '#15803d'
                          }}>
                            {line.es_adicional ? 'Adicional' : 'Incluido'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                      <td colSpan={3} style={{ textAlign: 'right', padding: '0.85rem' }}>
                        TOTAL ESPERADO LIQUIDACIÓN:
                      </td>
                      <td colSpan={2} style={{ fontSize: '1.15rem', color: 'var(--primary-navy)', fontFamily: 'JetBrains Mono, monospace', padding: '0.85rem' }}>
                        ${selectedOrder.costo_total_esperado.toFixed(2)} USD
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Observaciones y Notas Manuscritas */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 700, color: '#334155' }}>Observaciones Manuscritas:</span>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0369a1', marginTop: '4px' }}>
                    {selectedOrder.data?.observaciones_tiempos?.map((t: any) => t.raw).join(' | ') || selectedOrder.data?.observaciones_texto || 'Sin observaciones'}
                  </p>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: '#64748b' }}>
                    <span>AVIAM: <strong>{selectedOrder.data?.responsable_aviam || 'Firma detectada'}</strong></span>
                    <span>Aerolínea: <strong>{selectedOrder.data?.representante_aerolinea || 'Firma detectada'}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Lote de Fecha */}
      {dateToDelete && (
        <div className="modal-backdrop" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '460px',
            width: '90%',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #fee2e2'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              ¿Eliminar lote de {dateToDelete}?
            </h3>

            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Se eliminarán de forma permanente todas las órdenes registradas para la fecha <strong>{dateToDelete}</strong> en <strong>HUB {currentHub}</strong>.
              <br /><br />
              Usa esta opción si la carga estuvo incompleta o con errores para que puedas <strong>volver a subir el archivo PDF</strong> desde cero.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={isDeletingDate}
                onClick={() => setDateToDelete(null)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingDate}
                onClick={() => handleDeleteDate(dateToDelete)}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: isDeletingDate ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isDeletingDate ? (
                  <>
                    <div className="ramp-spinner" style={{ width: '14px', height: '14px' }} />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Sí, Eliminar Lote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
