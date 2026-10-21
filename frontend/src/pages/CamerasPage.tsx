import React, { useState, useEffect } from 'react';
import { 
  Camera as CameraIcon, ShieldCheck, 
  Video, Power, X, Plus, Activity, CheckCircle2, AlertCircle, Clock, Server
} from 'lucide-react';
import { api } from '../lib/api';
import { Camera, CameraStatus, CameraSummary } from '../types';

interface CamerasPageProps {
  mode?: 'live' | 'demo';
}

export const CamerasPage: React.FC<CamerasPageProps> = ({ mode = 'live' }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [summary, setSummary] = useState<CameraSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);

  // New Camera Form state
  const [formName, setFormName] = useState<string>('');
  const [formSourceType, setFormSourceType] = useState<'RTSP' | 'IP_CAMERA' | 'LAPTOP_WEBCAM'>('RTSP');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formLat, setFormLat] = useState<string>('28.6139');
  const [formLon, setFormLon] = useState<string>('77.2090');
  const [formStreamType, setFormStreamType] = useState<string>('RTSP');
  const [formStreamUrl, setFormStreamUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchCameras = async () => {
    try {
      const [camData, sumData] = await Promise.all([
        api.getCameras(mode),
        api.getCameraSummary(mode).catch(() => null)
      ]);
      setCameras(camData);
      if (sumData) {
        setSummary(sumData);
      } else {
        const onlineCount = camData.filter(c => c.status === 'ONLINE').length;
        const offlineCount = camData.filter(c => c.status === 'OFFLINE').length;
        const degradedCount = camData.filter(c => c.status === 'DEGRADED').length;
        setSummary({
          total: camData.length,
          online: onlineCount,
          offline: offlineCount,
          degraded: degradedCount
        });
      }
    } catch (err) {
      console.error('Failed to load cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 6000);
    return () => clearInterval(interval);
  }, [mode]);

  // Toggle Camera Online / Offline
  const toggleCameraStatus = async (cam: Camera, newStatus: CameraStatus) => {
    try {
      const updated = await api.updateCameraStatus(cam.id, newStatus);
      setCameras(prev => prev.map(c => c.id === cam.id ? updated : c));
      if (selectedCamera?.id === cam.id) setSelectedCamera(updated);

      setActionSuccess(`Camera ${cam.camera_code} transitioned to ${newStatus}. ${newStatus === 'OFFLINE' ? 'Triggered CAMERA_OFFLINE alert.' : ''}`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchCameras();
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Submit Physical Camera Registration
  const handleRegisterCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formLocation.trim()) return;

    setIsSubmitting(true);
    try {
      const newCam = await api.registerCamera({
        name: formName.trim(),
        source_type: formSourceType,
        camera_type: formSourceType === 'LAPTOP_WEBCAM' ? 'LAPTOP_WEBCAM' : (formSourceType === 'IP_CAMERA' ? 'IP_CAMERA' : 'CCTV'),
        location_name: formLocation.trim(),
        latitude: parseFloat(formLat) || 28.6139,
        longitude: parseFloat(formLon) || 77.2090,
        stream_type: formStreamType,
        stream_url: formStreamUrl.trim() || undefined,
        location_source: 'REAL'
      });

      setCameras(prev => [...prev, newCam]);
      setShowRegisterModal(false);
      setActionSuccess(`Registered ${formSourceType} node ${newCam.camera_code} successfully.`);
      setTimeout(() => setActionSuccess(null), 3500);

      // Reset form
      setFormName('');
      setFormLocation('');
      setFormStreamUrl('');
      fetchCameras();
    } catch (err: any) {
      console.error('Failed to register camera:', err);
      alert('Error registering camera: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCameras = cameras.filter(c => {
    if (typeFilter !== 'ALL') {
      const st = c.source_type || (c.camera_type === 'IP_CAMERA' ? 'IP_CAMERA' : 'RTSP');
      if (st !== typeFilter) return false;
    }
    if (statusFilter !== 'ALL') {
      if (c.status !== statusFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span>SENSOR NETWORK & HARDWARE REGISTRY</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Camera Infrastructure & Watchdog Engine</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/40">
              {cameras.length} NODES
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real ANPR camera telemetry with 30-second automated offline watchdog. Optical station source is the workstation camera.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold shadow-xs transition-colors cursor-pointer border border-blue-400/40"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>REGISTER CAMERA NODE</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Registered</div>
          <div className="text-xl font-bold text-slate-100 mt-1">{summary ? summary.total : cameras.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Physical & Prototype nodes</div>
        </div>
        <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Online (Heartbeat)
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{summary ? summary.online : 0}</div>
          <div className="text-[10px] text-emerald-500/80 mt-0.5">&lt; 30s heartbeat window</div>
        </div>
        <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-rose-400 tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-400" /> Offline / Timeout
          </div>
          <div className="text-xl font-bold text-rose-400 mt-1">{summary ? summary.offline : 0}</div>
          <div className="text-[10px] text-rose-500/80 mt-0.5">Watchdog auto-flagged</div>
        </div>
        <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" /> Degraded / Maint
          </div>
          <div className="text-xl font-bold text-amber-400 mt-1">{summary ? summary.degraded : 0}</div>
          <div className="text-[10px] text-amber-500/80 mt-0.5">Telemetry sync issues</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1526] p-2.5 rounded border border-[#1E293B] shadow-2xs font-mono text-xs">
        {/* Type Filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-slate-400 mr-2 text-[10px] uppercase">Source:</span>
          {[
            { key: 'ALL', label: 'All Sources' },
            { key: 'LAPTOP_WEBCAM', label: 'Laptop Webcam' },
            { key: 'RTSP', label: 'RTSP CCTV' },
            { key: 'IP_CAMERA', label: 'IP Camera' }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                typeFilter === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131F37]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 mr-2 text-[10px] uppercase">Watchdog:</span>
          {['ALL', 'ONLINE', 'OFFLINE'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#131F37] text-slate-200 border border-[#1E293B]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131F37]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Grid of Cameras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredCameras.map(cam => {
          const isOnline = cam.status === 'ONLINE';
          const isMaint = cam.status === 'MAINTENANCE';
          const sourceType = cam.source_type || (cam.camera_type === 'IP_CAMERA' ? 'IP_CAMERA' : 'RTSP');

          const statusBadge = isOnline 
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
            : isMaint 
            ? 'bg-amber-950/80 text-amber-300 border-amber-500/40' 
            : 'bg-rose-950/80 text-rose-300 border-rose-500/40';

          const sourceTypeBadge = sourceType === 'LAPTOP_WEBCAM'
            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
            : sourceType === 'IP_CAMERA'
            ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
            : sourceType === 'DEMO'
            ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
            : 'bg-[#131F37] text-slate-300 border-[#1E293B]';

          return (
            <div
              key={cam.id}
              className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs hover:bg-[#101A2E] transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-100 bg-[#090E1A] px-2 py-0.5 rounded border border-[#1E293B]">
                      {cam.camera_code}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${sourceTypeBadge}`}>
                      {sourceType.replace('_', ' ')}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusBadge}`}>
                    {cam.status}
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-200 line-clamp-1">{cam.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{cam.location_name}</div>
              </div>

              <div className="pt-2.5 border-t border-[#1E293B] grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Protocol</span>
                  <span className="text-slate-300 font-mono text-[11px]">{cam.stream_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Telemetry</span>
                  <span className={`font-mono text-[11px] font-bold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isOnline ? 'HEARTBEAT OK' : 'TIMEOUT (>30s)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Traffic Rate</span>
                  <span className="text-slate-200 font-mono text-[11px] font-bold">{cam.vehicles_per_min || 0} veh/min</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Coordinates</span>
                  <span className="text-blue-400 font-mono text-[10px]">{cam.latitude.toFixed(4)}, {cam.longitude.toFixed(4)}</span>
                </div>
              </div>

              {/* Status Controls */}
              <div className="pt-2.5 flex items-center justify-between border-t border-[#1E293B] font-mono">
                <button
                  onClick={() => setSelectedCamera(cam)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Specs</span>
                </button>

                {isOnline ? (
                  <button
                    onClick={() => toggleCameraStatus(cam, 'OFFLINE')}
                    className="px-2 py-1 rounded bg-[#131F37] hover:bg-rose-950/80 text-rose-300 border border-[#1E293B] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Power className="w-3 h-3 text-rose-400" />
                    <span>Set Offline</span>
                  </button>
                ) : (
                  <button
                    onClick={() => toggleCameraStatus(cam, 'ONLINE')}
                    className="px-2 py-1 rounded bg-[#131F37] hover:bg-emerald-950/80 text-emerald-300 border border-[#1E293B] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Power className="w-3 h-3 text-emerald-400" />
                    <span>Bring Online</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* REGISTER PHYSICAL CAMERA MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-fadeIn">
          <form onSubmit={handleRegisterCamera} className="bg-[#0D1526] border border-[#1E293B] rounded max-w-lg w-full p-5 space-y-4 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Register Camera Node
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowRegisterModal(false)} 
                className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">Camera Name / Code Sign</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ring Road Junction Pole #12"
                  className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">Source Type</label>
                  <select
                    value={formSourceType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setFormSourceType(val);
                      if (val === 'LAPTOP_WEBCAM') {
                        setFormStreamType('WEBCAM');
                      } else if (val === 'RTSP') {
                        setFormStreamType('RTSP');
                      } else {
                        setFormStreamType('HTTP');
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="RTSP">RTSP Roadside CCTV</option>
                    <option value="IP_CAMERA">IP Camera (Edge Stream)</option>
                    <option value="LAPTOP_WEBCAM">Laptop Webcam (Prototype)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">Stream Protocol</label>
                  <select
                    value={formStreamType}
                    onChange={(e) => setFormStreamType(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="RTSP">RTSP H.264</option>
                    <option value="WEBCAM">Local USB/Webcam</option>
                    <option value="WEBRTC">WebRTC</option>
                    <option value="HTTP">HTTP/MJPEG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">Location Description</label>
                <input
                  type="text"
                  required
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. South Delhi Ring Road Flyover"
                  className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formLon}
                    onChange={(e) => setFormLon(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">Stream URL / Connection String (Optional)</label>
                <input
                  type="text"
                  value={formStreamUrl}
                  onChange={(e) => setFormStreamUrl(e.target.value)}
                  placeholder="rtsp://admin:pass@192.168.1.100:554/ch0"
                  className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500 text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="px-3 py-1.5 rounded bg-[#131F37] hover:bg-[#1A2946] text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer border border-blue-400/40"
              >
                {isSubmitting ? 'Registering...' : 'Register Camera'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CCTV RTSP Specification Modal */}
      {selectedCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#0D1526] border border-[#1E293B] rounded max-w-lg w-full p-5 space-y-4 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Node Specification: {selectedCamera.camera_code}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedCamera(null)} 
                className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded bg-[#090E1A] border border-[#1E293B] space-y-1 text-slate-300">
                <div>Node Name: <span className="text-slate-100 font-bold">{selectedCamera.name}</span></div>
                <div>Source Type: <span className="text-blue-400 font-bold">{selectedCamera.source_type || selectedCamera.camera_type || 'RTSP'}</span></div>
                <div>Protocol: <span className="text-slate-200 font-bold">{selectedCamera.stream_type}</span></div>
                <div>Coordinates: <span className="text-blue-400">{selectedCamera.latitude.toFixed(5)}, {selectedCamera.longitude.toFixed(5)}</span></div>
                {selectedCamera.stream_url && (
                  <div>Stream URL: <span className="text-slate-400 break-all">{selectedCamera.stream_url}</span></div>
                )}
                <div>Watchdog: <span className={selectedCamera.status === 'ONLINE' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{selectedCamera.status}</span></div>
              </div>

              <div className="p-3 rounded bg-[#131F37]/60 border border-[#1E293B] text-slate-300 space-y-1.5">
                <div className="font-bold text-blue-400 text-xs">CENTRALIZED ANPR PIPELINE:</div>
                <div className="text-[11px] leading-relaxed text-slate-400">
                  1. Edge Stream (RTSP / IP Camera / Laptop Optical Station) <br />
                  2. Automated 30s Heartbeat Watchdog & Status Verification <br />
                  3. ModularANPRService (Vehicle & License Plate Localization) <br />
                  4. Optical Character Recognition & Plate Formatting Engine <br />
                  5. Database Matching (Owner, Blacklist, Challan History) <br />
                  6. Real-Time Spatial Trajectory & Security Alert Dispatch
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1E293B]">
              <button
                onClick={() => setSelectedCamera(null)}
                className="px-4 py-1.5 rounded bg-[#131F37] hover:bg-[#1A2946] text-slate-300 text-xs cursor-pointer"
              >
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CamerasPage;
