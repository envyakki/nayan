import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Navigation, Play, Pause, RotateCcw, AlertTriangle, 
  Clock, Activity, MapPin, Search, ArrowRight, ShieldCheck, Zap, AlertOctagon,
  ChevronLeft, ChevronRight, Gauge, FastForward, FileSearch, Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { TrajectoryData, Camera, TrajectoryPoint } from '../types';
import { TrafficMap } from '../components/map/TrafficMap';

interface TrajectoryPageProps {
  initialPlate?: string;
  mode?: 'live' | 'demo';
  onNavigateInvestigation?: (plate: string) => void;
}

export const TrajectoryPage: React.FC<TrajectoryPageProps> = ({ 
  initialPlate = 'DL01AB1234',
  mode = 'live',
  onNavigateInvestigation
}) => {
  const [plate, setPlate] = useState<string>(initialPlate);
  const [searchInput, setSearchInput] = useState<string>(initialPlate);
  const [trajectory, setTrajectory] = useState<TrajectoryData | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback Animation States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const playbackTimerRef = useRef<any>(null);

  // Web Audio chime
  const playSound = useCallback((freq = 800, type: OscillatorType = 'sine', duration = 0.15) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // ignore
    }
  }, []);

  const fetchTrajectory = async (targetPlate: string) => {
    if (!targetPlate) return;
    setLoading(true);
    setErrorMsg(null);
    setIsPlaying(false);
    setPlaybackIndex(0);
    try {
      const [trajData, camData] = await Promise.all([
        api.getVehicleTrajectory(targetPlate, mode),
        api.getCameras(mode)
      ]);
      setTrajectory(trajData);
      setCameras(camData);
    } catch (err: any) {
      console.error('Failed to load trajectory:', err);
      setErrorMsg(`No trajectory records found for vehicle "${targetPlate}" in ${mode.toUpperCase()} mode.`);
      setTrajectory(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrajectory(plate);
  }, [plate, mode]);

  // Handle Playback Loop
  useEffect(() => {
    if (isPlaying && trajectory && trajectory.points.length > 0) {
      const intervalMs = Math.max(250, 1500 / speedMultiplier);
      playbackTimerRef.current = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= trajectory.points.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          const nextPt = trajectory.points[next];
          if (nextPt?.anomaly) {
            playSound(440, 'sawtooth', 0.3);
          } else {
            playSound(880, 'sine', 0.08);
          }
          return next;
        });
      }, intervalMs);
    } else if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, trajectory, speedMultiplier, playSound]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setPlate(searchInput.trim().toUpperCase());
    }
  };

  const restartPlayback = () => {
    setPlaybackIndex(0);
    setIsPlaying(true);
    playSound(660);
  };

  const stepForward = () => {
    if (!trajectory) return;
    if (playbackIndex < trajectory.points.length - 1) {
      setPlaybackIndex(playbackIndex + 1);
      playSound(880, 'sine', 0.08);
    }
  };

  const stepBackward = () => {
    if (playbackIndex > 0) {
      setPlaybackIndex(playbackIndex - 1);
      playSound(700, 'sine', 0.08);
    }
  };

  // Find index of first anomaly
  const anomalyIndex = trajectory?.points.findIndex(p => Boolean(p.anomaly)) ?? -1;

  const jumpToAnomaly = () => {
    if (anomalyIndex !== -1) {
      setIsPlaying(false);
      setPlaybackIndex(anomalyIndex);
      playSound(380, 'sawtooth', 0.35);
    }
  };

  const activePoint: TrajectoryPoint | undefined = trajectory?.points[playbackIndex];
  const currentSpeed = activePoint?.estimated_speed_kmh || 0;

  // Calculate Speedometer Needle Angle
  const clampedSpeed = Math.min(160, Math.max(0, currentSpeed));
  const needleAngle = -90 + (clampedSpeed / 160) * 180;

  return (
    <div className="space-y-4 font-sans">
      {/* Header & Plate Selector */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span>KINEMATIC RECONSTRUCTION ENGINE</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Multi-Node Trajectory Reconstruction</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-camera route reconstruction using Haversine distance, time deltas, and speed anomaly models.
          </p>
        </div>

        {/* Quick Demo Plate Chips */}
        {mode === 'demo' && (
          <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
            <span className="text-[10px] text-slate-500 uppercase">Demo Targets:</span>
            <button
              onClick={() => {
                setSearchInput('DL01AB1234');
                setPlate('DL01AB1234');
              }}
              className={`px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer border ${
                plate === 'DL01AB1234'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#131F37] text-slate-300 border-[#1E293B] hover:bg-[#1A2946]'
              }`}
            >
              DL01AB1234 (Normal)
            </button>
            <button
              onClick={() => {
                setSearchInput('DL03CA7788');
                setPlate('DL03CA7788');
              }}
              className={`px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer border ${
                plate === 'DL03CA7788'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-rose-950/80 text-rose-300 border-rose-500/40 hover:bg-rose-900'
              }`}
            >
              DL03CA7788 (Anomaly 🔴)
            </button>
            <button
              onClick={() => {
                setSearchInput('HR26DK4521');
                setPlate('HR26DK4521');
              }}
              className={`px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer border ${
                plate === 'HR26DK4521'
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40 hover:bg-amber-900'
              }`}
            >
              HR26DK4521 (Interstate)
            </button>
          </div>
        )}
      </div>

      {/* SEARCH BAR */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
        <form onSubmit={handleSearch} className="flex gap-2 font-mono text-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value.toUpperCase())}
              placeholder="Search registration plate (e.g. DL01AB1234, DL03CA7788)..."
              className="w-full bg-[#090E1A] border border-[#1E293B] rounded pl-9 pr-3 py-1.5 text-xs font-mono font-bold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs transition-colors shadow-2xs cursor-pointer border border-blue-400/40"
          >
            {loading ? 'Reconstructing...' : 'Reconstruct Route'}
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="p-3 rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {trajectory && (
        <>
          {/* TINYFISH INVESTIGATION ACTION BAR */}
          <div className="bg-[#0D1526] border border-cyan-800/40 rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400 shrink-0">
                <FileSearch className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <span>Vehicle Investigation Intelligence Layer</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                    TinyFish Multi-Source
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Investigate what government records, challans, and public news exist around this trajectory journey.
                </div>
              </div>
            </div>
            {onNavigateInvestigation && (
              <button
                type="button"
                onClick={() => onNavigateInvestigation(trajectory.plate_number)}
                className="px-3.5 py-1.5 rounded bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold text-xs font-mono flex items-center gap-1.5 shadow-md shadow-cyan-950/50 cursor-pointer border border-cyan-400/30 transition-all self-start sm:self-auto shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                <span>Investigate with TinyFish</span>
              </button>
            )}
          </div>

          {/* TRAJECTORY SUMMARY METRIC CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
            <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Target Vehicle</span>
              <div className="text-xl font-bold text-slate-100 mt-1">{trajectory.plate_number}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{trajectory.total_observations} sequence sightings</div>
            </div>

            <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Distance</span>
              <div className="text-xl font-bold text-slate-100 mt-1">{trajectory.total_distance_km} km</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Haversine Great Circle</div>
            </div>

            <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Average Speed</span>
              <div className="text-xl font-bold text-blue-400 mt-1">{trajectory.average_speed_kmh} km/h</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Corridor Average</div>
            </div>

            <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Trajectory Status</span>
              {trajectory.anomaly_detected ? (
                <div className="text-xs font-bold text-rose-400 mt-1 flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  <span>Flagged Anomaly</span>
                </div>
              ) : (
                <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Normal Corridor</span>
                </div>
              )}
              <div className="text-[10px] text-slate-500 mt-0.5">
                {trajectory.anomaly_reason ? 'Speed threshold exceeded' : 'No speed violations detected'}
              </div>
            </div>
          </div>

          {/* ANOMALY ALERT BANNER */}
          {trajectory.anomaly_detected && (
            <div className="p-3 rounded bg-rose-950/90 border border-rose-500/80 text-rose-200 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <div className="font-bold flex items-center gap-1.5 text-rose-300 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  KINEMATIC MOVEMENT ANOMALY DETECTED
                </div>
                <p className="text-[11px] text-rose-300 pl-5">
                  {trajectory.anomaly_reason}
                </p>
              </div>

              {anomalyIndex !== -1 && (
                <button
                  onClick={jumpToAnomaly}
                  className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 transition-colors self-start sm:self-center shadow-xs cursor-pointer border border-rose-400/40"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Jump to Hop #{trajectory.points[anomalyIndex].sequence_number}</span>
                </button>
              )}
            </div>
          )}

          {/* PLAYBACK CONTROLS & TIMELINE & MAP */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* GIS Map & Interactive Scrubber (8 Cols) */}
            <div className="lg:col-span-8 space-y-3">
              {/* PLAYBACK CONSOLE */}
              <div className="p-3 bg-[#0D1526] border border-[#1E293B] rounded shadow-2xs space-y-2.5 font-mono">
                {/* Control Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={stepBackward}
                      disabled={playbackIndex <= 0}
                      title="Previous Hop"
                      className="p-1 rounded bg-[#131F37] hover:bg-[#1A2946] text-slate-300 border border-[#1E293B] disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {!isPlaying ? (
                      <button
                        onClick={() => {
                          setIsPlaying(true);
                          playSound(880);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer border border-blue-400/40"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>PLAY</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsPlaying(false);
                          playSound(550);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer border border-amber-400/40"
                      >
                        <Pause className="w-3 h-3 fill-current" />
                        <span>PAUSE</span>
                      </button>
                    )}

                    <button
                      onClick={stepForward}
                      disabled={playbackIndex >= trajectory.points.length - 1}
                      title="Next Hop"
                      className="p-1 rounded bg-[#131F37] hover:bg-[#1A2946] text-slate-300 border border-[#1E293B] disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={restartPlayback}
                      title="Restart from Hop 1"
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#131F37] hover:bg-[#1A2946] text-slate-300 text-xs font-bold border border-[#1E293B] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>RESET</span>
                    </button>
                  </div>

                  {/* Speed Multiplier */}
                  <div className="flex items-center space-x-1 text-xs">
                    <span className="text-slate-500 mr-1 text-[10px] uppercase">Speed:</span>
                    {[0.5, 1, 2, 5].map(multiplier => (
                      <button
                        key={multiplier}
                        onClick={() => setSpeedMultiplier(multiplier)}
                        className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer border ${
                          speedMultiplier === multiplier
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-[#131F37] text-slate-400 hover:text-slate-200 border-[#1E293B]'
                        }`}
                      >
                        {multiplier}x
                      </button>
                    ))}
                  </div>

                  {/* Active Hop Badge */}
                  <div className="text-[11px] font-mono font-bold text-slate-200 bg-[#090E1A] px-2.5 py-0.5 rounded border border-[#1E293B] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span>HOP {playbackIndex + 1} OF {trajectory.points.length}</span>
                  </div>
                </div>

                {/* Tactile Range Scrubber */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                    <span>Hop 1 ({trajectory.points[0]?.camera_code})</span>
                    <span className="font-bold text-blue-400">
                      {activePoint ? `${activePoint.camera_code} • ${new Date(activePoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
                    </span>
                    <span>Hop {trajectory.points.length} ({trajectory.points[trajectory.points.length - 1]?.camera_code})</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={trajectory.points.length - 1}
                    value={playbackIndex}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setPlaybackIndex(Number(e.target.value));
                      playSound(800, 'sine', 0.05);
                    }}
                    className="w-full h-1.5 bg-[#090E1A] border border-[#1E293B] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              {/* MAP */}
              <div className="border border-[#1E293B] rounded overflow-hidden shadow-2xs bg-[#090E1A]">
                <TrafficMap
                  cameras={cameras}
                  trajectoryPoints={trajectory.points}
                  activePointIndex={playbackIndex}
                  height="460px"
                />
              </div>
            </div>

            {/* DYNAMIC KINEMATICS HUD & TIMELINE (4 Cols) */}
            <div className="lg:col-span-4 space-y-3 font-mono">
              {/* SPEEDOMETER & TELEMETRY CARD */}
              <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-blue-400" />
                    <span>Live Kinematic Telemetry</span>
                  </h3>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    activePoint?.anomaly 
                      ? 'bg-rose-950/80 text-rose-300 border-rose-500/40' 
                      : currentSpeed > 80 
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40' 
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {activePoint?.anomaly ? 'ANOMALY' : currentSpeed > 80 ? 'HIGH SPEED' : 'NORMAL'}
                  </span>
                </div>

                {/* SVG Gauge */}
                <div className="flex flex-col items-center justify-center pt-1">
                  <div className="relative w-44 h-26 flex items-center justify-center">
                    <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
                      <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#1E293B"
                        strokeWidth="14"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 20 100 A 80 80 0 0 1 70 33"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="14"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                      <path
                        d="M 70 33 A 80 80 0 0 1 130 33"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="14"
                        opacity="0.85"
                      />
                      <path
                        d="M 130 33 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="14"
                        strokeLinecap="round"
                        opacity="0.85"
                      />

                      <circle cx="100" cy="100" r="6" fill="#3b82f6" />
                      
                      <line
                        x1="100"
                        y1="100"
                        x2="100"
                        y2="28"
                        stroke="#60a5fa"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        style={{
                          transformOrigin: '100px 100px',
                          transform: `rotate(${needleAngle}deg)`,
                          transition: 'transform 0.3s ease-out'
                        }}
                      />
                    </svg>

                    <div className="absolute bottom-0 text-center">
                      <div className="text-xl font-black font-mono tracking-tight text-slate-100">
                        {currentSpeed.toFixed(1)}
                      </div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">KM / H</div>
                    </div>
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1E293B] text-xs">
                  <div className="p-2 bg-[#090E1A] rounded border border-[#1E293B]">
                    <span className="text-[9px] text-slate-500 block uppercase">Hop Delta Dist</span>
                    <span className="font-mono font-bold text-slate-200">
                      {activePoint ? `${activePoint.distance_from_prev_km} km` : '0 km'}
                    </span>
                  </div>
                  <div className="p-2 bg-[#090E1A] rounded border border-[#1E293B]">
                    <span className="text-[9px] text-slate-500 block uppercase">Elapsed Delta</span>
                    <span className="font-mono font-bold text-slate-200">
                      {activePoint ? `${Math.round(activePoint.time_delta_seconds)} sec` : '0 sec'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SEQUENTIAL SIGHTING TIMELINE */}
              <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Chronological Sighting Timeline</span>
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    {trajectory.points.length} Points
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[290px] overflow-y-auto pr-1 text-xs">
                  {trajectory.points.map((pt, idx) => {
                    const isActive = idx === playbackIndex;
                    const isAnomaly = Boolean(pt.anomaly);
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setIsPlaying(false);
                          setPlaybackIndex(idx);
                          playSound(idx === anomalyIndex ? 400 : 750);
                        }}
                        className={`p-2.5 rounded border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#131F37] border-blue-500 text-slate-100 shadow-xs'
                            : isAnomaly
                            ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                            : 'bg-[#090E1A] border-[#1E293B] hover:bg-[#101A2E] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              isActive 
                                ? 'bg-blue-600 text-white' 
                                : isAnomaly
                                ? 'bg-rose-600 text-white'
                                : 'bg-[#131F37] text-slate-300 border border-[#1E293B]'
                            }`}>
                              {pt.sequence_number}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-100">
                              {pt.camera_code}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 ml-5.5 line-clamp-1 font-sans">
                          {pt.camera_name}
                        </div>

                        {pt.distance_from_prev_km > 0 && (
                          <div className="mt-1.5 ml-5.5 pt-1 border-t border-[#1E293B]/60 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-slate-500">Δ {pt.distance_from_prev_km} km</span>
                            <span className={`font-bold ${isAnomaly ? 'text-rose-400' : 'text-slate-300'}`}>
                              {pt.estimated_speed_kmh} km/h
                            </span>
                          </div>
                        )}

                        {isAnomaly && (
                          <div className="mt-1 ml-5.5 text-[9px] font-bold text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            <span>{pt.anomaly}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TrajectoryPage;
