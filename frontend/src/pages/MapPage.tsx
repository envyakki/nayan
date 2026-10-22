import React, { useState, useEffect } from 'react';
import { TrafficMap } from '../components/map/TrafficMap';
import { api } from '../lib/api';
import { Camera, CameraSummary } from '../types';
import { MapPin, Radio, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';

interface MapPageProps {
  mode?: 'live' | 'demo';
}

export const MapPage: React.FC<MapPageProps> = ({ mode = 'live' }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [summary, setSummary] = useState<CameraSummary | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMapData = async () => {
    try {
      const [cams, sum] = await Promise.all([
        api.getCameras(mode),
        api.getCameraSummary(mode).catch(() => null)
      ]);
      setCameras(cams);
      if (sum) {
        setSummary(sum);
      } else {
        setSummary({
          total: cams.length,
          online: cams.filter(c => c.status === 'ONLINE').length,
          offline: cams.filter(c => c.status === 'OFFLINE').length,
          degraded: cams.filter(c => c.status === 'DEGRADED').length
        });
      }
    } catch (err) {
      console.error('Failed to load map cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 8000);
    return () => clearInterval(interval);
  }, [mode]);

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>GEOSPATIAL OPTICAL NETWORK</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>City Camera GIS Surveillance Grid</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/40">
              {cameras.length} NODES
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Geospatial distribution of registered ANPR camera nodes with real-time status indicators.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 bg-[#090E1A] px-3 py-1.5 rounded border border-[#1E293B] text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> ONLINE
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span> OFFLINE
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> DEGRADED
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Total Cameras</div>
          <div className="text-xl font-bold text-slate-100 mt-1">{summary ? summary.total : cameras.length}</div>
        </div>
        <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Online Active
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{summary ? summary.online : 0}</div>
        </div>
        <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-slate-500" /> Offline Watchdog
          </div>
          <div className="text-xl font-bold text-slate-400 mt-1">{summary ? summary.offline : 0}</div>
        </div>
        <div className="bg-[#0D1526] border border-[#1E293B] rounded p-3 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" /> Degraded / Maint
          </div>
          <div className="text-xl font-bold text-amber-400 mt-1">{summary ? summary.degraded : 0}</div>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded overflow-hidden shadow-xs">
        <TrafficMap
          cameras={cameras}
          selectedCameraId={selectedCameraId}
          onSelectCamera={(c) => setSelectedCameraId(c.id)}
          height="540px"
          showControls={true}
        />
      </div>
    </div>
  );
};

export default MapPage;
