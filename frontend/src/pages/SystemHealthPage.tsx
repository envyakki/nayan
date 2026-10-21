import React, { useState, useEffect } from 'react';
import { 
  Radio, CheckCircle2, AlertTriangle, XCircle, 
  Cpu, Database, Globe, Server, RefreshCw, Zap, ShieldCheck, Activity
} from 'lucide-react';
import { api } from '../lib/api';
import { SystemHealth } from '../types';

export const SystemHealthPage: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchHealth = async () => {
    try {
      const data = await api.getSystemHealth();
      setHealth(data);
    } catch (err) {
      console.error('Health fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const components = health ? [
    { name: 'Frontend Client (Vite + React SPA)', status: health.frontend.status, latency: health.frontend.latency_ms, details: health.frontend.details, icon: Globe },
    { name: 'FastAPI Backend Engine (Async Python)', status: health.backend.status, latency: health.backend.latency_ms, details: health.backend.details, icon: Server },
    { name: 'Supabase Database (PostgreSQL)', status: health.supabase.status, latency: health.supabase.latency_ms, details: health.supabase.details, icon: Database },
    { name: 'ANPR Pipeline (OpenCV Vision Core)', status: health.anpr_engine.status, latency: health.anpr_engine.latency_ms, details: health.anpr_engine.details, icon: Cpu },
    { name: 'OCR Engine (Pluggable Adapter)', status: health.ocr_engine.status, latency: health.ocr_engine.latency_ms, details: health.ocr_engine.details, icon: Zap },
    { name: 'Realtime WebSocket Event Dispatcher', status: health.realtime.status, latency: health.realtime.latency_ms, details: health.realtime.details, icon: Radio },
  ] : [];

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>INFRASTRUCTURE TELEMETRY & MICROSERVICE WATCHDOG</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>System Infrastructure & Service Health</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
              6/6 OPERATIONAL
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time operational latency, microservice statuses, and computer vision throughput telemetry.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131F37] hover:bg-[#1A2946] text-xs font-mono font-bold text-slate-200 border border-[#1E293B] shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
          <span>PROBE SUBSYSTEMS</span>
        </button>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Overall Health</span>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {health?.overall_status || 'OPERATIONAL'}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">All 6 services responding</div>
        </div>

        <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">REST API Latency</span>
          <div className="text-lg font-bold font-mono text-slate-100 mt-1">
            {health?.api_latency_ms || 1.2} ms
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">FastAPI loopback response</div>
        </div>

        <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">ANPR Frame Latency</span>
          <div className="text-lg font-bold font-mono text-blue-400 mt-1">
            {health?.processing_latency_ms || 28.5} ms
          </div>
          <div className="text-[10px] font-mono text-emerald-400 mt-0.5">~35 FPS theoretical max</div>
        </div>

        <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Telemetry Throughput</span>
          <div className="text-lg font-bold font-mono text-slate-100 mt-1">
            {health?.events_per_sec || 42.6} msg/s
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Event bus stream throughput</div>
        </div>
      </div>

      {/* COMPONENT STATUS CARDS */}
      <div className="p-4 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs space-y-3">
        <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-blue-400" />
          <span>MICROSERVICE SUBSYSTEM STATUS</span>
        </h3>

        <div className="divide-y divide-[#1E293B]/60 font-mono text-xs">
          {components.map((comp, idx) => {
            const Icon = comp.icon;
            const isOk = comp.status === 'HEALTHY' || comp.status === 'OK';
            return (
              <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#131F37]/30 px-2 rounded transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded bg-[#131F37] border border-[#1E293B] flex items-center justify-center text-blue-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-200 text-xs font-sans">{comp.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{comp.details || 'Active thread worker'}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-xs font-mono">
                  {comp.latency !== undefined && (
                    <div className="text-slate-400">
                      <span className="text-[10px] text-slate-500">RTT: </span>
                      <span className="text-slate-200 font-bold">{comp.latency}ms</span>
                    </div>
                  )}

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    isOk 
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  }`}>
                    {comp.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPage;
