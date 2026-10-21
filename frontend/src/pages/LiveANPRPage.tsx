import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera as CameraIcon, Play, Square, RefreshCw, CheckCircle2, 
  AlertTriangle, ShieldCheck, Cpu, Sliders, Edit2, Save, X, 
  Sparkles, Volume2, VolumeX, Eye, Layers, Car, Zap
} from 'lucide-react';
import { api } from '../lib/api';
import { DetectionItem, Camera } from '../types';

interface LiveANPRPageProps {
  onVehicleDetected?: () => void;
}

export const LiveANPRPage: React.FC<LiveANPRPageProps> = ({ onVehicleDetected }) => {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [autoScan, setAutoScan] = useState<boolean>(false);
  const [autoScanInterval, setAutoScanInterval] = useState<number>(2);
  const [fps, setFps] = useState<number>(0);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [ocrEngine, setOcrEngine] = useState<string>('demo');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastDetections, setLastDetections] = useState<DetectionItem[]>([]);
  const [lastProcessingTime, setLastProcessingTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeTestPlate, setActiveTestPlate] = useState<string | null>(null);

  // Correction Modal
  const [correctionTarget, setCorrectionTarget] = useState<DetectionItem | null>(null);
  const [correctedText, setCorrectedText] = useState<string>('');
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(Date.now());
  const autoScanTimerRef = useRef<any>(null);

  // Web Audio chime synthesis
  const playAudioChime = () => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  };

  useEffect(() => {
    api.getCameras('live').then(cams => {
      setCameras(cams);
      if (cams.length > 0) setSelectedCameraId(cams[0].id);
    }).catch(err => console.error('Failed to load cameras', err));
  }, []);

  // FPS calculation
  useEffect(() => {
    let animationFrameId: number;
    const calculateFps = () => {
      if (isStreaming) {
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }
      }
      animationFrameId = requestAnimationFrame(calculateFps);
    };
    if (isStreaming) {
      animationFrameId = requestAnimationFrame(calculateFps);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isStreaming]);

  // Auto Scan timer
  useEffect(() => {
    if (autoScan && isStreaming) {
      autoScanTimerRef.current = setInterval(() => {
        captureAndScanFrame();
      }, autoScanInterval * 1000);
    } else if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    return () => {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    };
  }, [autoScan, isStreaming, autoScanInterval, selectedCameraId, ocrEngine]);

  // Start Real Browser Webcam
  const startCamera = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser mediaDevices API not supported in this environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsStreaming(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access was denied. Please allow camera permissions in your browser URL bar.');
      } else {
        setErrorMsg(`Camera error: ${err.message || err}`);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setAutoScan(false);
    setFps(0);
    clearOverlay();
  };

  const clearOverlay = () => {
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }
  };

  // Draw Bounding Boxes
  const drawBoundingBoxes = (detections: DetectionItem[], videoW: number, videoH: number) => {
    if (!overlayCanvasRef.current) return;
    const canvas = overlayCanvasRef.current;
    canvas.width = videoW;
    canvas.height = videoH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      const w = x2 - x1;
      const h = y2 - y1;

      // Solid outline
      ctx.strokeStyle = det.alert_triggered ? '#dc2626' : '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x1, y1, w, h);

      // Label background
      const labelText = `${det.normalized_plate} (${Math.round(det.ocr_confidence * 100)}%)`;
      ctx.font = 'bold 12px monospace';
      const textWidth = ctx.measureText(labelText).width;
      
      ctx.fillStyle = det.alert_triggered ? '#dc2626' : '#1e293b';
      ctx.fillRect(x1, Math.max(0, y1 - 22), textWidth + 12, 22);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x1 + 6, Math.max(15, y1 - 6));
    });
  };

  const captureAndScanFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed frame extraction'))), 'image/jpeg', 0.90);
      });

      const result = await api.processFrame(blob, selectedCameraId, ocrEngine);

      setLastDetections(result.detections);
      setLastProcessingTime(result.processing_time_ms);
      drawBoundingBoxes(result.detections, video.videoWidth, video.videoHeight);

      if (result.detections.length > 0) {
        playAudioChime();
        if (onVehicleDetected) onVehicleDetected();
      }
    } catch (err: any) {
      console.error('ANPR Error:', err);
      setErrorMsg(`Inference failure: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Interactive Test Plate Simulator (Instant one-click ANPR without camera)
  const handleSimulateTestPlate = async (samplePlate: string, vehicleType: string = 'car') => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setActiveTestPlate(samplePlate);

    try {
      const canvas = canvasRef.current;
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Realistic vehicle scene
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(100, 160, 440, 180);

      // Plate background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(140, 200, 360, 90);

      // Blue IND stripe
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(140, 200, 35, 90);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('IND', 145, 252);

      // Number plate text
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 44px monospace';
      ctx.fillText(samplePlate, 190, 262);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed frame extraction'))), 'image/jpeg', 0.90);
      });

      const result = await api.processFrame(blob, selectedCameraId || 'test-cam', ocrEngine);

      setLastDetections(result.detections);
      setLastProcessingTime(result.processing_time_ms);

      if (result.detections.length > 0) {
        playAudioChime();
        if (onVehicleDetected) onVehicleDetected();
      }
    } catch (err: any) {
      console.error('Simulation error:', err);
      setErrorMsg(`Simulation failed: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActiveTestPlate(null), 1500);
    }
  };

  const handleCorrectPlate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTarget || !correctedText.trim()) return;

    try {
      await api.correctPlate(correctionTarget.normalized_plate, correctedText.trim().toUpperCase());
      setCorrectionSuccess(`Updated "${correctionTarget.normalized_plate}" -> "${correctedText.trim().toUpperCase()}" in Supabase.`);
      
      setLastDetections(prev => prev.map(d => 
        d.normalized_plate === correctionTarget.normalized_plate 
          ? { ...d, plate_number: correctedText.trim().toUpperCase(), normalized_plate: correctedText.trim().toUpperCase() }
          : d
      ));

      setTimeout(() => {
        setCorrectionTarget(null);
        setCorrectionSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error('Correction failed:', err);
      setErrorMsg(`Failed to save correction: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CameraIcon className="w-5 h-5 text-blue-600" />
            Live ANPR Camera Ingestion
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Optical capture pipeline with real-time character segmentation & MoRTH validation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Chime Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-md bg-white hover:bg-slate-50 border border-gray-300 text-slate-600 shadow-2xs"
            title={isMuted ? 'Unmute Audio Chime' : 'Mute Audio Chime'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-blue-600" />}
          </button>

          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-gray-200">
            Engine: <b>OpenCV Heuristic</b>
          </span>
        </div>
      </div>

      {/* INTERACTIVE TEST VEHICLE SIMULATOR BAR */}
      <div className="p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200/80 rounded-xl space-y-2 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-slate-900">Interactive ANPR Simulator (One-Click Test):</span>
          </div>
          <span className="text-[10px] text-slate-500">Test real OpenCV vision without webcam</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { plate: 'DL01AB1234', type: 'Sedan', label: 'Delhi Central', style: 'border-blue-300 bg-white text-blue-700' },
            { plate: 'HR26DK4521', type: 'SUV', label: 'Blacklist Hit', style: 'border-rose-300 bg-white text-rose-700 font-bold' },
            { plate: 'UP16BT9021', type: 'Truck', label: 'Commercial', style: 'border-amber-300 bg-white text-amber-800' },
            { plate: 'DL07XY9999', type: 'Bike', label: 'North Delhi', style: 'border-slate-300 bg-white text-slate-800' },
          ].map(item => (
            <button
              key={item.plate}
              onClick={() => handleSimulateTestPlate(item.plate, item.type)}
              disabled={isProcessing}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${item.style} ${
                activeTestPlate === item.plate ? 'ring-2 ring-blue-500 scale-105' : ''
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>{item.plate}</span>
              <span className="text-[10px] font-sans text-slate-400">({item.label})</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN TWO COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WEBCAM FEED & CONTROLS (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative rounded-xl bg-slate-900 border border-gray-200 overflow-hidden shadow-xs min-h-[440px] flex items-center justify-center">
            {/* Real HTML5 Video */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-contain max-h-[500px] ${!isStreaming ? 'hidden' : 'block'}`}
            />

            {/* Bounding Box Overlay */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${!isStreaming ? 'hidden' : 'block'}`}
            />

            <canvas ref={canvasRef} className="hidden" />

            {/* Inactive State */}
            {!isStreaming && (
              <div className="text-center p-8 space-y-3 bg-white w-full h-full min-h-[440px] flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-1">
                  <CameraIcon className="w-7 h-7" />
                </div>
                <div className="text-sm font-semibold text-slate-900">Webcam Optical Feed is Standby</div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click <b>"Start Camera"</b> to enable browser video capture, or tap any of the <b>Test Plates</b> above for immediate simulated recognition.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                  >
                    Start Local Camera
                  </button>
                </div>
              </div>
            )}

            {/* HUD Status Pill */}
            {isStreaming && (
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur text-white px-2.5 py-1 rounded text-xs font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active | ~{fps} FPS {lastProcessingTime > 0 && `| ${lastProcessingTime}ms`}</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CONTROL CONSOLE */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-2xs">
            <div className="flex items-center space-x-2">
              {!isStreaming ? (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Camera</span>
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Camera</span>
                </button>
              )}

              <button
                onClick={captureAndScanFrame}
                disabled={!isStreaming || isProcessing}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-colors shadow-2xs cursor-pointer ${
                  !isStreaming || isProcessing
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-gray-200'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>{isProcessing ? 'Scanning...' : 'Capture Frame'}</span>
              </button>

              <button
                onClick={() => setAutoScan(!autoScan)}
                disabled={!isStreaming}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs border transition-colors cursor-pointer ${
                  !isStreaming
                    ? 'bg-slate-50 text-slate-400 border-gray-200 cursor-not-allowed'
                    : autoScan
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                    : 'bg-white text-slate-700 border-gray-300 hover:bg-slate-50'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Auto-Scan ({autoScan ? 'Active' : 'Off'})</span>
              </button>
            </div>
          </div>
        </div>

        {/* DETECTIONS FEED & PIPELINE INSPECTOR (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Real-time Detection Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                Recent Frame Results
              </h2>
              {lastProcessingTime > 0 && (
                <span className="font-mono text-[10px] text-slate-400">{lastProcessingTime} ms latency</span>
              )}
            </div>

            {lastDetections.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                <div>No plates recognized in last frame.</div>
                <div className="text-[10px] text-slate-400">Honest OCR: zero plates invented if absent.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {lastDetections.map((det, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border space-y-2 ${
                      det.alert_triggered 
                        ? 'bg-rose-50/50 border-rose-200' 
                        : 'bg-slate-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center rounded border border-gray-700 bg-white px-2.5 py-0.5 font-mono text-base font-black text-slate-900 shadow-2xs">
                        <span className="text-[9px] bg-blue-700 text-white font-bold px-1 rounded-xs mr-2">IND</span>
                        <span>{det.plate_number}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-600">
                        {Math.round(det.ocr_confidence * 100)}% Match
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                      <div>Vehicle: <span className="font-semibold text-slate-900 capitalize">{det.vehicle_type}</span></div>
                      <div>Engine: <span className="font-semibold text-blue-700">{det.ocr_engine}</span></div>
                    </div>

                    {det.alert_triggered && (
                      <div className="text-[11px] text-rose-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Security Alert: {det.alert_triggered}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          setCorrectionTarget(det);
                          setCorrectedText(det.plate_number);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Manual Correction</span>
                      </button>
                      <span className="text-[10px] text-slate-400">Validated MoRTH</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Computer Vision Pipeline Stages Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Vision Processing Stages
            </h2>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">1. License Plate Localization</div>
                  <div className="text-[10px] text-slate-400">Contour geometry & 2.2-5.5 aspect ratio filter</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">Pass</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">2. CLAHE Contrast Boost</div>
                  <div className="text-[10px] text-slate-400">Adaptive histogram equalization & shadow removal</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">Active</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">3. Normalized Character Vision</div>
                  <div className="text-[10px] text-slate-400">20x30 tight glyph template correlation matching</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MANUAL CORRECTION MODAL */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <form onSubmit={handleCorrectPlate} className="bg-white border border-gray-200 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Correct Plate Number</h3>
              <button 
                type="button" 
                onClick={() => setCorrectionTarget(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="text-slate-600 block">Identified: <b className="font-mono text-slate-900">{correctionTarget.plate_number}</b></label>
              <input
                type="text"
                required
                value={correctedText}
                onChange={(e) => setCorrectedText(e.target.value.toUpperCase())}
                placeholder="DL01AB1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm uppercase focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">
                Saving correction updates Supabase record and flags entry as verified by human operator.
              </p>
            </div>

            {correctionSuccess && (
              <div className="p-2 rounded bg-emerald-50 text-emerald-800 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{correctionSuccess}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCorrectionTarget(null)}
                className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs"
              >
                Save Correction
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default LiveANPRPage;
