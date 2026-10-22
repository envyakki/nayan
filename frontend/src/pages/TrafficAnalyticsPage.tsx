import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Navigation, Activity, Clock, 
  Car, ShieldAlert, ArrowRight, RefreshCw, Zap
} from 'lucide-react';
import { 
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';
import { api } from '../lib/api';
import { TrafficSummary, ODRoute, HeatmapPoint } from '../types';

interface TrafficAnalyticsPageProps {
  mode?: 'live' | 'demo';
}

export const TrafficAnalyticsPage: React.FC<TrafficAnalyticsPageProps> = ({ mode = 'live' }) => {
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [odRoutes, setOdRoutes] = useState<ODRoute[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Hourly volume breakdown
  const hourlyData = mode === 'demo' ? [
    { hour: '06:00', total: 140, cars: 85, twoWheelers: 35, heavies: 20 },
    { hour: '07:00', total: 290, cars: 180, twoWheelers: 75, heavies: 35 },
    { hour: '08:00', total: 580, cars: 360, twoWheelers: 150, heavies: 70 },
    { hour: '09:00', total: 890, cars: 560, twoWheelers: 220, heavies: 110 },
    { hour: '10:00', total: 920, cars: 580, twoWheelers: 230, heavies: 110 },
    { hour: '11:00', total: 740, cars: 460, twoWheelers: 190, heavies: 90 },
    { hour: '12:00', total: 620, cars: 390, twoWheelers: 155, heavies: 75 },
    { hour: '13:00', total: 590, cars: 370, twoWheelers: 145, heavies: 75 },
    { hour: '14:00', total: 630, cars: 400, twoWheelers: 155, heavies: 75 },
    { hour: '15:00', total: 710, cars: 450, twoWheelers: 175, heavies: 85 },
    { hour: '16:00', total: 840, cars: 530, twoWheelers: 210, heavies: 100 },
    { hour: '17:00', total: 980, cars: 620, twoWheelers: 240, heavies: 120 },
  ] : [
    { hour: '08:00', total: 0, cars: 0, twoWheelers: 0, heavies: 0 },
    { hour: '10:00', total: 0, cars: 0, twoWheelers: 0, heavies: 0 },
    { hour: '12:00', total: 0, cars: 0, twoWheelers: 0, heavies: 0 },
    { hour: '14:00', total: summary?.vehicles_today || 0, cars: summary?.vehicles_today || 0, twoWheelers: 0, heavies: 0 },
    { hour: '16:00', total: summary?.vehicles_today || 0, cars: summary?.vehicles_today || 0, twoWheelers: 0, heavies: 0 },
  ];

  // Vehicle category distribution
  const vehicleCategoryData = mode === 'demo' ? [
    { name: 'Passenger Cars', count: 1840, fill: '#3b82f6' },
    { name: 'SUVs & Utility', count: 960, fill: '#0284c7' },
    { name: 'Two-Wheelers', count: 1240, fill: '#10b981' },
    { name: 'Commercial Trucks', count: 480, fill: '#f59e0b' },
    { name: 'Buses / Public Transit', count: 320, fill: '#8b5cf6' },
    { name: 'Auto-Rickshaws', count: 620, fill: '#f97316' },
  ] : [
    { name: 'Live Scanned Vehicles', count: summary?.vehicles_today || 0, fill: '#3b82f6' },
  ];

  useEffect(() => {
    Promise.all([
      api.getTrafficSummary(mode),
      api.getTrafficOD(mode),
      api.getTrafficHeatmap(mode)
    ]).then(([sumData, odData, heatData]) => {
      setSummary(sumData);
      setOdRoutes(odData);
      setHeatmapPoints(heatData);
    }).catch(err => console.error('Traffic analytics load error:', err))
      .finally(() => setLoading(false));
  }, [mode]);

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span>CORRIDOR VELOCITY & DENSITY ANALYTICS</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Traffic Density & Corridor Intelligence</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/40">
              {summary ? summary.vehicles_today.toLocaleString() : 0} READS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggregated traffic intelligence, Origin-Destination transit models, and peak congestion patterns.
          </p>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Recorded Volume</span>
          <div className="text-xl font-bold text-slate-100 mt-1">
            {summary ? summary.vehicles_today.toLocaleString() : '0'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across monitored camera zones</div>
        </div>

        <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Congestion Index</span>
          <div className="text-xl font-bold text-slate-100 mt-1">
            {summary ? `${Math.round(summary.congestion_index * 100)}%` : '0%'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Level: <span className="font-bold text-emerald-400">{summary?.congestion_level || 'FLUID'}</span></div>
        </div>

        <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Avg Grid Speed</span>
          <div className="text-xl font-bold text-blue-400 mt-1">
            {summary ? summary.average_speed_kmh : 0} km/h
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Calculated across observations</div>
        </div>

        <div className="p-3.5 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Peak Flow Window</span>
          <div className="text-xl font-bold text-slate-100 mt-1">
            {summary?.peak_hour || '09:00 - 10:00'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Highest vehicle throughput</div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Hourly Trend Chart */}
        <div className="p-4 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs space-y-3 font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span>Hourly Traffic Volume Progression</span>
            </h3>
            <span className="text-[10px] text-slate-500">24-Hour ANPR Grid</span>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0D1526', borderColor: '#1E293B', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#totalColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Category Breakdown */}
        <div className="p-4 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs space-y-3 font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-blue-400" />
              <span>Fleet Classification Distribution</span>
            </h3>
            <span className="text-[10px] text-slate-500">Automated Visual Classifier</span>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleCategoryData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 10, fontFamily: 'sans-serif' }} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0D1526', borderColor: '#1E293B', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ORIGIN-DESTINATION (O-D) TRANSIT TABLE */}
      <div className="p-4 rounded bg-[#0D1526] border border-[#1E293B] shadow-2xs space-y-3 font-mono">
        <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
            <span>Origin-Destination Corridor Velocity Analysis</span>
          </h3>
          <span className="text-[10px] text-slate-500">{odRoutes.length} MONITORED CORRIDORS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0A0F1D] text-slate-400 text-[10px] font-bold uppercase">
                <th className="py-2.5 px-3">Origin Node</th>
                <th className="py-2.5 px-3">Destination Node</th>
                <th className="py-2.5 px-3">Vehicle Volume</th>
                <th className="py-2.5 px-3">Avg Travel Time</th>
                <th className="py-2.5 px-3">Avg Speed</th>
                <th className="py-2.5 px-3">Congestion Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-slate-300">
              {odRoutes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No origin-destination pairs registered in current dataset.
                  </td>
                </tr>
              ) : (
                odRoutes.map((route, idx) => (
                  <tr key={`${route.origin_camera_code}-${route.destination_camera_code}-${idx}`} className="hover:bg-[#131F37]/50 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-100">
                      <span className="bg-[#090E1A] px-2 py-0.5 rounded border border-[#1E293B] text-blue-300">
                        {route.origin_camera_code} ({route.origin_name})
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-100">
                      <span className="bg-[#090E1A] px-2 py-0.5 rounded border border-[#1E293B] text-blue-300">
                        {route.destination_camera_code} ({route.destination_name})
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-200">{route.vehicle_count.toLocaleString()}</td>
                    <td className="py-2 px-3 text-slate-300">{route.avg_travel_time_mins} mins</td>
                    <td className="py-2 px-3 text-blue-400 font-bold">{route.avg_speed_kmh} km/h</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-950/80 text-emerald-300 border-emerald-500/40">
                        NORMAL
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrafficAnalyticsPage;
