import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, ShieldAlert, AlertTriangle, ShieldCheck, CheckCircle2, 
  Calendar, Clock, Car, User, AlertOctagon, ArrowRight, 
  FileText, ExternalLink, ChevronRight, Navigation, MapPin,
  Sparkles, Layers, Info, History, Shield, ArrowUpRight, FileSearch
} from 'lucide-react';
import { api } from '../lib/api';
import { VehicleProfile, Vehicle } from '../types';
import L from 'leaflet';

interface VehicleSearchPageProps {
  mode: 'live' | 'demo';
  initialPlate?: string;
  onNavigateTrajectory: (plate: string) => void;
  onNavigateInvestigation?: (plate: string) => void;
}

export const VehicleSearchPage: React.FC<VehicleSearchPageProps> = ({ 
  mode, 
  initialPlate,
  onNavigateTrajectory,
  onNavigateInvestigation
}) => {
  const [query, setQuery] = useState<string>(initialPlate || (mode === 'demo' ? 'DL 99 ZZ 0002' : ''));
  const [loading, setLoading] = useState<boolean>(false);
  const [profile, setProfile] = useState<VehicleProfile | null>(null);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [notFound, setNotFound] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Fetch all vehicles for the quick browser table
  const loadVehicleList = async () => {
    try {
      const data = await api.getVehicles(undefined, mode);
      setAllVehicles(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch full vehicle profile
  const searchProfile = async (plateToSearch: string) => {
    if (!plateToSearch.trim()) return;
    setLoading(true);
    setNotFound(false);
    try {
      const data = await api.getVehicleProfile(plateToSearch, mode);
      setProfile(data);
    } catch (err: any) {
      console.warn('Profile not found, trying fallback vehicle record:', err);
      try {
        const v = await api.getVehicle(plateToSearch);
        if (v) {
          const obs = await api.getObservations(v.plate_number, 50, mode);
          setProfile({
            vehicle: v,
            owner: null,
            violations: [],
            blacklist: null,
            observations: obs,
            trajectory: null,
            alerts: [],
            is_synthetic: v.data_source === 'DEMO',
            disclaimer: 'Live operator observation record.'
          });
        } else {
          setNotFound(true);
          setProfile(null);
        }
      } catch {
        setNotFound(true);
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicleList();
    if (initialPlate) {
      setQuery(initialPlate);
      searchProfile(initialPlate);
    } else if (mode === 'demo') {
      searchProfile('DL 99 ZZ 0002');
    }
  }, [mode, initialPlate]);

  // Render Leaflet trajectory map when trajectory is present in profile
  useEffect(() => {
    if (!profile?.trajectory || !mapContainerRef.current) return;

    const points = profile.trajectory.points;
    if (points.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const firstPt = points[0];
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false
    }).setView([firstPt.latitude, firstPt.longitude], 12);

    mapInstanceRef.current = map;

    // Carto dark tile layer for enterprise command look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    const latlngs: L.LatLngTuple[] = [];

    points.forEach((pt, idx) => {
      latlngs.push([pt.latitude, pt.longitude]);

      const isFirst = idx === 0;
      const isLast = idx === points.length - 1;
      const markerColor = isLast ? '#ef4444' : isFirst ? '#10b981' : '#3b82f6';

      const iconHtml = `
        <div style="background-color: ${markerColor}; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">
          ${idx + 1}
        </div>
      `;

      const marker = L.marker([pt.latitude, pt.longitude], {
        icon: L.divIcon({
          html: iconHtml,
          className: 'custom-trajectory-point',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: monospace; font-size: 11px; padding: 4px;">
          <strong>#${idx + 1} ${pt.camera_code}</strong><br/>
          <span>${pt.camera_name}</span><br/>
          <span>Time: ${new Date(pt.timestamp).toLocaleTimeString()}</span><br/>
          <span>Speed: ${pt.estimated_speed_kmh || 0} km/h</span>
        </div>
      `);
    });

    if (latlngs.length > 1) {
      L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 8'
      }).addTo(map);
    }

    if (latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [profile]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchProfile(query);
  };

  const isBlacklisted = profile?.blacklist && profile.blacklist.active;
  const hasPendingChallan = profile?.violations && profile.violations.some(v => v.status === 'PENDING');

  return (
    <div className="space-y-4 font-sans">
      {/* 1. SEARCH HEADER & LOOKUP BAR */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>INVESTIGATION REGISTRY & PLATE LOOKUP</span>
            </div>
            <h1 className="text-base font-bold tracking-tight text-slate-100">
              Vehicle & Registered Owner Intelligence
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Query centralized ANPR records, registration metadata, violation history, and observed camera trajectories.
            </p>
          </div>

          {/* Quick Demo Plate Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="text-[10px] text-slate-500 uppercase">Test Plates:</span>
            <button
              onClick={() => {
                setQuery('DL 99 ZZ 0001');
                searchProfile('DL 99 ZZ 0001');
              }}
              className="px-2 py-1 rounded bg-[#131F37] hover:bg-[#1A2946] text-emerald-400 border border-[#1E293B] font-bold transition-colors cursor-pointer"
            >
              DL 99 ZZ 0001 (Clear)
            </button>
            <button
              onClick={() => {
                setQuery('DL 99 ZZ 0002');
                searchProfile('DL 99 ZZ 0002');
              }}
              className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 font-bold transition-colors cursor-pointer"
            >
              DL 99 ZZ 0002 (Blacklist 🔴)
            </button>
            <button
              onClick={() => {
                setQuery('HR 99 YY 0003');
                searchProfile('HR 99 YY 0003');
              }}
              className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/40 font-bold transition-colors cursor-pointer"
            >
              HR 99 YY 0003 (Challan 🟡)
            </button>
          </div>
        </div>

        {/* Global Search Input */}
        <form onSubmit={handleSearchSubmit} className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="Search vehicle / license plate (e.g. DL 99 ZZ 0002, HR 99 YY 0003)..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#090E1A] border border-[#1E293B] rounded text-xs font-mono font-bold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 border border-blue-400/40 cursor-pointer"
          >
            {loading ? 'Querying...' : 'Search Vehicle'}
          </button>
        </form>
      </div>

      {notFound && (
        <div className="p-8 text-center bg-[#0D1526] border border-[#1E293B] rounded shadow-xs space-y-2 font-mono">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <div className="text-sm font-bold text-slate-200">No Vehicle Records Found</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No registration profile or ANPR sightings match plate "{query}". Check spelling or select one of the test plates above.
          </p>
        </div>
      )}

      {/* 2. MAIN VEHICLE INVESTIGATION PROFILE VIEW */}
      {profile && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* A. PROMINENT BLACKLIST ALERT BANNER */}
          {isBlacklisted && (
            <div className="p-3.5 rounded bg-rose-950/90 text-white border border-rose-500/80 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span>CRITICAL ALERT: BLACKLISTED VEHICLE DETECTED</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white uppercase">
                  HIGH PRIORITY INTERCEPT
                </span>
              </div>
              <div className="text-xs bg-[#090E1A]/80 p-2.5 rounded border border-rose-500/30 font-mono grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>Reason: <strong className="text-rose-300">{profile.blacklist?.reason || 'Active watchlist entry'}</strong></div>
                <div>Severity: <strong className="text-white">CRITICAL (Risk 98)</strong></div>
                <div>Enrolled: {profile.blacklist?.added_at ? new Date(profile.blacklist.added_at).toLocaleDateString() : 'Active'}</div>
              </div>
            </div>
          )}

          {/* B. VEHICLE & REGISTERED OWNER PROFILE CARD */}
          <div className="bg-[#0D1526] border border-[#1E293B] rounded p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[#1E293B]">
              <div className="flex items-start space-x-3.5">
                <div className="w-11 h-11 rounded bg-[#131F37] border border-[#1E293B] flex items-center justify-center text-blue-400">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-black font-mono tracking-tight text-slate-100 bg-[#090E1A] px-2.5 py-0.5 rounded border border-[#1E293B]">
                      {profile.vehicle.plate_number}
                    </h2>
                    {isBlacklisted ? (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        BLACKLISTED
                      </span>
                    ) : hasPendingChallan ? (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                        CHALLAN PENDING
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        CLEAR
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-400 mt-1">
                    {profile.vehicle.color || 'Black'} {profile.vehicle.vehicle_type} • {profile.vehicle.vehicle_class || 'Private Car'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <div className="bg-[#090E1A] px-2.5 py-1.5 rounded border border-[#1E293B]">
                  <span className="text-slate-500 block text-[9px] uppercase">Sightings</span>
                  <span className="text-slate-200 font-bold">{profile.observations.length} Detections</span>
                </div>
                <div className="bg-[#090E1A] px-2.5 py-1.5 rounded border border-[#1E293B]">
                  <span className="text-slate-500 block text-[9px] uppercase">Registration</span>
                  <span className="text-emerald-400 font-bold">{profile.vehicle.registration_status || 'ACTIVE'}</span>
                </div>
                {onNavigateInvestigation && (
                  <button
                    type="button"
                    onClick={() => onNavigateInvestigation(profile.vehicle.plate_number)}
                    className="px-3 py-1.5 rounded bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950/50 cursor-pointer border border-cyan-400/30 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                    <span>Investigate with TinyFish</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateTrajectory(profile.vehicle.plate_number)}
                  className="px-3 py-1.5 rounded bg-[#131F37] hover:bg-[#1A2946] text-blue-300 font-bold text-xs flex items-center gap-1.5 border border-[#1E293B] cursor-pointer transition-all"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  <span>View Trajectory</span>
                </button>
              </div>
            </div>

            {/* SYNTHETIC DEMO PRIVACY ALERT NOTICE */}
            <div className="bg-[#131F37]/50 border border-[#1E293B] rounded p-2.5 text-xs text-slate-300 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-slate-200">Compliance Notice:</strong> {profile.disclaimer}
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Restricted to non-sensitive vehicle registry metadata. No sensitive PII is exposed.
                </div>
              </div>
            </div>

            {/* REGISTERED OWNER DETAILS & VEHICLE SPECIFICATIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* REGISTERED OWNER */}
              <div className="p-3.5 rounded bg-[#090E1A] border border-[#1E293B] space-y-2.5">
                <div className="flex items-center space-x-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300 pb-2 border-b border-[#1E293B]">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Registered Owner</span>
                </div>

                {profile.owner ? (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px]">OWNER NAME</span>
                      <span className="text-slate-100 font-bold font-sans text-xs">{profile.owner.owner_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">OWNERSHIP TYPE</span>
                      <span className="text-slate-200">{profile.owner.ownership_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">REGISTRATION DATE</span>
                      <span className="text-slate-300">
                        {profile.owner.registration_date ? new Date(profile.owner.registration_date).toLocaleDateString() : '15 March 2024'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">STATUS</span>
                      <span className="text-emerald-400 font-bold">VERIFIED</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-1 italic font-mono">
                    Owner metadata not registered in live prototype feed.
                  </div>
                )}
              </div>

              {/* VEHICLE DETAILS */}
              <div className="p-3.5 rounded bg-[#090E1A] border border-[#1E293B] space-y-2.5">
                <div className="flex items-center space-x-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300 pb-2 border-b border-[#1E293B]">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Vehicle Specifications</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">VEHICLE CLASS</span>
                    <span className="text-slate-200">{profile.vehicle.vehicle_class || 'Private Car'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">COLOR</span>
                    <span className="text-slate-200">{profile.vehicle.color || 'White'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">VALID UNTIL</span>
                    <span className="text-slate-300">
                      {profile.vehicle.registration_valid_until ? new Date(profile.vehicle.registration_valid_until).toLocaleDateString() : '14 March 2039'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">FUEL / EMISSIONS</span>
                    <span className="text-slate-200">BS-VI Petrol</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* C. CHALLAN / VIOLATION HISTORY */}
          <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 shadow-xs space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wide">
                  Challan & Violation History
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {profile.violations.length} RECORDED VIOLATION(S)
              </span>
            </div>

            {profile.violations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[#1E293B] bg-[#0A0F1D] text-slate-400 text-[10px] font-bold uppercase">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Violation Type</th>
                      <th className="py-2 px-3">Sensor Node / Location</th>
                      <th className="py-2 px-3">Fine (INR)</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]/60 text-slate-300">
                    {profile.violations.map(viol => (
                      <tr key={viol.id} className="hover:bg-[#131F37]/50">
                        <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(viol.violation_date).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-100 font-sans">
                          {viol.violation_type}
                        </td>
                        <td className="py-2 px-3 text-slate-300 font-sans">
                          {viol.location_name || viol.camera_name || 'Surveillance Node'}
                        </td>
                        <td className="py-2 px-3">
                          ₹{viol.fine_amount || 1000}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            viol.status === 'PENDING'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                          }`}>
                            {viol.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 rounded bg-[#090E1A] text-center text-xs text-slate-500 font-mono">
                No active or historical traffic violations on record for this vehicle.
              </div>
            )}
          </div>

          {/* D. ANPR DETECTION HISTORY */}
          <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 shadow-xs space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <div className="flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wide">
                  ANPR Optical Sightings across Grid
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {profile.observations.length} SIGHTINGS LOGGED
              </span>
            </div>

            {profile.observations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[#1E293B] bg-[#0A0F1D] text-slate-400 text-[10px] font-bold uppercase">
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Sensor Node</th>
                      <th className="py-2 px-3">Corridor</th>
                      <th className="py-2 px-3">Direction</th>
                      <th className="py-2 px-3">OCR Confidence</th>
                      <th className="py-2 px-3">Visual Conf</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]/60 text-slate-300">
                    {profile.observations.map(obs => (
                      <tr key={obs.id} className="hover:bg-[#131F37]/50">
                        <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-100">
                          {obs.camera_code || 'CAM-01'}
                        </td>
                        <td className="py-2 px-3 text-slate-300 font-sans">
                          {obs.location_name || obs.camera_name || 'Observation Node'}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {obs.direction || 'NORTHBOUND'}
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-emerald-400 font-bold">{Math.round(obs.ocr_confidence * 100)}%</span>
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {Math.round(obs.detection_confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 rounded bg-[#090E1A] text-center text-xs text-slate-500 font-mono">
                No visual camera sightings registered for this plate yet.
              </div>
            )}
          </div>

          {/* E. OBSERVED CAMERA-TO-CAMERA TRAJECTORY MAP */}
          <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
              <div>
                <h3 className="font-bold text-xs font-mono text-slate-200 uppercase tracking-wide">
                  Observed Spatial Trajectory
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Chronological progression connecting consecutive camera observation nodes.
                </p>
              </div>
              <span className="text-[10px] font-mono text-blue-300 bg-[#131F37] px-2 py-0.5 rounded border border-[#1E293B] self-start sm:self-auto">
                {profile.trajectory?.points.length || 0} Observation Points
              </span>
            </div>

            {/* FLOW DIAGRAM */}
            {profile.trajectory && profile.trajectory.points.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded bg-[#090E1A] border border-[#1E293B] text-xs font-mono overflow-x-auto">
                {profile.trajectory.points.map((pt, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex items-center gap-1.5 bg-[#0D1526] px-2.5 py-1.5 rounded border border-[#1E293B]">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-100">{pt.camera_code}</div>
                        <div className="text-[9px] text-slate-400 font-sans">{pt.camera_name}</div>
                        <div className="text-[9px] text-blue-400">
                          {new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    {profile.trajectory?.points && idx < profile.trajectory.points.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* EMBEDDED LEAFLET MAP */}
            <div className="relative rounded overflow-hidden border border-[#1E293B] h-[360px] bg-[#090E1A]">
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>

            {/* Mandatory Disclaimers */}
            <div className="text-[10px] font-mono text-slate-500 bg-[#090E1A] p-2 rounded border border-[#1E293B]">
              <strong>Notice:</strong> Visualizes observed node detections. Does NOT represent continuous GPS tracking.
            </div>
          </div>
        </div>
      )}

      {/* 3. QUICK VEHICLE BROWSER TABLE */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 shadow-xs space-y-3 font-mono">
        <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
          <div>
            <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wide">
              Centralized Vehicle Registry ({allVehicles.length})
            </h3>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Click any vehicle record to load its comprehensive investigation profile.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0A0F1D] text-slate-400 text-[10px] font-bold uppercase sticky top-0">
                <th className="py-2 px-3">Plate Number</th>
                <th className="py-2 px-3">Vehicle Class</th>
                <th className="py-2 px-3">Sightings</th>
                <th className="py-2 px-3">Avg Speed</th>
                <th className="py-2 px-3">Threat Alert</th>
                <th className="py-2 px-3">Origin</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-slate-300">
              {allVehicles.map(veh => (
                <tr 
                  key={veh.id}
                  onClick={() => {
                    setQuery(veh.plate_number);
                    searchProfile(veh.plate_number);
                  }}
                  className="hover:bg-[#131F37]/50 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-3 font-bold text-slate-100">
                    <span className="bg-[#090E1A] px-2 py-0.5 rounded border border-[#1E293B]">
                      {veh.plate_number}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans text-slate-300 capitalize">
                    {veh.vehicle_type}
                  </td>
                  <td className="py-2 px-3">
                    {veh.observation_count}
                  </td>
                  <td className="py-2 px-3 text-slate-300">
                    {veh.average_speed_kmh} km/h
                  </td>
                  <td className="py-2 px-3">
                    {veh.has_alert ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                        {veh.alert_severity || 'ALERT'}
                      </span>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-[10px] text-slate-500">
                    {veh.data_source || 'REAL'}
                  </td>
                  <td className="py-2 px-3 text-right font-sans">
                    <span className="text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-0.5 text-xs">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VehicleSearchPage;
