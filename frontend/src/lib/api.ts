import { 
  Camera, CameraSummary, Vehicle, VehicleProfile, Observation, ANPRProcessResponse, 
  TrajectoryData, Alert, BlacklistRecord, TrafficSummary, 
  HeatmapPoint, ODRoute, SystemHealth,
  InvestigationRequest, InvestigationResult
} from '../types';

// Empty string default allows Vite dev proxy to route /api seamlessly across LAN without HTTPS mixed content issues
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {})
      }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error ${res.status}: ${errText || res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    console.error(`Request failed for ${url}:`, err);
    throw err;
  }
}

export const api = {
  // Health
  getHealth: () => fetchJson<{ status: string; supabase_connected: boolean }>('/api/health'),
  getSystemHealth: () => fetchJson<SystemHealth>('/api/system/health'),

  // Cameras (supports live vs demo mode filtering)
  getCameras: (mode: string = 'live') => fetchJson<Camera[]>(`/api/cameras?mode=${mode}`),
  getCamera: (id: string) => fetchJson<Camera>(`/api/cameras/${id}`),
  getCameraSummary: (mode: string = 'live') => fetchJson<CameraSummary>(`/api/cameras/summary?mode=${mode}`),
  updateCameraStatus: (id: string, status: string) =>
    fetchJson<Camera>(`/api/cameras/${id}/status?status=${status}`, { method: 'PATCH' }),

  updateCameraLocation: (
    id: string,
    req: {
      location_name?: string;
      latitude: number;
      longitude: number;
      location_source?: 'MANUAL' | 'GPS' | string;
    }
  ) =>
    fetchJson<Camera>(`/api/cameras/${id}/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),

  sendCameraHeartbeat: (req: {
    camera_id: string;
    latitude?: number;
    longitude?: number;
    status?: string;
  }) => fetchJson<Camera>('/api/cameras/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }),

  registerCamera: (req: {
    name: string;
    source_type?: 'LAPTOP_WEBCAM' | 'RTSP' | 'IP_CAMERA';
    camera_type?: 'CCTV' | 'IP_CAMERA' | 'LAPTOP_WEBCAM';
    location_name: string;
    latitude: number;
    longitude: number;
    stream_type?: string;
    stream_url?: string;
    location_source?: 'REAL' | 'DEMO';
  }) => fetchJson<Camera>('/api/cameras/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }),

  // Backward compatibility alias
  registerPhysicalCamera: (req: {
    name: string;
    camera_type: 'CCTV' | 'IP_CAMERA';
    location_name: string;
    latitude: number;
    longitude: number;
    stream_type?: string;
    stream_url?: string;
  }) => fetchJson<Camera>('/api/cameras/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }),

  // Vehicles & Comprehensive Investigation Profile
  getVehicles: (query?: string, mode: string = 'live') => {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    params.append('mode', mode);
    return fetchJson<Vehicle[]>(`/api/vehicles?${params.toString()}`);
  },
  getVehicle: (plate: string) => fetchJson<Vehicle>(`/api/vehicles/${encodeURIComponent(plate)}`),
  getVehicleProfile: (plate: string, mode: string = 'live') =>
    fetchJson<VehicleProfile>(`/api/vehicles/${encodeURIComponent(plate)}/profile?mode=${mode}`),
  getVehicleTrajectory: (plate: string, mode: string = 'live') =>
    fetchJson<TrajectoryData>(`/api/vehicles/${encodeURIComponent(plate)}/trajectory?mode=${mode}`),

  // ANPR & Observations
  processFrame: async (
    file: Blob, 
    cameraId: string, 
    engine?: string,
    coords?: { latitude?: number; longitude?: number; location_accuracy?: number }
  ): Promise<ANPRProcessResponse> => {
    const formData = new FormData();
    formData.append('image', file, 'capture.jpg');
    formData.append('camera_id', cameraId);
    if (engine) formData.append('engine', engine);
    if (coords?.latitude !== undefined) formData.append('latitude', String(coords.latitude));
    if (coords?.longitude !== undefined) formData.append('longitude', String(coords.longitude));
    if (coords?.location_accuracy !== undefined) formData.append('location_accuracy', String(coords.location_accuracy));

    const res = await fetch(`${API_BASE}/api/anpr/process`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ANPR processing failed (${res.status}): ${text}`);
    }
    return res.json();
  },

  correctPlate: (originalPlate: string, correctedPlate: string, observationId?: string) =>
    fetchJson<{ success: boolean; original_plate: string; corrected_plate: string }>(
      '/api/anpr/correct',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_plate: originalPlate,
          corrected_plate: correctedPlate,
          observation_id: observationId,
        }),
      }
    ),

  getObservations: (plate?: string, limit = 50, mode: string = 'live') => {
    const params = new URLSearchParams({ limit: String(limit), mode });
    if (plate) params.append('plate', plate);
    return fetchJson<Observation[]>(`/api/observations?${params.toString()}`);
  },

  simulateObservation: (plate: string, cameraId?: string, speedKmh?: number) =>
    fetchJson<Observation>('/api/anpr/simulate-sighting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate_number: plate, camera_id: cameraId, speed_kmh: speedKmh }),
    }),

  // Traffic
  getTrafficSummary: (mode: string = 'live') => fetchJson<TrafficSummary>(`/api/traffic/summary?mode=${mode}`),
  getTrafficHeatmap: (mode: string = 'live') => fetchJson<HeatmapPoint[]>(`/api/traffic/heatmap?mode=${mode}`),
  getTrafficOD: (mode: string = 'live') => fetchJson<ODRoute[]>(`/api/traffic/od?mode=${mode}`),

  // Alerts
  getAlerts: (status?: string, severity?: string, mode: string = 'live') => {
    const params = new URLSearchParams({ mode });
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);
    return fetchJson<Alert[]>(`/api/alerts?${params.toString()}`);
  },
  updateAlertStatus: (id: string, status: string) =>
    fetchJson<Alert>(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  acknowledgeAlert: (id: string) =>
    fetchJson<Alert>(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
    }),

  // Blacklist
  getBlacklist: (mode: string = 'live') => fetchJson<BlacklistRecord[]>(`/api/blacklist?mode=${mode}`),
  addBlacklist: (plate_number: string, reason: string, severity = 'HIGH', mode: string = 'live') =>
    fetchJson<BlacklistRecord>('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate_number, reason, severity, active: true, data_source: mode === 'demo' ? 'DEMO' : 'REAL' }),
    }),
  removeBlacklist: (plate: string) =>
    fetchJson<{ success: boolean; message: string }>(`/api/blacklist/${encodeURIComponent(plate)}`, {
      method: 'DELETE',
    }),
  simulateBlacklistHit: (plate: string) =>
    fetchJson<Alert>(`/api/blacklist/${encodeURIComponent(plate)}/simulate-hit`, {
      method: 'POST',
    }),

  // Demo Dataset Management
  loadDemoData: () => fetchJson<{ success: boolean; message: string; demo_vehicles_count: number }>('/api/demo/load', { method: 'POST' }),
  clearDemoData: () => fetchJson<{ success: boolean; message: string }>('/api/demo/clear', { method: 'POST' }),
  getDemoStatus: () => fetchJson<{ is_demo_loaded: boolean; demo_vehicles: number; real_vehicles: number }>('/api/demo/status'),

  // Vehicle Investigation Intelligence (TinyFish)
  startInvestigation: (req: InvestigationRequest) =>
    fetchJson<InvestigationResult>('/api/investigation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),

  getInvestigation: (id: string) =>
    fetchJson<InvestigationResult>(`/api/investigation/${encodeURIComponent(id)}`),

  getInvestigationHistory: (plate?: string) => {
    const params = new URLSearchParams();
    if (plate) params.append('plate', plate);
    return fetchJson<InvestigationResult[]>(`/api/investigation/history?${params.toString()}`);
  },

  streamInvestigation: (
    id: string,
    onUpdate: (data: InvestigationResult) => void,
    onComplete?: () => void,
    onError?: (err: any) => void
  ) => {
    const sseUrl = `${API_BASE}/api/investigation/${encodeURIComponent(id)}/stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        if (!event.data) return;
        const parsed = JSON.parse(event.data);
        if (parsed.error) {
          if (onError) onError(new Error(parsed.error));
          eventSource.close();
          return;
        }
        onUpdate(parsed as InvestigationResult);
        if (parsed.status === 'COMPLETED' || parsed.status === 'FAILED') {
          if (onComplete) onComplete();
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event in streamInvestigation:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('Investigation SSE stream error/closed:', err);
      if (onError) onError(err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  },
};

