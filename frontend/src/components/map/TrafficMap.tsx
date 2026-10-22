import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Camera, TrajectoryPoint, HeatmapPoint, Observation } from '../../types';
import { api } from '../../lib/api';
import { Layers, Video, Camera as CamIcon, Crosshair, Sparkles, ExternalLink } from 'lucide-react';

interface TrafficMapProps {
  cameras?: Camera[];
  trajectoryPoints?: TrajectoryPoint[];
  heatmapPoints?: HeatmapPoint[];
  selectedCameraId?: string;
  onSelectCamera?: (camera: Camera) => void;
  onSightingCreated?: (observation: Observation) => void;
  activePointIndex?: number;
  height?: string;
  showControls?: boolean;
}

type MapLayerType = 'carto_voyager' | 'google_roadmap' | 'google_traffic' | 'google_satellite' | 'google_terrain' | 'carto_dark';

const TILE_LAYERS: Record<MapLayerType, { url: string; attribution: string; subdomains: string[] | string; maxZoom: number; label: string }> = {
  carto_voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 20,
    label: 'Roadmap (HD)'
  },
  google_roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    label: 'Google Maps'
  },
  google_traffic: {
    url: 'https://mt{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    label: 'Live Traffic'
  },
  google_satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    label: 'Satellite'
  },
  google_terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    label: 'Terrain'
  },
  carto_dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    label: 'Dark Mode'
  }
};

export const TrafficMap: React.FC<TrafficMapProps> = ({
  cameras = [],
  trajectoryPoints = [],
  heatmapPoints = [],
  selectedCameraId,
  onSelectCamera,
  onSightingCreated,
  activePointIndex,
  height = '480px',
  showControls = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('google_roadmap');
  const [nodeFilter, setNodeFilter] = useState<'ALL' | 'CCTV' | 'IP_CAMERA'>('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Play subtle sound using Web Audio API
  const playChime = useCallback((frequency: number = 880) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // ignore
    }
  }, []);

  // Helper to safely create tile layer with fallback
  const createTileLayer = useCallback((layerKey: MapLayerType) => {
    const config = TILE_LAYERS[layerKey];
    const layer = L.tileLayer(config.url, {
      attribution: config.attribution,
      subdomains: config.subdomains,
      maxZoom: config.maxZoom
    });

    // Fallback if Google tile fails (e.g. ad-blocker or network restriction)
    layer.on('tileerror', () => {
      if (layerKey.startsWith('google') && mapInstanceRef.current && currentTileLayerRef.current === layer) {
        console.warn('Google Maps tile failed, falling back to Carto HD.');
        mapInstanceRef.current.removeLayer(layer);
        const fbConfig = TILE_LAYERS.carto_voyager;
        const fbLayer = L.tileLayer(fbConfig.url, {
          attribution: fbConfig.attribution,
          subdomains: fbConfig.subdomains,
          maxZoom: fbConfig.maxZoom
        }).addTo(mapInstanceRef.current);
        currentTileLayerRef.current = fbLayer;
        setActiveLayer('carto_voyager');
      }
    });

    return layer;
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Central Delhi
    const map = L.map(mapContainerRef.current, {
      center: [28.6139, 77.2090],
      zoom: 12,
      zoomControl: false,
    });

    const tileLayer = createTileLayer(activeLayer).addTo(map);

    currentTileLayerRef.current = tileLayer;
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Immediate and staged invalidateSize to handle flex/grid layout
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 250);
    const t3 = setTimeout(() => map.invalidateSize(), 600);

    let ro: ResizeObserver | null = null;
    if (window.ResizeObserver && mapContainerRef.current) {
      ro = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      ro.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (ro) ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Base Layer Switch
  const switchLayer = (layerType: MapLayerType) => {
    if (!mapInstanceRef.current || activeLayer === layerType) return;
    setActiveLayer(layerType);

    if (currentTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(currentTileLayerRef.current);
    }

    const newTileLayer = createTileLayer(layerType).addTo(mapInstanceRef.current);
    currentTileLayerRef.current = newTileLayer;
    playChime(660);
  };

  // Recenter map on active nodes or Central Delhi
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    if (cameras.length > 0) {
      const bounds = L.latLngBounds(cameras.map(c => [c.latitude, c.longitude]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      mapInstanceRef.current.flyTo([28.6139, 77.2090], 12);
    }
    playChime(540);
  };

  // Test ANPR Sighting at specific camera with synthetic test plates
  const handleSimulateAtCamera = async (cam: Camera) => {
    const testPlates = ['DL 99 ZZ 0001', 'DL 99 ZZ 0002', 'HR 99 YY 0003'];
    const chosenPlate = testPlates[Math.floor(Date.now() / 5000) % testPlates.length];
    try {
      const obs = await api.simulateObservation(chosenPlate, cam.id);
      playChime(1040);
      setActionNotice(`Recognized ${obs.plate_number} at ${cam.camera_code}!`);
      setTimeout(() => setActionNotice(null), 3500);
      if (onSightingCreated) onSightingCreated(obs);
    } catch (err: any) {
      console.error('Simulation error:', err);
    }
  };

  // Fly to camera if selectedCameraId changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedCameraId) return;
    const targetCam = cameras.find(c => c.id === selectedCameraId);
    if (targetCam) {
      mapInstanceRef.current.flyTo([targetCam.latitude, targetCam.longitude], 16, {
        duration: 1.2
      });
    }
  }, [selectedCameraId, cameras]);

  // Update Camera Markers & Heatmap
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    const filteredCams = cameras.filter(cam => {
      if (nodeFilter === 'CCTV') return cam.camera_type !== 'IP_CAMERA';
      if (nodeFilter === 'IP_CAMERA') return cam.camera_type === 'IP_CAMERA';
      return true;
    });

    filteredCams.forEach((cam) => {
      const isSelected = cam.id === selectedCameraId;
      const isOnline = cam.status === 'ONLINE';
      const isDegraded = cam.status === 'DEGRADED' || cam.status === 'MAINTENANCE';
      const isDemo = cam.data_source === 'DEMO' || cam.location_source === 'DEMO' || cam.source_type === 'DEMO';
      const sourceType = cam.source_type || (cam.camera_type === 'IP_CAMERA' ? 'IP_CAMERA' : 'RTSP');

      // GREEN = ONLINE, GRAY = OFFLINE, ORANGE = DEGRADED
      const color = isOnline 
        ? '#10b981' 
        : isDegraded 
        ? '#f59e0b' 
        : '#64748b';

      const typeLabel = sourceType.replace('_', ' ');

      const customIcon = L.divIcon({
        className: 'custom-cam-marker',
        html: `
          <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${color}; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 8px; font-weight: bold; ${isSelected ? 'transform: scale(1.25); border-color: #2563eb;' : ''}">
              📹
            </div>
            <span style="position: absolute; top: -20px; font-size: 9px; font-weight: 700; color: #0f172a; font-family: ui-monospace, monospace; white-space: nowrap; background: #ffffff; padding: 1px 5px; border-radius: 4px; border: 1px solid ${color}; box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
              ${cam.camera_code}
            </span>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const marker = L.marker([cam.latitude, cam.longitude], { icon: customIcon });

      const googleMapsUrl = `https://www.google.com/maps?q=${cam.latitude},${cam.longitude}`;
      const lastSeenStr = cam.last_seen ? new Date(cam.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Active now';

      const popupDiv = document.createElement('div');
      popupDiv.style.cssText = 'font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; padding: 4px; min-width: 240px;';
      popupDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 800; color: #0f172a; font-size: 13px; font-family: ui-monospace, monospace;">${cam.camera_code}</span>
          <span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${color}15; color: ${color}; border: 1px solid ${color}40;">
            ${cam.status}
          </span>
        </div>
        <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${cam.name}</div>
        <div style="color: #64748b; font-size: 11px; margin-top: 1px;">${cam.location_name}</div>
        
        ${isDemo ? `
          <div style="margin-top: 6px; display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px;">
            ⚠️ DEMO LOCATION
          </div>
        ` : ''}

        <div style="margin-top: 8px; padding: 7px 9px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 11px;">
          <div style="margin-bottom: 2px;">Camera ID: <b style="font-family: monospace; color: #0f172a;">${cam.id.slice(0, 8)}...</b></div>
          <div style="margin-bottom: 2px;">Status: <b style="color: ${color};">${cam.status}</b></div>
          <div style="margin-bottom: 2px;">Latitude: <span style="font-family: monospace; color: #334155;">${cam.latitude.toFixed(5)}</span></div>
          <div style="margin-bottom: 2px;">Longitude: <span style="font-family: monospace; color: #334155;">${cam.longitude.toFixed(5)}</span></div>
          <div style="margin-bottom: 2px;">Last Seen: <span style="color: #475569;">${lastSeenStr}</span></div>
          <div>Location Source: <span style="color: #2563eb; font-weight: 700; font-family: ui-monospace, monospace;">${cam.location_source || (isDemo ? 'DEMO' : 'MANUAL')}</span></div>
        </div>

        <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <button id="btn-fly-${cam.id}" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 8px; font-size: 11px; font-weight: 600; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 5px; cursor: pointer;">
            <span>🎯 Focus</span>
          </button>
          <button id="btn-sim-${cam.id}" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 8px; font-size: 11px; font-weight: 600; background: #2563eb; color: #ffffff; border: none; border-radius: 5px; cursor: pointer;">
            <span>⚡ Test ANPR</span>
          </button>
        </div>

        <div style="margin-top: 6px; text-align: center;">
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #2563eb; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">
            <span>🗺️ Open in Google Maps</span> &rarr;
          </a>
        </div>
      `;

      marker.bindPopup(popupDiv);

      marker.on('popupopen', () => {
        const flyBtn = document.getElementById(`btn-fly-${cam.id}`);
        const simBtn = document.getElementById(`btn-sim-${cam.id}`);

        if (flyBtn) {
          flyBtn.onclick = () => {
            mapInstanceRef.current?.flyTo([cam.latitude, cam.longitude], 16, { duration: 1 });
            playChime(600);
          };
        }

        if (simBtn) {
          simBtn.onclick = () => {
            handleSimulateAtCamera(cam);
          };
        }
      });

      marker.on('click', () => {
        if (onSelectCamera) onSelectCamera(cam);
      });

      markersLayerRef.current?.addLayer(marker);
    });

    // Heatmap density circles
    heatmapPoints.forEach((hp) => {
      const radius = Math.max(250, hp.density_score * 800);
      const color = hp.congestion_level === 'SEVERE' ? '#ef4444' :
                    hp.congestion_level === 'HEAVY' ? '#f97316' :
                    hp.congestion_level === 'MODERATE' ? '#eab308' : '#10b981';

      const circle = L.circle([hp.latitude, hp.longitude], {
        color: color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 1,
        radius: radius
      });
      markersLayerRef.current?.addLayer(circle);
    });
  }, [cameras, heatmapPoints, selectedCameraId, nodeFilter, onSelectCamera]);

  // Update Trajectory Polyline
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    if (trajectoryPoints.length > 0) {
      const latLngs: [number, number][] = trajectoryPoints.map(p => [p.latitude, p.longitude]);

      const polyline = L.polyline(latLngs, {
        color: '#2563eb',
        weight: 3.5,
        opacity: 0.85
      });
      routeLayerRef.current.addLayer(polyline);

      trajectoryPoints.forEach((pt, idx) => {
        const isAnomaly = Boolean(pt.anomaly);
        const isActive = idx === activePointIndex;
        const markerColor = isAnomaly ? '#ef4444' : isActive ? '#2563eb' : '#3b82f6';

        const seqIcon = L.divIcon({
          className: 'seq-marker',
          html: `
            <div style="background: ${markerColor}; color: #ffffff; width: ${isActive ? '26px' : '22px'}; height: ${isActive ? '26px' : '22px'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: ${isActive ? '12px' : '11px'}; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.2s; ${isActive ? 'transform: scale(1.15);' : ''}">
              ${pt.sequence_number}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const m = L.marker([pt.latitude, pt.longitude], { icon: seqIcon });
        m.bindPopup(`
          <div style="font-size: 12px; font-family: system-ui, sans-serif; line-height: 1.4; padding: 2px;">
            <div style="font-weight: 800; color: #0f172a;">Hop ${pt.sequence_number}: ${pt.camera_code}</div>
            <div style="color: #64748b; font-size: 11px;">${pt.camera_name}</div>
            <div style="margin-top: 5px; padding: 5px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 11px;">
              <div>Speed: <b style="color: ${isAnomaly ? '#ef4444' : '#10b981'}">${pt.estimated_speed_kmh} km/h</b></div>
              <div>Delta: <span style="font-family: monospace;">${pt.distance_from_prev_km} km / ${Math.round(pt.time_delta_seconds)}s</span></div>
              ${pt.anomaly ? `<div style="color: #ef4444; font-weight: 700; margin-top: 3px;">⚠️ ${pt.anomaly}</div>` : ''}
            </div>
          </div>
        `);
        routeLayerRef.current?.addLayer(m);
      });

      if (activePointIndex === undefined || activePointIndex === 0) {
        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      }

      // Active Playback Vehicle Marker
      if (activePointIndex !== undefined && activePointIndex >= 0 && activePointIndex < trajectoryPoints.length) {
        const activePt = trajectoryPoints[activePointIndex];
        const isAnomaly = Boolean(activePt.anomaly);

        const vehicleIcon = L.divIcon({
          className: 'vehicle-playback-marker',
          html: `
            <div style="background: ${isAnomaly ? '#ef4444' : '#0f172a'}; color: #ffffff; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; gap: 5px; white-space: nowrap;">
              <span>🚗</span> 
              <span>HOP ${activePt.sequence_number}</span>
              <span style="background: rgba(255,255,255,0.2); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 10px;">${activePt.estimated_speed_kmh} km/h</span>
            </div>
          `,
          iconSize: [110, 26],
          iconAnchor: [55, 13]
        });

        if (vehicleMarkerRef.current) {
          vehicleMarkerRef.current.setLatLng([activePt.latitude, activePt.longitude]);
          vehicleMarkerRef.current.setIcon(vehicleIcon);
        } else {
          vehicleMarkerRef.current = L.marker([activePt.latitude, activePt.longitude], { icon: vehicleIcon });
          routeLayerRef.current.addLayer(vehicleMarkerRef.current);
        }

        mapInstanceRef.current.panTo([activePt.latitude, activePt.longitude], { animate: true, duration: 0.5 });
      }
    }
  }, [trajectoryPoints, activePointIndex]);

  const cctvCount = cameras.filter(c => c.camera_type === 'CCTV' || (!c.camera_type && c.camera_type !== 'IP_CAMERA')).length;
  const ipCount = cameras.filter(c => c.camera_type === 'IP_CAMERA').length;

  return (
    <div 
      className="relative w-full rounded-lg overflow-hidden border border-gray-200 shadow-2xs group bg-slate-100" 
      style={{ height, minHeight: height === '100%' ? '240px' : height }}
    >
      <div 
        ref={mapContainerRef} 
        className="w-full h-full" 
        style={{ minHeight: height === '100%' ? '240px' : height }}
      />

      {/* Google Maps Brand Badge */}
      {activeLayer.startsWith('google') && (
        <div className="absolute bottom-2 left-2 z-[400] pointer-events-none select-none flex items-center gap-1.5 bg-white/80 px-2 py-0.5 rounded shadow-2xs backdrop-blur-2xs border border-gray-200/50">
          <span className="text-xs font-bold tracking-tight font-sans">
            <span style={{ color: '#4285F4' }}>G</span>
            <span style={{ color: '#EA4335' }}>o</span>
            <span style={{ color: '#FBBC05' }}>o</span>
            <span style={{ color: '#4285F4' }}>g</span>
            <span style={{ color: '#34A853' }}>l</span>
            <span style={{ color: '#EA4335' }}>e</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Maps</span>
        </div>
      )}

      {actionNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/95 text-white px-4 py-2 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2 text-xs font-medium backdrop-blur-xs">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {showControls && (
        <>
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 bg-white/95 p-1 rounded-md border border-gray-200 shadow-xs backdrop-blur-xs">
            <button
              onClick={() => setNodeFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                nodeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({cameras.length})
            </button>
            <button
              onClick={() => setNodeFilter('CCTV')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                nodeFilter === 'CCTV'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CamIcon className="w-3 h-3" />
              <span>CCTV ({cctvCount})</span>
            </button>
            <button
              onClick={() => setNodeFilter('IP_CAMERA')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                nodeFilter === 'IP_CAMERA'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>IP Cameras ({ipCount})</span>
            </button>
          </div>

          <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
            <div className="bg-white/95 p-1 rounded-md border border-gray-200 shadow-xs backdrop-blur-xs flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase flex items-center gap-1">
                <Layers className="w-3 h-3" />
              </span>
              {(Object.keys(TILE_LAYERS) as MapLayerType[]).map((layerKey) => (
                <button
                  key={layerKey}
                  onClick={() => switchLayer(layerKey)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                    activeLayer === layerKey
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {TILE_LAYERS[layerKey].label}
                </button>
              ))}
            </div>

            <button
              onClick={handleRecenter}
              title="Recenter Map"
              className="p-1.5 bg-white/95 hover:bg-slate-50 text-slate-700 rounded-md border border-gray-200 shadow-xs backdrop-blur-xs transition-colors cursor-pointer"
            >
              <Crosshair className="w-4 h-4 text-blue-600" />
            </button>
          </div>
        </>
      )}

      {cameras.length === 0 && trajectoryPoints.length === 0 && (
        <div className="absolute top-14 left-4 right-4 z-[400] pointer-events-none flex justify-center">
          <div className="bg-white/95 border border-slate-200 rounded-lg px-4 py-2.5 shadow-md backdrop-blur-xs flex items-center gap-3 text-xs text-slate-700 pointer-events-auto max-w-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" />
            <div>
              <span className="font-bold text-slate-900 block">No active camera nodes registered</span>
              <span className="text-[11px] text-slate-500">Connect a mobile phone camera node or register a physical CCTV camera to view live telemetry on the map.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
