import { useState, useEffect } from 'react';
import {
  Plane, UploadCloud, Calendar, Search, AlertTriangle,
  CheckCircle2, Clock, DollarSign, FileText, Settings, ShieldCheck,
  ZoomIn, ZoomOut, RotateCcw,
  TrendingUp, Download, Eye, X, Trash2,
  Volume2, Wind, PlusCircle, ChevronLeft, ChevronRight,
  Shield, Check
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

interface CostLine {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  total: number;
  cantidad_reclamada_aviam?: number;
  total_reclamado_aviam?: number;
  ahorro_usd?: number;
  regla: string;
  es_adicional: boolean;
}

interface AlertItem {
  tipo: string;
  codigo: string;
  descripcion: string;
  clausula: string;
  monto: number;
  bloqueante?: boolean;
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
  costo_reclamado_aviam?: number;
  ahorro_auditoria_usd?: number;
  aplicar_clausula_12_estricta?: boolean;
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
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fechas y Órdenes
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  // Orden seleccionada para la estación de auditoría Split-Screen
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [editedData, setEditedData] = useState<any>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [isAuditingClause12, setIsAuditingClause12] = useState(false);

  // Modal para Registro de Orden Manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState<any>({
    numero_orden: '',
    matricula: 'HI1098',
    posicion: 'A2',
    vuelo_entrante: 'DM1020',
    origen: 'MIA',
    vuelo_saliente: 'DM1021',
    destino: 'SDQ',
    llegada: '',
    salida: '',
    tipo_aeronave: 'B737 MAX 8',
    aerolinea: 'ARAJET',
    servicios: [
      { codigo: 'RAMP_PACKAGE', marcado: true },
      { codigo: 'POTABLE_WATER', marcado: false },
      { codigo: 'LAVATORY', marcado: false },
      { codigo: 'CABIN_CLEANING', marcado: false, valor_raw: 'T1' },
      { codigo: 'GPU', marcado: false, valor_raw: 'JB' },
      { codigo: 'ACU', marcado: false, valor_raw: 'JB' },
      { codigo: 'PUSHBACK', marcado: true, valor_raw: '1' },
      { codigo: 'MAN_HOUR', marcado: false, valor_raw: '4/1' },
      { codigo: 'TRACTOR_TRUCK', marcado: false, valor_raw: '1' },
      { codigo: 'BAGGAGE_CART', marcado: false, valor_raw: '1' },
      { codigo: 'CARGOVEYOR', marcado: false, valor_raw: '1' },
      { codigo: 'COBUS', marcado: false, cantidad: 1 }
    ]
  });

  // Ramp Loading Screen Modal
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
      let availableList: any[] = [];
      if (resDates.ok) {
        availableList = await resDates.json();
        setAvailableDates(availableList);
      }

      // Si no hay fecha seleccionada pero hay fechas disponibles, preseleccionar la más reciente
      let activeD = targetDate;
      if (!activeD && availableList.length > 0) {
        activeD = availableList[0].fecha_agrupacion;
        setSelectedDate(activeD);
      }

      if (activeD && activeD.trim() !== '') {
        const resOrders = await fetch(`/api/orders?fecha=${activeD}&hub=${targetHub}`);
        if (resOrders.ok) {
          const ordList: OrderRecord[] = await resOrders.json();
          setOrders(ordList);
          // Si no hay orden seleccionada o la seleccionada no está en la nueva lista, seleccionar la primera
          if (ordList.length > 0) {
            setSelectedOrder(prev => {
              if (prev && ordList.some(o => o.numero_orden === prev.numero_orden)) {
                const refreshed = ordList.find(o => o.numero_orden === prev.numero_orden)!;
                setEditedData(JSON.parse(JSON.stringify(refreshed.data)));
                return refreshed;
              }
              setEditedData(JSON.parse(JSON.stringify(ordList[0].data)));
              return ordList[0];
            });
          } else {
            setSelectedOrder(null);
            setEditedData(null);
          }
        }
      } else {
        setOrders([]);
        setSelectedOrder(null);
        setEditedData(null);
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
        setDeleteNotice(`Lote del ${fecha} eliminado exitosamente (${result.deleted_count} órdenes removidas).`);
        setDateToDelete(null);
        setSelectedDate('');
        await fetchHubSummary();
        await fetchDatesAndOrders(currentHub, '');
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
  }, [currentHub]);

  useEffect(() => {
    if (selectedDate) {
      fetchDatesAndOrders(currentHub, selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
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
      if (statusFilter === 'VALIDADAS') {
        res = res.filter(o => o.validada);
      } else {
        res = res.filter(o => o.estado === statusFilter);
      }
    }
    setFilteredOrders(res);
  }, [orders, searchQuery, statusFilter]);

  // Selección de orden para auditar
  const handleSelectOrder = (order: OrderRecord) => {
    setSelectedOrder(order);
    setEditedData(JSON.parse(JSON.stringify(order.data)));
    setZoomLevel(1);
  };

  // Recálculo en vivo al editar campos generales
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

  // Editar cantidad auditada en vivo de una línea de servicio
  const handleAuditQtyChange = async (lineCode: string, newQty: number) => {
    if (!selectedOrder || !editedData) return;
    const servs = [...(editedData.servicios || [])];
    const idx = servs.findIndex((s: any) => s.codigo === lineCode);
    if (idx >= 0) {
      servs[idx] = { ...servs[idx], cantidad_auditada: newQty };
    } else {
      servs.push({ codigo: lineCode, marcado: true, cantidad_auditada: newQty });
    }
    const updated = { ...editedData, servicios: servs };
    setEditedData(updated);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.numero_orden}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const respJson = await res.json();
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
      console.error("Error updating audit qty:", e);
    }
  };

  // Botón Destacado: Aplicar Filtro Cláusula 12 (Descontar GSE/Pushback incluidos en Turnaround)
  const handleToggleClause12 = async () => {
    if (!selectedOrder) return;
    setIsAuditingClause12(true);
    const currentStrict = Boolean(selectedOrder.calculation?.aplicar_clausula_12_estricta);
    const targetStrict = !currentStrict;

    try {
      const res = await fetch(`/api/orders/${selectedOrder.numero_orden}/audit-clause-12?strict=${targetStrict}`, {
        method: 'POST'
      });
      if (res.ok) {
        const respJson = await res.json();
        const updatedRecord: OrderRecord = {
          ...selectedOrder,
          data: respJson.data,
          calculation: respJson.calculation,
          estado: respJson.calculation.estado,
          costo_base: respJson.calculation.costo_base,
          costo_adicionales: respJson.calculation.costo_adicionales,
          costo_total_esperado: respJson.calculation.costo_total_esperado,
          tiempo_en_tierra_min: respJson.calculation.tiempo_en_tierra_min,
          excede_turnaround: respJson.calculation.excede_turnaround
        };
        setSelectedOrder(updatedRecord);
        setEditedData(respJson.data);
        setOrders(prev => prev.map(o => o.numero_orden === selectedOrder.numero_orden ? updatedRecord : o));
      }
    } catch (e) {
      console.error("Error toggling Clause 12:", e);
      alert("Error al aplicar auditoría de Cláusula 12.");
    } finally {
      setIsAuditingClause12(false);
    }
  };

  // Validar y Cerrar Orden
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

  // Navegación de Fecha (< y >)
  const handlePrevDate = () => {
    if (!selectedDate) return;
    const idx = availableDates.findIndex(ad => ad.fecha_agrupacion === selectedDate);
    if (idx >= 0 && idx < availableDates.length - 1) {
      setSelectedDate(availableDates[idx + 1].fecha_agrupacion);
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d.toISOString().substring(0, 10));
    }
  };

  const handleNextDate = () => {
    if (!selectedDate) return;
    const idx = availableDates.findIndex(ad => ad.fecha_agrupacion === selectedDate);
    if (idx > 0) {
      setSelectedDate(availableDates[idx - 1].fecha_agrupacion);
    } else {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d.toISOString().substring(0, 10));
    }
  };

  // Descargar CSV vía endpoint oficial
  const handleDownloadCsv = () => {
    if (!selectedDate) {
      alert("Selecciona una fecha antes de exportar.");
      return;
    }
    const url = `/api/export/csv?fecha=${selectedDate}&hub=${currentHub}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Sabana_Conciliacion_${currentHub}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Guardar Orden Manual
  const handleSaveManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.numero_orden || !manualForm.llegada || !manualForm.salida) {
      alert("Por favor completa el número de orden, hora de llegada y hora de salida.");
      return;
    }

    try {
      const payload = {
        ...manualForm,
        hub: currentHub,
        fecha_agrupacion: manualForm.llegada.substring(0, 10) || selectedDate
      };

      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const created = await res.json();
        setShowManualModal(false);
        const orderDate = payload.fecha_agrupacion;
        setSelectedDate(orderDate);
        await fetchHubSummary();
        await fetchDatesAndOrders(currentHub, orderDate);
        alert(`Orden #${created.numero_orden} registrada y auditada exitosamente.`);
      } else {
        const err = await res.json();
        alert(`Error al registrar orden: ${err.detail || 'Error desconocido'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al registrar la orden manual.");
    }
  };

  // Subida de PDF con Pantalla de Carga
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

  // Totales y KPIs Financieros del Día
  const totalReclamadoAviam = orders.reduce((acc, o) => acc + (o.calculation?.costo_reclamado_aviam || o.costo_total_esperado || 0), 0);
  const totalConciliadoArajet = orders.reduce((acc, o) => acc + (o.costo_total_esperado || 0), 0);
  const totalAhorroDia = Math.max(0, totalReclamadoAviam - totalConciliadoArajet);
  const validadasCount = orders.filter(o => o.validada).length;

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
          {/* Logo y Branding */}
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
                Aviation Ground Handling & Daily Billing Audit • Arajet S.A. vs AVIAM Ltd.
              </p>
            </div>
          </div>

          {/* Navegador de Fecha & Botones de Operación Diaria */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Selector de Hub */}
            <HubSelector
              currentHub={currentHub}
              onHubChange={(hub) => {
                setCurrentHub(hub);
                setSelectedDate('');
              }}
              hubSummary={hubSummary}
              compact={true}
            />

            {/* Navegador de Fechas (<, Input, >) */}
            <div className="date-navigator-wrap">
              <button
                type="button"
                className="date-nav-arrow-btn"
                onClick={handlePrevDate}
                title="Día Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                className="date-select-input"
                style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontWeight: 700, padding: '0 4px', fontSize: '0.85rem' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button
                type="button"
                className="date-nav-arrow-btn"
                onClick={handleNextDate}
                title="Día Siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Botón Registrar Orden Manual */}
            <button
              type="button"
              className="hdr-action-btn hdr-btn-manual"
              onClick={() => {
                setManualForm({
                  ...manualForm,
                  llegada: selectedDate ? `${selectedDate}T10:00` : '',
                  salida: selectedDate ? `${selectedDate}T11:00` : ''
                });
                setShowManualModal(true);
              }}
              title="Registrar manualmente una orden suelta del día"
            >
              <PlusCircle size={15} /> Orden Manual
            </button>

            {/* Botón Subir PDF del Día */}
            <button
              type="button"
              className="hdr-action-btn hdr-btn-upload"
              onClick={() => setActiveTab('subir')}
              title="Subir PDF escaneado con formularios F-RAM del día"
            >
              <UploadCloud size={15} /> Subir PDF
            </button>

            {/* Botón Exportar Sábana CSV del Día */}
            <button
              type="button"
              className="hdr-action-btn hdr-btn-csv"
              onClick={handleDownloadCsv}
              title="Descargar Sábana de Conciliación Diaria en CSV"
            >
              <Download size={15} /> Sábana CSV
            </button>

            {/* Botón Eliminar Lote de Fecha */}
            {selectedDate && (
              <button
                type="button"
                onClick={() => setDateToDelete(selectedDate)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  borderRadius: '7px',
                  padding: '0.45rem 0.65rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
                title={`Eliminar todas las órdenes del ${selectedDate}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'diario' ? 'active' : ''}`}
            onClick={() => setActiveTab('diario')}
          >
            <Calendar size={16} /> Estación de Auditoría Diaria {selectedDate ? `(${orders.length})` : ''}
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
      <main className="main-content" style={{ maxWidth: '1800px' }}>
        {/* PESTAÑA 1: VISTA DIARIA */}
        {activeTab === 'diario' && (
          <div>
            {/* Cinta de Historial de Días Cargados (Scrolleable con badges interactivos) */}
            {availableDates.length > 0 && (
              <div className="dates-history-strip">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  Historial de Días:
                </span>
                {availableDates.map((ad, idx) => {
                  const isCur = ad.fecha_agrupacion === selectedDate;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`history-date-chip ${isCur ? 'active' : ''}`}
                      onClick={() => setSelectedDate(ad.fecha_agrupacion)}
                      title={`Ver órdenes del ${ad.fecha_agrupacion}`}
                    >
                      <span className="history-chip-date">📅 {ad.fecha_agrupacion}</span>
                      <span className="history-chip-badge">{ad.total_ordenes} vls</span>
                      <span className="history-chip-usd">${ad.total_usd?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Banner de Notificación si se eliminó un lote */}
            {deleteNotice && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #10b981',
                color: '#065f46',
                borderRadius: '8px',
                padding: '0.75rem 1.25rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                <CheckCircle2 size={16} className="text-emerald-600" />
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

            {/* DASHBOARD DE 4 KPIS FINANCIEROS DEL DÍA SELECCIONADO */}
            <div className="kpi-summary-grid" style={{ marginBottom: '1.25rem' }}>
              {/* KPI 1: Órdenes del Día */}
              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-navy"><Plane size={22} /></div>
                <div>
                  <div className="kpi-info-label">Órdenes del Día ({currentHub})</div>
                  <div className="kpi-info-val">{orders.length} turnarounds</div>
                  <div className="kpi-info-sub" style={{ color: validadasCount === orders.length && orders.length > 0 ? '#10b981' : '#94a3b8' }}>
                    <ShieldCheck size={12} style={{ display: 'inline', marginRight: '3px' }} />
                    {validadasCount} de {orders.length} validadas
                  </div>
                </div>
              </div>

              {/* KPI 2: Total Reclamado en Papel (AVIAM) */}
              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                  <FileText size={22} />
                </div>
                <div>
                  <div className="kpi-info-label">Reclamado en Papel (AVIAM)</div>
                  <div className="kpi-info-val" style={{ color: '#f87171' }}>
                    ${totalReclamadoAviam.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="kpi-info-sub">Monto bruto pretendido sin concesiones</div>
                </div>
              </div>

              {/* KPI 3: Total Conciliado (Arajet) */}
              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-green"><DollarSign size={22} /></div>
                <div>
                  <div className="kpi-info-label">Conciliado (Arajet)</div>
                  <div className="kpi-info-val" style={{ color: '#38bdf8' }}>
                    ${totalConciliadoArajet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="kpi-info-sub">Monto contractual auditado con reglas</div>
                </div>
              </div>

              {/* KPI 4: Ahorro Detectado en el Día */}
              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  <TrendingUp size={22} />
                </div>
                <div>
                  <div className="kpi-info-label">Ahorro Detectado Hoy</div>
                  <div className="kpi-info-val" style={{ color: '#34d399' }}>
                    +${totalAhorroDia.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="kpi-info-sub">
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      fontWeight: 700,
                      marginRight: '4px'
                    }}>
                      {kpiData?.estado_kpi === 'CUMPLE' ? '✓ CONCESIÓN 3 ACTIVA' : 'EN RIESGO'}
                    </span>
                    Vol. 226 vls/m
                  </div>
                </div>
              </div>
            </div>

            {/* ESTACIÓN DE AUDITORÍA SPLIT-SCREEN (3 PANELES) */}
            {orders.length === 0 ? (
              <div className="select-date-prompt-card" style={{ marginTop: '2rem' }}>
                <div className="prompt-icon-circle">
                  <Calendar size={36} />
                </div>
                <h2>No hay órdenes registradas para {selectedDate || 'esta fecha'}</h2>
                <p>
                  Sube el archivo PDF escaneado del día o registra una hoja suelta con el botón <strong>"Orden Manual"</strong>.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    className="hdr-action-btn hdr-btn-upload"
                    onClick={() => setActiveTab('subir')}
                  >
                    <UploadCloud size={16} /> Subir PDF de Rampa
                  </button>
                  <button
                    className="hdr-action-btn hdr-btn-manual"
                    onClick={() => setShowManualModal(true)}
                  >
                    <PlusCircle size={16} /> Registrar Orden Manual
                  </button>
                </div>
              </div>
            ) : (
              <div className="audit-tri-panel-layout">
                {/* =========================================
                    PANEL 1 (IZQUIERDO): LISTA DE ÓRDENES
                   ========================================= */}
                <div className="tri-panel">
                  <div className="tri-panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Plane size={15} className="text-sky-400" />
                      <span>Órdenes ({filteredOrders.length})</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{selectedDate}</span>
                  </div>

                  {/* Filtro y Buscador */}
                  <div style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid rgba(56, 189, 248, 0.15)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: '#64748b' }} />
                      <input
                        type="text"
                        placeholder="Buscar # orden, matrícula..."
                        className="search-input"
                        style={{ paddingLeft: '28px', fontSize: '0.8rem', width: '100%' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <select
                      className="filter-select"
                      style={{ fontSize: '0.78rem', width: '100%', padding: '0.35rem' }}
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="TODOS">Todos los Estados</option>
                      <option value="CONFORME">🟢 Solo Conformes</option>
                      <option value="CON_ADICIONALES">🟠 Con Adicionales</option>
                      <option value="INCONSISTENTE">🔴 Inconsistentes</option>
                      <option value="VALIDADAS">🛡️ Solo Validadas</option>
                    </select>
                  </div>

                  {/* Lista de Tarjetas Scrolleables */}
                  <div className="tri-panel-content">
                    {filteredOrders.map((ord) => {
                      const isSel = selectedOrder?.numero_orden === ord.numero_orden;
                      const turnMin = ord.tiempo_en_tierra_min ?? 0;
                      const hasExcess = ord.excede_turnaround;
                      const claimed = ord.calculation?.costo_reclamado_aviam || ord.costo_total_esperado;
                      const saving = ord.calculation?.ahorro_auditoria_usd || Math.max(0, claimed - ord.costo_total_esperado);

                      return (
                        <div
                          key={ord.numero_orden}
                          className={`audit-list-item ${isSel ? 'selected' : ''}`}
                          onClick={() => handleSelectOrder(ord)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#38bdf8', fontSize: '0.9rem' }}>
                              #{ord.numero_orden}
                            </span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {ord.validada && (
                                <span style={{ background: '#059669', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                  ✓ VALIDADA
                                </span>
                              )}
                              <span className={`status-pill ${ord.estado.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                {ord.estado === 'CONFORME' ? 'CONFORME' : ord.estado === 'CON_ADICIONALES' ? 'ADICIONALES' : ord.estado}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                            <span>✈️ <strong>{ord.matricula}</strong> • Gate {ord.posicion || 'Rampa'}</span>
                            <span style={{ color: hasExcess ? '#f87171' : '#94a3b8', fontWeight: hasExcess ? 700 : 400 }}>
                              ⏱️ {turnMin} min {hasExcess ? `(+${ord.calculation?.exceso_tiempo_min}m)` : ''}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.72rem' }}>
                              <span style={{ color: '#64748b' }}>Papel: </span>
                              <span className="reclamado-tag-aviam">${claimed.toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: '0.72rem' }}>
                              <span style={{ color: '#64748b' }}>Audit: </span>
                              <span className="conciliado-tag-arajet">${ord.costo_total_esperado.toFixed(2)}</span>
                            </div>
                            {saving > 0 && (
                              <span className="ahorro-tag-green">-${saving.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* =========================================
                    PANEL 2 (CENTRAL): VISOR DE ESCANEO 200 DPI
                   ========================================= */}
                <div className="tri-panel">
                  <div className="tri-panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Eye size={15} className="text-sky-400" />
                      <span>Visor Escaneo 200 DPI (F-RAM Original)</span>
                      {selectedOrder && (
                        <span style={{ color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>
                          • #{selectedOrder.numero_orden} (Pág. {selectedOrder.pagina})
                        </span>
                      )}
                    </div>
                    {/* Controles de Zoom */}
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="image-tool-btn"
                        onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                        title="Acercar imagen"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <button
                        type="button"
                        className="image-tool-btn"
                        onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                        title="Alejar imagen"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <button
                        type="button"
                        className="image-tool-btn"
                        onClick={() => setZoomLevel(1)}
                        title="Restablecer tamaño normal"
                      >
                        <RotateCcw size={13} /> 100%
                      </button>
                    </div>
                  </div>

                  <div className="tri-panel-content" style={{ padding: 0, background: '#070d18', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
                    {selectedOrder ? (
                      selectedOrder.imagen_path ? (
                        <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                          <img
                            src={`/api/orders/${selectedOrder.numero_orden}/image`}
                            alt={`Orden ${selectedOrder.numero_orden}`}
                            style={{
                              transform: `scale(${zoomLevel})`,
                              transformOrigin: 'top center',
                              transition: 'transform 0.15s ease',
                              maxWidth: '100%',
                              borderRadius: '6px',
                              boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                          <FileText size={48} className="text-sky-500 mx-auto mb-3" />
                          <h4 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 700 }}>
                            Orden Registrada Manualmente
                          </h4>
                          <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '340px', margin: '0.5rem auto' }}>
                            Esta orden fue digitada como hoja suelta y no proviene de un archivo rasterizado a 200 DPI.
                          </p>
                        </div>
                      )
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        Selecciona una orden en el panel izquierdo para visualizar su escaneo
                      </div>
                    )}
                  </div>
                </div>

                {/* =========================================
                    PANEL 3 (DERECHO): CONCILIADOR INTERACTIVO
                   ========================================= */}
                <div className="tri-panel">
                  {selectedOrder ? (
                    <>
                      <div className="tri-panel-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Shield size={16} className="text-emerald-400" />
                          <span>Conciliador Contractual</span>
                        </div>
                        <button
                          type="button"
                          className="btn-success"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          onClick={handleValidateOrder}
                          disabled={savingOrder || selectedOrder.validada}
                        >
                          <ShieldCheck size={14} />
                          {selectedOrder.validada ? 'Validada' : 'Validar y Cerrar'}
                        </button>
                      </div>

                      <div className="tri-panel-content">
                        {/* BOTÓN DESTACADO: APLICAR FILTRO CLÁUSULA 12 */}
                        <div className="clause-12-banner">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#f8fafc', fontSize: '0.85rem' }}>
                              <span>Filtro Cláusula 12 y 13</span>
                              {selectedOrder.calculation?.aplicar_clausula_12_estricta ? (
                                <span style={{ background: '#059669', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px' }}>
                                  ACTIVO (ESTRICTO)
                                </span>
                              ) : (
                                <span style={{ background: '#475569', color: '#cbd5e1', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px' }}>
                                  INACTIVO
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '2px 0 0' }}>
                              Descuenta Pushback ($150) y equipos GSE dentro de 70 min.
                            </p>
                          </div>

                          <button
                            type="button"
                            className={`clause-12-toggle-btn ${selectedOrder.calculation?.aplicar_clausula_12_estricta ? 'active' : ''}`}
                            onClick={handleToggleClause12}
                            disabled={isAuditingClause12}
                          >
                            {isAuditingClause12 ? (
                              <span>Calculando...</span>
                            ) : selectedOrder.calculation?.aplicar_clausula_12_estricta ? (
                              <>
                                <Check size={13} /> Desactivar
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={13} /> Aplicar Filtro
                              </>
                            )}
                          </button>
                        </div>

                        {/* RESUMEN FINANCIERO DE LA ORDEN */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '0.5rem',
                          background: '#070d18',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          marginBottom: '0.85rem'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Reclamado AVIAM</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f87171', fontFamily: 'JetBrains Mono, monospace' }}>
                              ${(selectedOrder.calculation?.costo_reclamado_aviam || selectedOrder.costo_total_esperado).toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Conciliado Arajet</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>
                              ${selectedOrder.costo_total_esperado.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ahorro Obtenido</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34d399', fontFamily: 'JetBrains Mono, monospace' }}>
                              +${(selectedOrder.calculation?.ahorro_auditoria_usd || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {/* ALERTAS CONTRACTUALES */}
                        {selectedOrder.calculation?.alertas && selectedOrder.calculation.alertas.length > 0 && (
                          <div style={{ marginBottom: '0.85rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={13} /> Alertas de Auditoría & Cláusulas ({selectedOrder.calculation.alertas.length}):
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {selectedOrder.calculation.alertas.map((al, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    background: al.tipo === 'ERROR' || al.tipo === 'INCONSISTENTE' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                    border: `1px solid ${al.tipo === 'ERROR' || al.tipo === 'INCONSISTENTE' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                                    borderRadius: '6px',
                                    padding: '0.45rem 0.65rem',
                                    fontSize: '0.74rem',
                                    color: '#f8fafc'
                                  }}
                                >
                                  <strong>[{al.codigo}]</strong> {al.descripcion}
                                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                                    Regla: {al.clausula} • Impacto: ${al.monto.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* TABLA COMPARATIVA LÍNEA POR LÍNEA */}
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                            Comparativa Reclamado vs Conciliado Arajet:
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table className="audit-compare-table">
                              <thead>
                                <tr>
                                  <th>Concepto y Regla</th>
                                  <th style={{ textAlign: 'center' }}>Papel</th>
                                  <th style={{ textAlign: 'center' }}>Cant. Audit</th>
                                  <th style={{ textAlign: 'right' }}>Reclamado</th>
                                  <th style={{ textAlign: 'right' }}>Conciliado</th>
                                  <th style={{ textAlign: 'right' }}>Ahorro</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedOrder.calculation?.lineas_costo.map((line, idx) => {
                                  const claimedLine = line.total_reclamado_aviam ?? line.total;
                                  const savingLine = line.ahorro_usd ?? Math.max(0, claimedLine - line.total);
                                  return (
                                    <tr key={idx}>
                                      <td>
                                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{line.descripcion}</div>
                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{line.regla}</div>
                                      </td>
                                      <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: '#f87171' }}>
                                        {line.cantidad_reclamada_aviam ?? line.cantidad}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="0"
                                          className="audit-input-qty"
                                          value={line.cantidad}
                                          onChange={(e) => handleAuditQtyChange(line.codigo, parseFloat(e.target.value) || 0)}
                                        />
                                      </td>
                                      <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#f87171' }}>
                                        ${claimedLine.toFixed(2)}
                                      </td>
                                      <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#38bdf8', fontWeight: 700 }}>
                                        ${line.total.toFixed(2)}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        {savingLine > 0 ? (
                                          <span className="ahorro-tag-green">-${savingLine.toFixed(2)}</span>
                                        ) : (
                                          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>$0.00</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* EDICIÓN DE TIEMPOS IN/OUT */}
                        <div style={{ background: '#070d18', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.18)' }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                            Datos de Tiempos & Vuelo:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label style={{ fontSize: '0.68rem', color: '#64748b' }}>Llegada</label>
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', background: '#0b1424', color: '#f8fafc', border: '1px solid rgba(56,189,248,0.25)' }}
                                value={editedData?.llegada || ''}
                                onChange={(e) => handleFieldChange('llegada', e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.68rem', color: '#64748b' }}>Salida</label>
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', background: '#0b1424', color: '#f8fafc', border: '1px solid rgba(56,189,248,0.25)' }}
                                value={editedData?.salida || ''}
                                onChange={(e) => handleFieldChange('salida', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      Selecciona una orden para auditar
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: SUBIR PDF CON SELECTOR DE HUB */}
        {activeTab === 'subir' && (
          <div style={{ maxWidth: '880px', margin: '0 auto' }}>
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

              <HubSelector
                currentHub={currentHub}
                onHubChange={(hub) => setCurrentHub(hub)}
                hubSummary={hubSummary}
              />
            </div>

            <div>
              <div style={{ marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
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
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f8fafc' }}>
                  Arrastra tu PDF para procesar en HUB {currentHub}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem', maxWidth: '580px', margin: '0 auto 1.25rem' }}>
                  Formulario F-RAM-AVL-MAG 04 (Rev. 02 Jun-2023). Al cargar el documento se rasterizará a 200 DPI y se ejecutará el motor de reglas determinista con desglose de ahorro.
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
                <TrendingUp size={28} className="text-sky-400" />
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
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
                  style={{ background: currentHub === 'PUJ' ? '#0284c7' : '#1e293b', color: currentHub === 'PUJ' ? '#fff' : '#94a3b8' }}
                >
                  PUJ
                </button>
                <button
                  type="button"
                  className={`hub-pill-btn ${currentHub === 'SDQ' ? 'active' : ''}`}
                  onClick={() => setCurrentHub('SDQ')}
                  style={{ background: currentHub === 'SDQ' ? '#0284c7' : '#1e293b', color: currentHub === 'SDQ' ? '#fff' : '#94a3b8' }}
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

            <div style={{ background: '#0b1424', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)', fontSize: '0.88rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#38bdf8' }}>📌 Regla Contractual Arajet (Concesión 3):</h3>
              <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
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
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>Configuración de Tarifas & Reglas (`tarifas.json`)</h2>
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
                border: '1px solid rgba(56, 189, 248, 0.3)',
                background: '#070d18',
                color: '#f8fafc',
                lineHeight: 1.5
              }}
              value={tariffsJsonText}
              onChange={(e) => setTariffsJsonText(e.target.value)}
            />
          </div>
        )}
      </main>

      {/* MODAL PARA REGISTRAR ORDEN MANUAL */}
      {showManualModal && (
        <div className="manual-modal-overlay">
          <div className="manual-modal-card">
            <div style={{ padding: '1rem 1.5rem', background: '#0f1c32', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#f8fafc' }}>
                <PlusCircle size={18} className="text-emerald-400" />
                <span>Registrar Orden Manual de Rampa ({currentHub})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualOrder} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}># Orden de Servicio *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 458120"
                    className="form-input"
                    style={{ background: '#070d18', color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
                    value={manualForm.numero_orden}
                    onChange={(e) => setManualForm({ ...manualForm, numero_orden: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Matrícula</label>
                  <input
                    type="text"
                    placeholder="Ej. HI1098"
                    className="form-input"
                    style={{ background: '#070d18', color: '#f8fafc', fontWeight: 700 }}
                    value={manualForm.matricula}
                    onChange={(e) => setManualForm({ ...manualForm, matricula: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Posición / Gate</label>
                  <input
                    type="text"
                    placeholder="Ej. A2 / B29"
                    className="form-input"
                    style={{ background: '#070d18', color: '#f8fafc' }}
                    value={manualForm.posicion}
                    onChange={(e) => setManualForm({ ...manualForm, posicion: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Vuelo In</label>
                  <input
                    type="text"
                    placeholder="DM1020"
                    className="form-input"
                    style={{ background: '#070d18', color: '#f8fafc' }}
                    value={manualForm.vuelo_entrante}
                    onChange={(e) => setManualForm({ ...manualForm, vuelo_entrante: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Origen</label>
                  <input
                    type="text"
                    placeholder="MIA"
                    className="form-input"
                    style={{ background: '#070d18', color: '#f8fafc' }}
                    value={manualForm.origen}
                    onChange={(e) => setManualForm({ ...manualForm, origen: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Vuelo Out</label>
                  <input
                    type="text"
                    placeholder="DM1021"
                    className="form-input"
                    style={{ background: '#070d18', color: '#f8fafc' }}
                    value={manualForm.vuelo_saliente}
                    onChange={(e) => setManualForm({ ...manualForm, vuelo_saliente: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Destino</label>
                  <input
                    type="text"
                    placeholder="SDQ"
                    className="form-input"
                    style={{ background: '#070d18', color: '#f8fafc' }}
                    value={manualForm.destino}
                    onChange={(e) => setManualForm({ ...manualForm, destino: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Fecha y Hora Llegada *</label>
                  <input
                    type="text"
                    required
                    placeholder="2026-05-22T10:00"
                    className="form-input"
                    style={{ background: '#070d18', color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}
                    value={manualForm.llegada}
                    onChange={(e) => setManualForm({ ...manualForm, llegada: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Fecha y Hora Salida *</label>
                  <input
                    type="text"
                    required
                    placeholder="2026-05-22T11:00"
                    className="form-input"
                    style={{ background: '#070d18', color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}
                    value={manualForm.salida}
                    onChange={(e) => setManualForm({ ...manualForm, salida: e.target.value })}
                  />
                </div>
              </div>

              {/* Casillas de Servicios F-RAM */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: '6px' }}>
                  Servicios y Equipos Marcados en el Papel:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#070d18', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)' }}>
                  {manualForm.servicios.map((s: any, idx: number) => (
                    <label key={s.codigo} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#f8fafc', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={s.marcado}
                        onChange={(e) => {
                          const updated = [...manualForm.servicios];
                          updated[idx] = { ...updated[idx], marcado: e.target.checked };
                          setManualForm({ ...manualForm, servicios: updated });
                        }}
                      />
                      <span>{s.codigo}</span>
                      {s.valor_raw !== undefined && s.marcado && (
                        <input
                          type="text"
                          style={{ width: '45px', padding: '1px 4px', fontSize: '0.7rem', background: '#0b1424', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '3px', marginLeft: 'auto' }}
                          value={s.valor_raw}
                          onChange={(e) => {
                            const updated = [...manualForm.servicios];
                            updated[idx] = { ...updated[idx], valor_raw: e.target.value };
                            setManualForm({ ...manualForm, servicios: updated });
                          }}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: '#1e293b', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-success"
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                >
                  Guardar y Auditar Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Lote */}
      {dateToDelete && (
        <div className="manual-modal-overlay">
          <div style={{
            background: '#0b1424',
            borderRadius: '14px',
            maxWidth: '460px',
            width: '90%',
            padding: '1.75rem',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f8fafc'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Trash2 size={22} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              ¿Eliminar lote del {dateToDelete}?
            </h3>

            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Se eliminarán de forma permanente todas las órdenes registradas para la fecha <strong>{dateToDelete}</strong> en <strong>HUB {currentHub}</strong>.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={isDeletingDate}
                onClick={() => setDateToDelete(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#94a3b8',
                  fontSize: '0.82rem',
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
                  padding: '0.5rem 1.25rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: isDeletingDate ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={14} />
                <span>{isDeletingDate ? 'Eliminando...' : 'Sí, Eliminar Lote'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
