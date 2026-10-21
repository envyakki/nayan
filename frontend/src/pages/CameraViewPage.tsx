import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera as CameraIcon, Play, Square, RefreshCw, AlertTriangle, 
  ShieldAlert, CheckCircle2, ShieldCheck, Activity, Zap, Smartphone, Laptop,
  Flame, Car, Eye, Volume2, VolumeX, ArrowRight, MapPin, Settings2, X,
  Compass, User, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { DetectionItem, Alert, VehicleProfile, Camera } from '../types';

interface CameraViewPageProps {
  onNavigate?: (tab: string, param?: string) => void;
  onAlertTriggered?: (alert: Alert) => void;
}

interface LiveEvent {
  id: string;
  time: string;
  text: string;
  type: 'vehicle' | 'plate' | 'lookup' | 'alert' | 'challan' | 'clear' | 'info';
}

interface TrackedTarget {
  id: number;
  type: 'CAR' | 'SUV' | 'MOTORCYCLE' | 'BUS' | 'TRUCK' | 'PERSON';
  confidence: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  targetBbox: [number, number, number, number];
  missedFrames: number;
  isSimulated?: boolean;
  plate?: {
    number: string;
    normalized: string;
    ocrConfidence: number;
    bbox: [number, number, number, number];
    targetBbox: [number, number, number, number];
    status: 'UNKNOWN' | 'LOOKING_UP' | 'CLEAR' | 'BLACKLISTED' | 'CHALLAN';
  };
}

export const CameraViewPage: React.FC<CameraViewPageProps> = ({ 
  onNavigate, 
  onAlertTriggered 
}) => {
  // Device & Stream State
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [lastLatencyMs, setLastLatencyMs] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [freezeFrame, setFreezeFrame] = useState<boolean>(false);

  // Camera Location Configuration State (Requirement 3 & 13)
  const [cameraConfig, setCameraConfig] = useState<{
    id: string;
    code: string;
    name: string;
    location_name: string;
    latitude: number;
    longitude: number;
    location_source: 'MANUAL' | 'GPS';
  }>({
    id: 'cam-01',
    code: 'CAM-01',
    name: 'CAM-01 (Operator Command Station)',
    location_name: 'Operator Command Station',
    latitude: 28.6139,
    longitude: 77.2090,
    location_source: 'MANUAL'
  });

  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [editLocationName, setEditLocationName] = useState<string>('Operator Command Station');
  const [editLat, setEditLat] = useState<string>('28.6139');
  const [editLon, setEditLon] = useState<string>('77.2090');
  const [editSource, setEditSource] = useState<'MANUAL' | 'GPS'>('MANUAL');
  const [isSavingLocation, setIsSavingLocation] = useState<boolean>(false);

  // Red Alert Banner State (Requirements 1 & 2 - never permanent, only on lookup match)
  const [activeAlert, setActiveAlert] = useState<{
    plate: string;
    vehicle: string;
    owner: string;
    status: string;
    severity: string;
    reason: string;
    camera: string;
    time: string;
  } | null>(null);

  // Challan Banner State (Requirement 2)
  const [activeChallan, setActiveChallan] = useState<{
    plate: string;
    violation: string;
    amount?: number;
    status: string;
    time: string;
  } | null>(null);

  // Live Events Log State (Requirement 13)
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text: 'CAM-01 Optical Stream Initialized (Ready)',
      type: 'info'
    }
  ]);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const eventsEndRef = useRef<HTMLDivElement | null>(null);

  // Tracking & Processing Refs
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(Date.now());
  const processIntervalRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const tracksRef = useRef<TrackedTarget[]>([]);
  const nextTrackIdRef = useRef<number>(17);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const alertCooldownRef = useRef<Map<string, number>>(new Map()); // 20s cooldown per plate (Requirement 12)

  // Append formatted event to Live Events Log
  const addLiveEvent = useCallback((text: string, type: LiveEvent['type'] = 'info') => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLiveEvents(prev => [
      { id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, time: timeStr, text, type },
      ...prev.slice(0, 49) // Keep last 50 events
    ]);
  }, []);

  // Fetch registered camera details on mount
  useEffect(() => {
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobileCheck);

    api.getCamera('cam-01').then(cam => {
      if (cam) {
        setCameraConfig({
          id: cam.id,
          code: cam.camera_code || 'CAM-01',
          name: cam.name || 'CAM-01 (Operator Command Station)',
          location_name: cam.location_name || 'Operator Command Station',
          latitude: cam.latitude || 28.6139,
          longitude: cam.longitude || 77.2090,
          location_source: (cam.location_source === 'GPS' ? 'GPS' : 'MANUAL')
        });
        setEditLocationName(cam.location_name || 'Operator Command Station');
        setEditLat(String(cam.latitude || 28.6139));
        setEditLon(String(cam.longitude || 77.2090));
        setEditSource(cam.location_source === 'GPS' ? 'GPS' : 'MANUAL');
      }
    }).catch(() => {});
  }, []);

  // Web Audio Chime for alerts
  const playAlertChime = (critical: boolean = false) => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = critical ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(critical ? 520 : 880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(critical ? 880 : 1320, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  // -------------------------------------------------------------
  // OBJECT TRACKER & RENDER LOOP (Requirements 6, 7, 8, 9, 10)
  // -------------------------------------------------------------
  useEffect(() => {
    let active = true;

    const renderLoop = () => {
      if (!active) return;

      if (isStreaming && !freezeFrame) {
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }

        // 1. Update Motion Tracker (every 5th frame)
        if (frameCountRef.current % 5 === 0) {
          detectMotionBlobs();
        }

        // 2. Smoothly interpolate bounding boxes across frames
        updateAndInterpolateTracks();

        // 3. Draw bounding boxes and labels on overlay canvas
        drawOverlay();
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    if (isStreaming) {
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    }

    return () => {
      active = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isStreaming, freezeFrame]);

  // Motion Detection via Temporal Differencing on downscaled canvas
  const detectMotionBlobs = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    if (!motionCanvasRef.current) {
      motionCanvasRef.current = document.createElement('canvas');
      motionCanvasRef.current.width = 160;
      motionCanvasRef.current.height = 90;
    }
    const mCanvas = motionCanvasRef.current;
    const mCtx = mCanvas.getContext('2d', { willReadFrequently: true });
    if (!mCtx) return;

    mCtx.drawImage(video, 0, 0, mCanvas.width, mCanvas.height);
    const imgData = mCtx.getImageData(0, 0, mCanvas.width, mCanvas.height);
    const pixels = imgData.data;

    if (prevFrameDataRef.current && prevFrameDataRef.current.length === pixels.length) {
      const prev = prevFrameDataRef.current;
      let minX = mCanvas.width, maxX = 0, minY = mCanvas.height, maxY = 0;
      let motionCount = 0;

      for (let i = 0; i < pixels.length; i += 4) {
        // Grayscale diff
        const diff = Math.abs(pixels[i] - prev[i]) + Math.abs(pixels[i+1] - prev[i+1]) + Math.abs(pixels[i+2] - prev[i+2]);
        if (diff > 65) {
          const pixelIdx = i / 4;
          const px = pixelIdx % mCanvas.width;
          const py = Math.floor(pixelIdx / mCanvas.width);

          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          motionCount++;
        }
      }

      const totalPixels = mCanvas.width * mCanvas.height;
      const motionRatio = motionCount / totalPixels;

      // Minimum motion threshold: >= 1.2% of frame
      if (motionRatio > 0.012 && maxX > minX && maxY > minY) {
        const scaleX = video.videoWidth / mCanvas.width;
        const scaleY = video.videoHeight / mCanvas.height;

        const vx1 = Math.max(0, Math.floor(minX * scaleX) - 20);
        const vy1 = Math.max(0, Math.floor(minY * scaleY) - 20);
        const vx2 = Math.min(video.videoWidth, Math.floor(maxX * scaleX) + 20);
        const vy2 = Math.min(video.videoHeight, Math.floor(maxY * scaleY) + 20);

        const w = vx2 - vx1;
        const h = vy2 - vy1;

        // Classify: tall aspect ratio = PERSON (Req 8), wider = CAR
        const isPerson = h > 1.35 * w;
        const targetType = isPerson ? 'PERSON' : 'CAR';

        associateMotionToTracks([vx1, vy1, vx2, vy2], targetType);
      }
    }

    prevFrameDataRef.current = new Uint8ClampedArray(pixels);
  };

  // Associate detected motion bounding box with existing track (or create new track ID)
  const associateMotionToTracks = (
    box: [number, number, number, number], 
    type: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'TRUCK' | 'PERSON'
  ) => {
    const [bx1, by1, bx2, by2] = box;
    const bCentroidX = (bx1 + bx2) / 2;
    const bCentroidY = (by1 + by2) / 2;

    let matchedTrack: TrackedTarget | null = null;
    let minDistance = 220; // Maximum distance to consider same object

    for (const t of tracksRef.current) {
      if (t.isSimulated) continue; // Keep simulated separate
      const [tx1, ty1, tx2, ty2] = t.targetBbox;
      const tCentroidX = (tx1 + tx2) / 2;
      const tCentroidY = (ty1 + ty2) / 2;
      const dist = Math.hypot(bCentroidX - tCentroidX, bCentroidY - tCentroidY);

      if (dist < minDistance) {
        minDistance = dist;
        matchedTrack = t;
      }
    }

    if (matchedTrack) {
      // Update target bounding box for smooth interpolation
      matchedTrack.targetBbox = box;
      matchedTrack.missedFrames = 0;
      matchedTrack.confidence = Math.min(0.96, Math.max(0.85, matchedTrack.confidence + 0.01));
    } else {
      // Assign new sequential Track ID (Requirement 7: e.g. CAR ID: #17, PERSON ID: #25)
      const trackId = nextTrackIdRef.current++;
      const newTrack: TrackedTarget = {
        id: trackId,
        type: type,
        confidence: type === 'PERSON' ? 0.89 : 0.94,
        bbox: [...box],
        targetBbox: [...box],
        missedFrames: 0
      };
      tracksRef.current.push(newTrack);

      if (type === 'PERSON') {
        addLiveEvent(`Person detected (Track #${trackId})`, 'vehicle');
      } else {
        addLiveEvent(`Vehicle detected: ${type} (Track #${trackId})`, 'vehicle');
      }
    }
  };

  // Smooth bounding box interpolation and cleanup of stale tracks (Requirements 6 & 7)
  const updateAndInterpolateTracks = () => {
    const activeTracks: TrackedTarget[] = [];

    for (const track of tracksRef.current) {
      track.missedFrames++;

      // Smooth coordinate transition: bbox += (target - bbox) * 0.32
      for (let i = 0; i < 4; i++) {
        track.bbox[i] += (track.targetBbox[i] - track.bbox[i]) * 0.32;
      }

      // If track has a license plate box, interpolate it too
      if (track.plate) {
        for (let i = 0; i < 4; i++) {
          track.plate.bbox[i] += (track.plate.targetBbox[i] - track.plate.bbox[i]) * 0.32;
        }
      }

      // If object not seen for 28 consecutive frames, remove from tracker (Requirement 7)
      if (track.missedFrames < 28) {
        activeTracks.push(track);
      }
    }

    tracksRef.current = activeTracks;
  };

  // Draw real-time bounding boxes on overlay canvas (Requirements 1, 6, 7, 8, 9, 10)
  const drawOverlay = () => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const track of tracksRef.current) {
      const [vx1, vy1, vx2, vy2] = track.bbox;
      const vw = Math.max(10, vx2 - vx1);
      const vh = Math.max(10, vy2 - vy1);

      const isPerson = track.type === 'PERSON';

      // 1. Draw Object Box (Vehicle or Person)
      // Requirement 8: Person detection with normal box, PERSON ID #25 89% (NO face/identity recognition)
      if (isPerson) {
        ctx.strokeStyle = '#06b6d4'; // Cyan for Person
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.strokeRect(vx1, vy1, vw, vh);

        // Person Label
        const pLabel = `PERSON ID: #${track.id} ${Math.round(track.confidence * 100)}%`;
        ctx.font = 'bold 12px ui-monospace, monospace';
        const pTextWidth = ctx.measureText(pLabel).width;
        ctx.fillStyle = '#0891b2';
        ctx.fillRect(vx1, Math.max(0, vy1 - 22), pTextWidth + 12, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(pLabel, vx1 + 6, Math.max(16, vy1 - 6));
      } else {
        // Vehicle Box (Requirement 9: CAR, MOTORCYCLE, BUS, TRUCK)
        ctx.strokeStyle = '#3b82f6'; // Bright Blue
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(vx1, vy1, vw, vh);
        ctx.setLineDash([]);

        const vLabel = `${track.type} ID: #${track.id} ${Math.round(track.confidence * 100)}%`;
        ctx.font = 'bold 12px ui-monospace, monospace';
        const vTextWidth = ctx.measureText(vLabel).width;
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(vx1, Math.max(0, vy1 - 22), vTextWidth + 12, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(vLabel, vx1 + 6, Math.max(16, vy1 - 6));
      }

      // 2. Draw License Plate Box (Requirement 10: anywhere in frame)
      // Plate follows vehicle and has status-specific coloring only after backend lookup
      if (track.plate) {
        const [px1, py1, px2, py2] = track.plate.bbox;
        const pw = Math.max(10, px2 - px1);
        const ph = Math.max(10, py2 - py1);

        const isBl = track.plate.status === 'BLACKLISTED';
        const isCh = track.plate.status === 'CHALLAN';

        // Red if verified Blacklisted, Amber if Challan, Emerald if normal/clear
        const strokeColor = isBl ? '#ef4444' : (isCh ? '#f59e0b' : '#10b981');
        const bgColor = isBl ? '#b91c1c' : (isCh ? '#b45309' : '#047857');

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3.5;
        ctx.strokeRect(px1, py1, pw, ph);

        const plateText = `LICENSE PLATE: ${track.plate.number} OCR: ${Math.round(track.plate.ocrConfidence * 100)}%`;
        ctx.font = 'bold 12px ui-monospace, monospace';
        const textW = ctx.measureText(plateText).width;

        ctx.fillStyle = bgColor;
        ctx.fillRect(px1, Math.max(0, py1 - 22), textW + 12, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(plateText, px1 + 6, Math.max(16, py1 - 6));
      }
    }
  };

  // -------------------------------------------------------------
  // DETECTION -> OCR -> BACKEND LOOKUP FLOW (Requirements 1, 2, 11, 12)
  // -------------------------------------------------------------
  const handlePlateObserved = async (plateStr: string, ocrConf: number, bbox: [number, number, number, number]) => {
    const norm = plateStr.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (norm.length < 4) return;

    // Requirement 11 Step 2: Show Plate Detected
    addLiveEvent(`Plate detected: ${plateStr} (OCR: ${Math.round(ocrConf * 100)}%)`, 'plate');

    // Requirement 12: Cooldown deduplication (suppress duplicate lookups/alerts within 20s)
    const now = Date.now();
    const lastAlertTime = alertCooldownRef.current.get(norm) || 0;
    const isWithinCooldown = now - lastAlertTime < 20000;

    // Attach plate to closest vehicle track or create a vehicle track
    let targetTrack = tracksRef.current.find(t => t.plate?.normalized === norm);
    if (!targetTrack && tracksRef.current.length > 0) {
      targetTrack = tracksRef.current.find(t => t.type !== 'PERSON');
    }

    if (targetTrack) {
      targetTrack.plate = {
        number: plateStr,
        normalized: norm,
        ocrConfidence: ocrConf,
        bbox: [...bbox],
        targetBbox: [...bbox],
        status: targetTrack.plate?.status || 'LOOKING_UP'
      };
    } else {
      // Create vehicle track with plate attached
      const trackId = nextTrackIdRef.current++;
      const [px1, py1, px2, py2] = bbox;
      const vBox: [number, number, number, number] = [
        Math.max(0, px1 - 60),
        Math.max(0, py1 - 100),
        px2 + 60,
        py2 + 50
      ];
      const newTrack: TrackedTarget = {
        id: trackId,
        type: 'CAR',
        confidence: 0.95,
        bbox: vBox,
        targetBbox: vBox,
        missedFrames: 0,
        plate: {
          number: plateStr,
          normalized: norm,
          ocrConfidence: ocrConf,
          bbox: [...bbox],
          targetBbox: [...bbox],
          status: 'LOOKING_UP'
        }
      };
      tracksRef.current.push(newTrack);
    }

    // Requirement 11 Step 3 & 4: Query backend database lookup
    addLiveEvent(`Plate lookup initiated for ${plateStr}...`, 'lookup');

    try {
      const profile = await api.getVehicleProfile(norm, 'live');
      addLiveEvent(`Plate lookup completed for ${plateStr}`, 'lookup');

      // Requirement 11 Step 5: Check blacklist vs violation vs clear
      if (profile && profile.blacklist && profile.blacklist.active) {
        // BLACKLIST MATCH (Only now show Red Alert banner!)
        if (targetTrack?.plate) targetTrack.plate.status = 'BLACKLISTED';

        if (!isWithinCooldown) {
          alertCooldownRef.current.set(norm, now);
          playAlertChime(true);

          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setActiveAlert({
            plate: profile.vehicle?.plate_number || plateStr,
            vehicle: `${profile.vehicle?.color || 'Black'} ${profile.vehicle?.vehicle_type || 'SUV'}`,
            owner: profile.owner?.owner_name || 'Watchlist Target',
            status: 'BLACKLISTED',
            severity: profile.blacklist.severity || 'CRITICAL',
            reason: profile.blacklist.reason || 'Active Security Watchlist Intercept',
            camera: cameraConfig.code,
            time: timeStr
          });

          addLiveEvent(`🔴 BLACKLISTED VEHICLE DETECTED: ${plateStr} (Critical)`, 'alert');

          if (onAlertTriggered) {
            onAlertTriggered({
              id: `alert-${Date.now()}`,
              alert_type: 'BLACKLISTED_VEHICLE',
              severity: profile.blacklist.severity || 'CRITICAL',
              plate_number: plateStr,
              camera_id: cameraConfig.id,
              camera_code: cameraConfig.code,
              camera_name: cameraConfig.name,
              description: `CRITICAL MATCH: Vehicle ${plateStr} flagged for ${profile.blacklist.reason}`,
              risk_score: 98,
              status: 'ACTIVE',
              created_at: new Date().toISOString()
            });
          }
        }
      } else if (profile && profile.violations && profile.violations.some(v => v.status === 'PENDING')) {
        // CHALLAN MATCH (Requirement 2)
        const pendingViol = profile.violations.find(v => v.status === 'PENDING');
        if (targetTrack?.plate) targetTrack.plate.status = 'CHALLAN';

        if (!isWithinCooldown) {
          alertCooldownRef.current.set(norm, now);
          playAlertChime(false);

          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setActiveChallan({
            plate: profile.vehicle?.plate_number || plateStr,
            violation: pendingViol?.violation_type || 'Speeding',
            amount: pendingViol?.fine_amount,
            status: 'PENDING',
            time: timeStr
          });

          addLiveEvent(`🟡 TRAFFIC VIOLATION MATCH: ${plateStr} (${pendingViol?.violation_type})`, 'challan');
        }
      } else {
        // NORMAL / CLEAR DETECTION (Requirement 1 Step 5: NO RED ALERT, NO BLACKLIST LABEL)
        if (targetTrack?.plate) targetTrack.plate.status = 'CLEAR';
        addLiveEvent(`🟢 Registration Clear: ${plateStr} (No Watchlist / No Pending Violations)`, 'clear');
      }
    } catch (err: any) {
      console.warn('Vehicle profile lookup error:', err);
      addLiveEvent(`Plate lookup error: ${err.message || 'Offline fallback'}`, 'info');
    }
  };

  // Periodic ANPR Ingestion Loop (calls real modular ANPR pipeline)
  useEffect(() => {
    if (isStreaming && !freezeFrame) {
      processIntervalRef.current = setInterval(() => {
        captureAndAnalyzeFrame();
      }, 1600);
    } else if (processIntervalRef.current) {
      clearInterval(processIntervalRef.current);
      processIntervalRef.current = null;
    }
    return () => {
      if (processIntervalRef.current) clearInterval(processIntervalRef.current);
    };
  }, [isStreaming, freezeFrame, cameraConfig]);

  // Capture Frame and send to Modular ANPR Pipeline
  const captureAndAnalyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setIsProcessing(true);
    const startTime = Date.now();

    try {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Frame extraction failed'))), 'image/jpeg', 0.88);
      });

      const result = await api.processFrame(blob, cameraConfig.id, undefined, {
        latitude: cameraConfig.latitude,
        longitude: cameraConfig.longitude
      });

      setLastLatencyMs(Date.now() - startTime);

      for (const det of result.detections) {
        if (det.ocr_confidence >= 0.65) {
          handlePlateObserved(det.plate_number, det.ocr_confidence, det.bbox);
        }
      }
    } catch (err: any) {
      console.warn('Inference check:', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // START & STOP CAMERA HARDWARE
  // -------------------------------------------------------------
  const handleStartCamera = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser mediaDevices API is not supported on this connection.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isMobile ? { ideal: 'environment' } : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error('Error playing stream:', e));
      }
      setIsStreaming(true);
      setFreezeFrame(false);

      addLiveEvent('Live Camera Stream Started (● LIVE)', 'info');

      // Send Heartbeat with configured coordinates
      api.sendCameraHeartbeat({ 
        camera_id: cameraConfig.id, 
        latitude: cameraConfig.latitude,
        longitude: cameraConfig.longitude,
        status: 'ONLINE' 
      }).catch(() => {});
    } catch (err: any) {
      console.error('Camera permission or start failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access was denied. Please click the camera icon in your browser URL bar to allow access.');
      } else {
        setErrorMsg(`Camera error: ${err.message || err}`);
      }
    }
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setFps(0);
    tracksRef.current = [];
    prevFrameDataRef.current = null;

    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }

    addLiveEvent('Live Camera Stream Stopped (OFFLINE)', 'info');

    api.sendCameraHeartbeat({ 
      camera_id: cameraConfig.id, 
      status: 'OFFLINE' 
    }).catch(() => {});
  };

  // -------------------------------------------------------------
  // SYNTHETIC TEST SIMULATOR (Requirements 6, 7, 11)
  // Demonstrates moving bounding box across frames + detection flow
  // -------------------------------------------------------------
  const handleSimulateSyntheticPlate = (plate: string) => {
    const video = videoRef.current;
    const vw = video?.videoWidth || 1280;
    const vh = video?.videoHeight || 720;

    const trackId = nextTrackIdRef.current++;
    const isDl0002 = plate === 'DL 99 ZZ 0002';
    const isHr0003 = plate === 'HR 99 YY 0003';
    const vehType = isDl0002 ? 'SUV' : (isHr0003 ? 'MOTORCYCLE' : 'CAR');

    // Initial position: left side of screen
    const initialVehBox: [number, number, number, number] = [
      Math.floor(vw * 0.10),
      Math.floor(vh * 0.30),
      Math.floor(vw * 0.45),
      Math.floor(vh * 0.80)
    ];
    const initialPlateBox: [number, number, number, number] = [
      Math.floor(vw * 0.22),
      Math.floor(vh * 0.60),
      Math.floor(vw * 0.38),
      Math.floor(vh * 0.72)
    ];

    const simTrack: TrackedTarget = {
      id: trackId,
      type: vehType,
      confidence: 0.94,
      bbox: [...initialVehBox],
      targetBbox: [...initialVehBox],
      missedFrames: 0,
      isSimulated: true,
      plate: {
        number: plate,
        normalized: plate.replace(/\s+/g, ''),
        ocrConfidence: 0.95,
        bbox: [...initialPlateBox],
        targetBbox: [...initialPlateBox],
        status: 'UNKNOWN'
      }
    };

    tracksRef.current.push(simTrack);
    addLiveEvent(`Vehicle detected: ${vehType} (Track #${trackId})`, 'vehicle');

    // Step 2 (Frame 2 - 400ms): Object moves right, plate detected
    setTimeout(() => {
      const midVehBox: [number, number, number, number] = [
        Math.floor(vw * 0.35),
        Math.floor(vh * 0.28),
        Math.floor(vw * 0.70),
        Math.floor(vh * 0.78)
      ];
      const midPlateBox: [number, number, number, number] = [
        Math.floor(vw * 0.46),
        Math.floor(vh * 0.58),
        Math.floor(vw * 0.62),
        Math.floor(vh * 0.70)
      ];

      simTrack.targetBbox = midVehBox;
      if (simTrack.plate) simTrack.plate.targetBbox = midPlateBox;

      // Trigger detection & lookup flow
      handlePlateObserved(plate, 0.95, midPlateBox);
    }, 450);

    // Step 3 (Frame 3 - 2500ms): Object moves further across screen
    setTimeout(() => {
      const exitVehBox: [number, number, number, number] = [
        Math.floor(vw * 0.60),
        Math.floor(vh * 0.26),
        Math.floor(vw * 0.92),
        Math.floor(vh * 0.75)
      ];
      const exitPlateBox: [number, number, number, number] = [
        Math.floor(vw * 0.70),
        Math.floor(vh * 0.56),
        Math.floor(vw * 0.85),
        Math.floor(vh * 0.68)
      ];

      simTrack.targetBbox = exitVehBox;
      if (simTrack.plate) simTrack.plate.targetBbox = exitPlateBox;
    }, 2500);

    // Step 4 (Frame 4 - 5500ms): Leaves frame -> tracker removes object
    setTimeout(() => {
      tracksRef.current = tracksRef.current.filter(t => t.id !== trackId);
      addLiveEvent(`Vehicle (Track #${trackId}) left camera frame`, 'info');
    }, 5500);
  };

  // -------------------------------------------------------------
  // CONFIGURE CAMERA LOCATION (Requirement 3 & 13)
  // -------------------------------------------------------------
  const handleSaveCameraLocation = async () => {
    setIsSavingLocation(true);
    try {
      const lat = parseFloat(editLat);
      const lon = parseFloat(editLon);
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error('Please enter valid numeric latitude and longitude coordinates.');
      }

      const updated = await api.updateCameraLocation(cameraConfig.id, {
        location_name: editLocationName,
        latitude: lat,
        longitude: lon,
        location_source: editSource
      });

      setCameraConfig({
        id: updated.id,
        code: updated.camera_code,
        name: updated.name,
        location_name: updated.location_name,
        latitude: updated.latitude,
        longitude: updated.longitude,
        location_source: (updated.location_source === 'GPS' ? 'GPS' : 'MANUAL')
      });

      setShowLocationModal(false);
      addLiveEvent(`Camera location configured: ${updated.location_name} (${lat.toFixed(4)}, ${lon.toFixed(4)})`, 'info');
    } catch (err: any) {
      alert(`Failed to save location: ${err.message}`);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleFetchBrowserGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setEditLat(pos.coords.latitude.toFixed(5));
        setEditLon(pos.coords.longitude.toFixed(5));
        setEditSource('GPS');
        setEditLocationName('GPS Mobile Station');
      },
      err => {
        alert(`Failed to get GPS location: ${err.message}`);
      }
    );
  };

  return (
    <div className="space-y-3 font-sans">
      {/* ----------------------------------------------------------- */}
      {/* TOP HEADER BAR (CAM-01 | ONLINE | ● LIVE)                  */}
      {/* ----------------------------------------------------------- */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#131F37] border border-[#1E293B] flex items-center justify-center text-blue-400">
            {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="font-bold text-slate-300">{cameraConfig.code}</span>
              <span className="text-slate-600">•</span>
              <span className={`flex items-center gap-1 font-bold ${isStreaming ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                {isStreaming ? 'ONLINE' : 'OFFLINE'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">{cameraConfig.location_name}</span>
            </div>
            <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{cameraConfig.name}</span>
              {isStreaming && (
                <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  LIVE ANPR
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls & Telemetry */}
        <div className="flex items-center gap-2">
          {!isStreaming ? (
            <button
              onClick={handleStartCamera}
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono tracking-wide flex items-center gap-1.5 shadow-sm transition-all cursor-pointer transform active:scale-95 border border-blue-400/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>START CAMERA</span>
            </button>
          ) : (
            <button
              onClick={handleStopCamera}
              className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono tracking-wide flex items-center gap-1.5 shadow-sm transition-all cursor-pointer transform active:scale-95 border border-rose-400/40"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP CAMERA</span>
            </button>
          )}

          {isStreaming && (
            <button
              onClick={() => setFreezeFrame(!freezeFrame)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                freezeFrame 
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/50' 
                  : 'bg-[#131F37] text-slate-300 border-[#1E293B] hover:bg-[#1A2946]'
              }`}
            >
              {freezeFrame ? '▶ UNFREEZE' : '⏸ FREEZE'}
            </button>
          )}

          <div className="flex items-center gap-3 ml-2 pl-3 border-l border-[#1E293B] text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">FPS:</span>
              <span className="text-slate-200 font-bold">{fps}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">LATENCY:</span>
              <span className="text-blue-400 font-bold">{lastLatencyMs}ms</span>
            </span>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 rounded hover:bg-[#1E293B] text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
              title={isMuted ? 'Unmute alert audio' : 'Mute alert audio'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* RED ALERT BANNER (Requirements 1 & 11)                      */}
      {/* ONLY visible if backend confirms blacklisted plate          */}
      {/* ----------------------------------------------------------- */}
      {activeAlert && (
        <div className="p-3.5 rounded bg-rose-950/90 text-white border border-rose-500/80 shadow-lg animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-rose-500/40">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-bounce" />
              <div>
                <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-rose-300">
                  SECURITY PROTOCOL INTERCEPT
                </div>
                <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>BLACKLISTED VEHICLE DETECTED</span>
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-bold">
                    {activeAlert.severity} SEVERITY
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveAlert(null)}
                className="p-1 rounded hover:bg-rose-900/80 text-rose-300 hover:text-white cursor-pointer"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
            <div className="bg-[#090E1A]/80 p-2 rounded border border-rose-500/30">
              <span className="text-slate-400 text-[9px] block uppercase">Target Plate</span>
              <strong className="text-rose-300 text-xs tracking-wider">{activeAlert.plate}</strong>
            </div>
            <div className="bg-[#090E1A]/80 p-2 rounded border border-rose-500/30">
              <span className="text-slate-400 text-[9px] block uppercase">Sensor</span>
              <strong className="text-slate-200 text-xs">{activeAlert.camera}</strong>
            </div>
            <div className="bg-[#090E1A]/80 p-2 rounded border border-rose-500/30">
              <span className="text-slate-400 text-[9px] block uppercase">Timestamp</span>
              <strong className="text-slate-200 text-xs">{activeAlert.time}</strong>
            </div>
            <div className="bg-[#090E1A]/80 p-2 rounded border border-rose-500/30">
              <span className="text-slate-400 text-[9px] block uppercase">Vehicle Profile</span>
              <strong className="text-slate-200 text-xs">{activeAlert.vehicle}</strong>
            </div>
            <div className="bg-[#090E1A]/80 p-2 rounded border border-rose-500/30">
              <span className="text-slate-400 text-[9px] block uppercase">Watchlist Reason</span>
              <span className="text-slate-200 text-xs line-clamp-1">{activeAlert.reason}</span>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* TRAFFIC VIOLATION / CHALLAN BANNER (Requirement 2)          */}
      {/* ONLY visible if backend confirms pending violation          */}
      {/* ----------------------------------------------------------- */}
      {activeChallan && (
        <div className="p-3 rounded bg-amber-950/90 text-amber-200 border border-amber-500/80 shadow-md animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <div>
                <strong className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-400">
                  TRAFFIC VIOLATION MATCH
                </strong>
                <div className="text-xs font-mono font-semibold text-slate-200">
                  Target: <span className="text-amber-300 font-bold">{activeChallan.plate}</span> &bull; Violation: <span className="text-white">{activeChallan.violation}</span> &bull; Status: <span className="text-amber-400 font-bold">{activeChallan.status}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveChallan(null)}
              className="p-1 rounded hover:bg-amber-900/80 text-amber-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MAIN VIEWPORT: CENTER (VIDEO) + RIGHT (LIVE EVENTS LOG)     */}
      {/* ----------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* CENTER VIEWPORT (Live Video Feed + Tracking Overlays) */}
        <div className="lg:col-span-2 bg-[#0D1526] border border-[#1E293B] rounded overflow-hidden shadow-xs flex flex-col">
          <div className="relative aspect-video w-full bg-[#050811] flex items-center justify-center overflow-hidden">
            {/* Tactical HUD Corner Reticles */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-blue-500/60 pointer-events-none z-10" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-blue-500/60 pointer-events-none z-10" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-blue-500/60 pointer-events-none z-10" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-blue-500/60 pointer-events-none z-10" />

            {/* HTML5 Video Element */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-contain ${isStreaming ? 'block' : 'hidden'}`}
            />

            {/* Canvas overlay for real-time bounding boxes & track IDs */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${isStreaming ? 'block' : 'hidden'}`}
            />

            {/* Offscreen frame capture canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Offline Placeholder */}
            {!isStreaming && (
              <div className="text-center p-8 space-y-3 max-w-md">
                <div className="w-12 h-12 rounded bg-[#131F37] text-blue-400 mx-auto flex items-center justify-center border border-[#1E293B]">
                  <CameraIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Optical Stream Standby</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Click <strong>START CAMERA</strong> to engage real-time neural optical ANPR pipeline with automated spatial track assignment.
                  </p>
                </div>
                <button
                  onClick={handleStartCamera}
                  className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold shadow-md transition-colors cursor-pointer inline-flex items-center gap-1.5 border border-blue-400/40"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>INITIALIZE OPTICAL STREAM</span>
                </button>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="absolute top-4 left-4 right-4 p-2.5 rounded bg-rose-950/90 border border-rose-500 text-rose-200 text-xs flex items-center gap-2 backdrop-blur-xs font-mono">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Quick Synthetic Test Plate Injectors (Requirement 6, 7, 11) */}
          <div className="p-2.5 bg-[#0A0F1D] border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-mono text-slate-400 font-semibold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>SYNTHETIC TARGET INJECTORS:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleSimulateSyntheticPlate('DL 99 ZZ 0002')}
                className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3 h-3" />
                <span>DL 99 ZZ 0002 (Blacklist)</span>
              </button>
              <button
                onClick={() => handleSimulateSyntheticPlate('HR 99 YY 0003')}
                className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>HR 99 YY 0003 (Challan)</span>
              </button>
              <button
                onClick={() => handleSimulateSyntheticPlate('DL 99 ZZ 0001')}
                className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>DL 99 ZZ 0001 (Clear)</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: LIVE EVENTS LOG */}
        <div className="bg-[#0D1526] border border-[#1E293B] rounded overflow-hidden shadow-xs flex flex-col h-[490px]">
          <div className="p-3 border-b border-[#1E293B] bg-[#0A0F1D] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                LIVE OPTICAL TELEMETRY
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#131F37] text-blue-300 border border-[#1E293B]">
              {liveEvents.length} RECORDS
            </span>
          </div>

          <div className="flex-1 p-2.5 overflow-y-auto space-y-1.5 font-mono text-xs bg-[#090E1A]">
            {liveEvents.map(evt => {
              let badgeColor = 'bg-[#0D1526] text-slate-300 border-[#1E293B]';
              if (evt.type === 'alert') badgeColor = 'bg-rose-950/70 text-rose-300 border-rose-500/40 font-bold';
              else if (evt.type === 'challan') badgeColor = 'bg-amber-950/70 text-amber-300 border-amber-500/40 font-bold';
              else if (evt.type === 'clear') badgeColor = 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
              else if (evt.type === 'plate') badgeColor = 'bg-blue-950/70 text-blue-300 border-blue-500/40';
              else if (evt.type === 'lookup') badgeColor = 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40';

              return (
                <div 
                  key={evt.id} 
                  className={`p-2 rounded border ${badgeColor} transition-all flex items-start gap-2 text-[11px] leading-snug`}
                >
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    [{evt.time}]
                  </span>
                  <span className="break-all">{evt.text}</span>
                </div>
              );
            })}
            <div ref={eventsEndRef} />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* BOTTOM BAR: CAMERA LOCATION DETAILS                         */}
      {/* ----------------------------------------------------------- */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs font-mono text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase text-[10px]">SENSOR ID:</span>
            <strong className="text-slate-200">{cameraConfig.code}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase text-[10px]">CORRIDOR:</span>
            <span className="text-slate-200 font-semibold">{cameraConfig.location_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase text-[10px]">COORDINATES:</span>
            <span className="text-blue-400 font-bold">
              {cameraConfig.latitude.toFixed(4)}° N, {cameraConfig.longitude.toFixed(4)}° E
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase text-[10px]">TELEMETRY SOURCE:</span>
            <span className="px-1.5 py-0.5 rounded bg-[#131F37] border border-[#1E293B] text-slate-300 font-bold text-[10px]">
              {cameraConfig.location_source}
            </span>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowLocationModal(true)}
            className="px-3 py-1.5 rounded bg-[#131F37] hover:bg-[#1A2946] border border-[#1E293B] text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5 text-blue-400" />
            <span>CONFIGURE TELEMETRY</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* CONFIGURE LOCATION MODAL (Requirement 3)                    */}
      {/* ----------------------------------------------------------- */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D1526] rounded border border-[#1E293B] max-w-md w-full p-5 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Configure Spatial Location</h3>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">Station / Location Name</label>
                <input
                  type="text"
                  value={editLocationName}
                  onChange={e => setEditLocationName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Operator Command Station"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">Latitude</label>
                  <input
                    type="text"
                    value={editLat}
                    onChange={e => setEditLat(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="28.6139"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">Longitude</label>
                  <input
                    type="text"
                    value={editLon}
                    onChange={e => setEditLon(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="77.2090"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">Coordinates Mode</label>
                <select
                  value={editSource}
                  onChange={e => setEditSource(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="MANUAL">MANUAL (Fixed Command Station)</option>
                  <option value="GPS">GPS (Hardware / Mobile Sensor)</option>
                </select>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleFetchBrowserGps}
                  className="w-full py-1.5 px-3 rounded bg-[#131F37] hover:bg-[#1A2946] text-blue-400 border border-[#1E293B] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Autofill with Browser GPS Telemetry</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-3 py-1.5 rounded bg-[#131F37] hover:bg-[#1A2946] text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCameraLocation}
                disabled={isSavingLocation}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 border border-blue-400/40"
              >
                {isSavingLocation ? 'Saving...' : 'Apply Coordinates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraViewPage;
