import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera as CamIcon, ShieldAlert, Car, Activity, Zap, AlertTriangle, 
  ChevronRight, RefreshCw, ArrowUpRight, Clock, ShieldCheck,
  Sparkles, Crosshair, Video, VideoOff, Upload, CheckCircle2,
  AlertOctagon, Eye, Search, Layers, Play, Square, MapPin, Gauge,
  Radio, HardDrive, Shield, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { 
  TrafficSummary, CameraSummary, Camera as CameraType, Alert, 
  Observation, DetectionItem 
} from '../types';
import { TrafficMap } from '../components/map/TrafficMap';

interface DashboardPageProps {
  mode: 'live' | 'demo';
  onNavigate: (tab: string, param?: string) => void;
  onToggleMode?: (newMode: 'live' | 'demo') => void;
  onReloadData?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
  mode, 
  onNavigate, 
  onToggleMode,
  onReloadData 
}) => {
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [camSummary, setCamSummary] = useState<CameraSummary>({ online: 0, offline: 0, degraded: 0, total: 0 });
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentDetections, setRecentDetections] = useState<Observation[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // WEBCAM & ANPR SCANNER STATE
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [webcamLoading, setWebcamLoading] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<'IDLE' | 'SCANNING' | 'DETECTED'>('IDLE');
  const [fps, setFps] = useState<number>(0);
  const [lastProcessedTime, setLastProcessedTime] = useState<string | null>(null);
  const [currentDetections, setCurrentDetections] = useState<DetectionItem[]>([]);
  const [activeBlacklistAlert, setActiveBlacklistAlert] = useState<{
    plate: string;
    reason: string;
    camera: string;
    time: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingIntervalRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastFpsTimeRef = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);
  const isProcessingFrameRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subtle sound chime
  const playAlertChime = useCallback((freq = 880, type: 'critical' | 'normal' = 'normal') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type === 'critical' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (type === 'critical' ? 0.45 : 0.25));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (type === 'critical' ? 0.45 : 0.25));
    } catch {}
  }, []);

  const loadData = async () => {
    try {
      const [sumData, camSum, camList, alertList, obsList] = await Promise.all([
        api.getTrafficSummary(mode).catch(() => null),
        api.getCameraSummary(mode).catch(() => ({ online: 0, offline: 0, degraded: 0, total: 0 })),
        api.getCameras(mode).catch(() => []),
        api.getAlerts(undefined, undefined, mode).catch(() => []),
        api.getObservations(undefined, 10, mode).catch(() => [])
      ]);
      if (sumData) setSummary(sumData);
      setCamSummary(camSum);
      setCameras(camList);
      setAlerts(alertList);
      setRecentDetections(obsList);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [mode]);

  // Handle Demo dataset controls
  const handleLoadDemo = async () => {
    try {
      setActionNotice('Populating synthetic demo dataset...');
      await api.loadDemoData();
      await loadData();
      setActionNotice('Demo dataset active with synthetic records (DL 99 ZZ 0001, DL 99 ZZ 0002, HR 99 YY 0003).');
      playAlertChime(660);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e) {
      setActionNotice('Failed to load demo dataset');
    }
  };

  const handleClearDemo = async () => {
    try {
      setActionNotice('Purging demo records...');
      await api.clearDemoData();
      await loadData();
      setActionNotice('All demo records cleared. Live mode active.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (e) {
      setActionNotice('Failed to clear demo records');
    }
  };

  // START WEBCAM
  const startWebcam = async () => {
    setWebcamLoading(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam not supported in this browser context.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, min: 24 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsWebcamActive(true);
      setProcessingStatus('SCANNING');
      setFps(30);
      playAlertChime(880);

      // Register / Heartbeat CAM-01
      api.sendCameraHeartbeat({ camera_id: 'cam-01', status: 'ONLINE' }).catch(() => {});

      // Real render FPS tracker (counts smooth browser frames)
      frameCountRef.current = 0;
      lastFpsTimeRef.current = Date.now();
      const trackRealFps = () => {
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }
        animFrameIdRef.current = requestAnimationFrame(trackRealFps);
      };
      animFrameIdRef.current = requestAnimationFrame(trackRealFps);

      // Periodic ANPR detection processing loop (every 1.0s)
      processingIntervalRef.current = setInterval(processWebcamFrame, 1000);
    } catch (err: any) {
      console.error('Failed to start webcam:', err);
      setActionNotice(`Webcam Error: ${err.message || 'Permission denied'}`);
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setWebcamLoading(false);
    }
  };

  // STOP WEBCAM
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    setIsWebcamActive(false);
    setProcessingStatus('IDLE');
    setFps(0);
    setCurrentDetections([]);
    api.sendCameraHeartbeat({ camera_id: 'cam-01', status: 'OFFLINE' }).catch(() => {});
  };

  // PROCESS WEBCAM FRAME FOR ANPR
  const processWebcamFrame = async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
    if (isProcessingFrameRef.current) return;
    isProcessingFrameRef.current = true;

    const video = videoRef.current;
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth || 640;
    captureCanvas.height = video.videoHeight || 480;
    const captureCtx = captureCanvas.getContext('2d');
    if (!captureCtx) {
      isProcessingFrameRef.current = false;
      return;
    }
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    captureCanvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const res = await api.processFrame(blob, 'cam-01');
        setLastProcessedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

        if (res.detections && res.detections.length > 0) {
          setCurrentDetections(res.detections);
          setProcessingStatus('DETECTED');
          drawDetectionsOnCanvas(res.detections, captureCanvas.width, captureCanvas.height);

          for (const det of res.detections) {
            if (det.normalized_plate.includes('ZZ0002') || det.plate_number.includes('DL 99 ZZ 0002')) {
              playAlertChime(440, 'critical');
              setActiveBlacklistAlert({
                plate: det.plate_number,
                reason: 'Synthetic Watchlist Intercept (Critical)',
                camera: 'CAM-01 (Operator Command Station)',
                time: new Date().toLocaleTimeString()
              });
              break;
            }
          }
        } else {
          setProcessingStatus('SCANNING');
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      } catch (e) {
        // silent error during loop
      } finally {
        isProcessingFrameRef.current = false;
      }
    }, 'image/jpeg', 0.85);
  };

  // DRAW BOUNDING BOXES ON ACTIVE CANVAS
  const drawDetectionsOnCanvas = (detections: DetectionItem[], w: number, h: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      const isBlacklist = det.normalized_plate.includes('ZZ0002') || det.plate_number.includes('DL 99 ZZ 0002');
      const boxColor = isBlacklist ? '#ef4444' : '#10b981';

      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      ctx.fillStyle = boxColor;
      const label = `${det.plate_number} (${Math.round(det.ocr_confidence * 100)}%)`;
      ctx.font = 'bold 12px monospace';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x1, Math.max(0, y1 - 20), textWidth + 8, 20);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x1 + 4, Math.max(14, y1 - 5));
    });
  };

  // SIMULATE SYNTHETIC TEST PLATES (1-Click Verification)
  const triggerSyntheticPlateTest = async (plate: string, vehType: string, isAlert: boolean) => {
    try {
      const obs = await api.simulateObservation(plate, 'cam-01');
      playAlertChime(isAlert ? 440 : 880, isAlert ? 'critical' : 'normal');

      setCurrentDetections([{
        plate_number: plate,
        normalized_plate: plate.replace(/\s+/g, ''),
        ocr_confidence: 0.98,
        detection_confidence: 0.95,
        vehicle_type: vehType,
        bbox: [100, 150, 380, 240],
        ocr_engine: 'modular_anpr',
        is_demo: false,
        alert_triggered: isAlert ? 'BLACKLISTED_VEHICLE' : undefined
      }]);

      if (isAlert) {
        setActiveBlacklistAlert({
          plate: plate,
          reason: 'Synthetic Watchlist Intercept (Critical Priority)',
          camera: 'CAM-01 (Operator Command Station)',
          time: new Date().toLocaleTimeString()
        });
      } else {
        setActiveBlacklistAlert(null);
      }

      setActionNotice(`Processed ANPR test for plate ${plate}. Logged to live feed.`);
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    } catch (e: any) {
      setActionNotice(`Simulation failed: ${e.message}`);
    }
  };

  // MANUAL FILE UPLOAD SCAN
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionNotice(`Analyzing vehicle snapshot: ${file.name}...`);
    try {
      const res = await api.processFrame(file, 'cam-01');
      if (res.detections && res.detections.length > 0) {
        setCurrentDetections(res.detections);
        setActionNotice(`Successfully recognized plate: ${res.detections[0].plate_number}`);
        playAlertChime(880);
      } else {
        setActionNotice('No high-contrast license plate recognized in this image.');
      }
      loadData();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Upload scan error: ${err.message}`);
    }
  };

  // ACKNOWLEDGE ALERT
  const handleAcknowledgeAlert = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.acknowledgeAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      setActionNotice('Threat alert acknowledged.');
      setTimeout(() => setActionNotice(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE');
  const highAlerts = alerts.filter(a => a.severity === 'HIGH' && a.status === 'ACTIVE');
  const mediumAlerts = alerts.filter(a => a.severity === 'MEDIUM' && a.status === 'ACTIVE');

  return (
    <div className="space-y-2.5 pb-4 font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER (COMMAND OVERVIEW & SYNC)                           */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between pb-0.5">
        <div>
          <h1 className="text-sm font-bold font-mono tracking-tight text-slate-900 uppercase">
            COMMAND OVERVIEW
          </h1>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            System-wide surveillance and ANPR telemetry
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-mono text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>SYNC</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. 4 METRIC KPI CARDS                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* CARD 1: CAMERA NODES */}
        <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between font-mono text-[10px] font-bold tracking-wider">
            <span className="text-slate-500 uppercase">CAMERA NODES</span>
            <span className="text-emerald-600 flex items-center gap-1 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {camSummary.online} ONLINE
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {camSummary.total}
          </div>
          <div className="text-right font-mono text-[10px] text-slate-400">
            {camSummary.offline} offline
          </div>
        </div>

        {/* CARD 2: ANPR READS */}
        <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between font-mono text-[10px] font-bold tracking-wider">
            <span className="text-slate-500 uppercase">ANPR READS</span>
            <span className="text-slate-400 font-normal text-[10px] uppercase">24H WINDOW</span>
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {summary ? summary.anpr_reads_today.toLocaleString() : recentDetections.length}
          </div>
          <div className="text-right font-mono text-[10px] text-slate-400">
            ~{summary ? Math.max(0, Math.round(summary.anpr_reads_today / 60)) : 0} /min
          </div>
        </div>

        {/* CARD 3: VEHICLES TRACKED */}
        <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between font-mono text-[10px] font-bold tracking-wider">
            <span className="text-slate-500 uppercase">VEHICLES TRACKED</span>
            <span className="text-teal-600 text-[10px] uppercase font-bold">UNIQUE</span>
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {summary?.vehicles_today || recentDetections.length}
          </div>
          <div className="text-right font-mono text-[10px] text-slate-400">
            active registry
          </div>
        </div>

        {/* CARD 4: OPEN INCIDENTS */}
        <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between font-mono text-[10px] font-bold tracking-wider">
            <span className="text-slate-500 uppercase">OPEN INCIDENTS</span>
            <span className="text-emerald-600 text-[10px] uppercase font-bold">
              {alerts.length === 0 ? 'CLEAR' : `${alerts.length} ACTIVE`}
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {alerts.length}
          </div>
          <div className="text-right font-mono text-[10px]">
            <button
              onClick={() => onNavigate('alerts')}
              className="text-teal-600 hover:text-teal-700 cursor-pointer"
            >
              Triage &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. 2-COLUMN MAIN WORKBENCH (SURVEILLANCE & GIS)               */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* LEFT: LIVE SURVEILLANCE - CAM-01 */}
        <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isWebcamActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 font-mono">
                  LIVE SURVEILLANCE &mdash; CAM-01
                </h3>
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {isWebcamActive ? '640x480 · ACTIVE · ONLINE' : '640x480 · STANDBY · OFFLINE'}
              </div>
            </div>

            {/* Viewfinder Container (Compact standard height) */}
            <div className="relative mt-2 rounded-md overflow-hidden bg-[#070b14] h-[240px] border border-slate-800 flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay
                playsInline 
                muted 
                className={`w-full h-full object-cover ${isWebcamActive ? 'block' : 'hidden'}`} 
              />
              <canvas 
                ref={canvasRef} 
                className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${isWebcamActive ? 'block' : 'hidden'}`} 
              />

              {!isWebcamActive && (
                <div className="text-center p-4 space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <CamIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                      OPTICAL STREAM STANDBY
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto leading-relaxed font-sans">
                      Station optical sensor ready. Engage live stream or trigger test target injection below.
                    </div>
                  </div>
                  <button
                    onClick={startWebcam}
                    disabled={webcamLoading}
                    className="px-4 py-1.5 rounded bg-[#0d9488] hover:bg-[#0f766e] text-white font-mono font-bold text-xs transition-colors flex items-center gap-1.5 mx-auto cursor-pointer shadow-xs mt-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{webcamLoading ? 'INITIALIZING...' : 'START OPTICAL STREAM'}</span>
                  </button>
                </div>
              )}

              {isWebcamActive && (
                <>
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
                    <span className="bg-slate-950/80 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-mono font-bold border border-slate-700">
                      {fps} FPS
                    </span>
                    <span className="bg-slate-950/80 text-teal-400 px-2 py-0.5 rounded text-[9px] font-mono border border-slate-700">
                      STAT: {processingStatus}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      onClick={stopWebcam}
                      className="bg-slate-800 hover:bg-slate-700 text-white p-1 rounded text-xs transition-colors cursor-pointer border border-slate-700"
                      title="Stop Optical Stream"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                  {lastProcessedTime && (
                    <div className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 pointer-events-none">
                      FRAME SYNC: {lastProcessedTime}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Recognized Plate Target Readout (Clean Neutral) */}
            {currentDetections.length > 0 && (
              <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>DETECTED TARGETS</span>
                  <span className="text-teal-700 font-bold">{currentDetections.length} RECOGNIZED</span>
                </div>
                <div className="space-y-1">
                  {currentDetections.map((det, idx) => (
                    <div 
                      key={idx}
                      onClick={() => onNavigate('vehicles', det.plate_number)}
                      className="p-2 rounded border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="font-bold text-slate-900">{det.plate_number}</span>
                      <span className="text-[11px] text-slate-500">
                        {det.vehicle_type} &bull; {Math.round(det.ocr_confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: SURVEILLANCE GIS */}
        <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
              <div className="flex items-center space-x-1.5">
                <Crosshair className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 font-mono">
                  SURVEILLANCE GIS
                </h3>
              </div>
              <div className="font-mono text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-teal-700 font-bold">{camSummary.online} ONLINE</span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-slate-400">{camSummary.total} NODES</span>
              </div>
            </div>

            {/* Map Container */}
            <div className="relative h-[240px] rounded-md overflow-hidden border border-slate-200">
              <TrafficMap 
                cameras={cameras}
                height="100%"
                selectedCameraId={selectedCameraId}
                onSelectCamera={(c) => setSelectedCameraId(c.id)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. TARGET SIMULATION & INGESTION (FULL-WIDTH WORKBENCH)        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-2.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
            TARGET SIMULATION & INGESTION
          </span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-mono text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Snapshot</span>
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="image/*" 
          className="hidden" 
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <button
            onClick={() => triggerSyntheticPlateTest('DL 99 ZZ 0001', 'Sedan', false)}
            className="py-2.5 px-3 rounded bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-center cursor-pointer transition-colors shadow-2xs"
          >
            <span className="block font-bold text-sm tracking-wide">DL 99 ZZ 0001</span>
            <span className="text-xs text-slate-500 mt-0.5 block font-sans">Clear [Sedan]</span>
          </button>
          <button
            onClick={() => triggerSyntheticPlateTest('DL 99 ZZ 0002', 'SUV', false)}
            className="py-2.5 px-3 rounded bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-center cursor-pointer transition-colors shadow-2xs"
          >
            <span className="block font-bold text-sm tracking-wide">DL 99 ZZ 0002</span>
            <span className="text-xs text-slate-500 mt-0.5 block font-sans">Target [SUV]</span>
          </button>
          <button
            onClick={() => triggerSyntheticPlateTest('HR 99 YY 0003', 'Motorcycle', false)}
            className="py-2.5 px-3 rounded bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-center cursor-pointer transition-colors shadow-2xs"
          >
            <span className="block font-bold text-sm tracking-wide">HR 99 YY 0003</span>
            <span className="text-xs text-slate-500 mt-0.5 block font-sans">Target [Bike]</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. REAL-TIME ANPR TELEMETRY TABLE (CLEAN NEUTRAL THEME)       */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 font-mono">
                REAL-TIME ANPR TELEMETRY LOG
              </h3>
              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px] font-bold border border-slate-200">
                STATION-STREAM
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Chronological log of automated license plate recognitions across active camera nodes.
            </p>
          </div>
          <button
            onClick={() => onNavigate('vehicles')}
            className="text-xs font-mono font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
          >
            <span>GLOBAL VEHICLE SEARCH</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 text-[10px] font-mono font-bold uppercase tracking-wider">
                <th className="py-2 px-3">TIMESTAMP</th>
                <th className="py-2 px-3">PLATE IDENTIFIER</th>
                <th className="py-2 px-3">VEHICLE CLASS</th>
                <th className="py-2 px-3">CAMERA NODE</th>
                <th className="py-2 px-3">LOCATION</th>
                <th className="py-2 px-3">OCR CONF</th>
                <th className="py-2 px-3">STATUS</th>
                <th className="py-2 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {recentDetections.length > 0 ? (
                recentDetections.map((obs) => {
                  return (
                    <tr 
                      key={obs.id} 
                      onClick={() => onNavigate('vehicles', obs.plate_number)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-bold font-mono px-2 py-0.5 rounded border text-[11px] bg-slate-100 text-slate-900 border-slate-300">
                          {obs.plate_number}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans capitalize text-slate-800 text-[11px]">
                        {obs.vehicle_type || 'Car'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-teal-700 font-semibold">
                        {obs.camera_code || 'CAM-01'}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 truncate max-w-[200px] text-[11px]">
                        {obs.location_name || 'Operator Command Station'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">
                            {Math.round(obs.ocr_confidence * 100)}%
                          </span>
                          <div className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div 
                              className="h-full bg-teal-600" 
                              style={{ width: `${Math.round(obs.ocr_confidence * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[9px] bg-slate-100 text-slate-700 border border-slate-300">
                          OBSERVED
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap font-mono text-[11px]">
                        <span className="text-teal-700 hover:text-teal-900 font-bold">
                          DOSSIER &rarr;
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-400 font-mono text-xs">
                    No license plates recorded on station yet. Start optical stream or simulate vehicle sighting above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
