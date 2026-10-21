export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';
export type CameraType = 'CCTV' | 'IP_CAMERA' | 'LAPTOP_WEBCAM' | 'MOBILE';
export type CameraSourceType = 'LAPTOP_WEBCAM' | 'RTSP' | 'IP_CAMERA' | 'DEMO';
export type StreamType = 'WEBCAM' | 'WEBRTC' | 'RTSP' | 'DEMO';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type AlertType = 
  | 'BLACKLISTED_VEHICLE' 
  | 'BLACKLIST_MATCH' 
  | 'CHALLAN_MATCH' 
  | 'IMPOSSIBLE_SPEED' 
  | 'SUSPICIOUS_ROUTE' 
  | 'LOW_CONFIDENCE_OCR' 
  | 'LOW_OCR_CONFIDENCE' 
  | 'CAMERA_OFFLINE' 
  | 'REPEATED_APPEARANCE';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Camera {
  id: string;
  camera_code: string;
  camera_name?: string;
  name: string;
  source_type?: CameraSourceType;
  source_url?: string;
  camera_type?: CameraType;
  device_session_id?: string;
  location_name: string;
  latitude: number;
  longitude: number;
  location_source?: 'REAL' | 'DEMO' | 'MANUAL' | 'GPS';
  location_accuracy?: number;
  status: CameraStatus;
  stream_type: StreamType;
  stream_url?: string;
  last_heartbeat?: string;
  last_seen?: string;
  vehicles_per_min?: number;
  anpr_per_min?: number;
  created_at?: string;
  data_source?: 'REAL' | 'DEMO';
}

export interface CameraSummary {
  online: number;
  offline: number;
  degraded: number;
  total: number;
}

export interface VehicleOwner {
  id: string;
  vehicle_id: string;
  owner_name: string;
  ownership_type: string;
  registration_date?: string;
  data_source: string;
}

export interface Violation {
  id: string;
  vehicle_id: string;
  violation_type: string;
  violation_date: string;
  status: string; // PENDING, PAID, DISPUTED
  camera_id?: string;
  camera_name?: string;
  location_name?: string;
  fine_amount?: number;
  data_source: string;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_type: string;
  vehicle_class?: string;
  color?: string;
  registration_status?: string;
  registration_date?: string;
  registration_valid_until?: string;
  first_seen?: string;
  last_seen?: string;
  observation_count: number;
  cameras_visited: number;
  average_speed_kmh?: number;
  has_alert: boolean;
  alert_severity?: Severity;
  data_source?: 'REAL' | 'DEMO';
}

export interface Observation {
  id: string;
  plate_number: string;
  camera_id?: string;
  camera_code?: string;
  camera_name?: string;
  location_name?: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  direction?: string;
  vehicle_type?: string;
  ocr_confidence: number;
  detection_confidence: number;
  processing_time_ms: number;
  is_corrected: boolean;
  alert_triggered?: string;
  data_source?: 'REAL' | 'DEMO';
}

export interface DetectionItem {
  plate_number: string;
  raw_ocr?: string;
  normalized_plate: string;
  ocr_confidence: number;
  detection_confidence: number;
  vehicle_type: string;
  track_id?: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  vehicle_bbox?: [number, number, number, number]; // [x1, y1, x2, y2]
  ocr_engine: string;
  is_demo: boolean;
  speed_estimate_kmh?: number;
  alert_triggered?: string;
}

export interface ANPRProcessResponse {
  success: boolean;
  detections: DetectionItem[];
  processing_time_ms: number;
  camera_id: string;
  engine_used: string;
  mode: string;
  disclaimer: string;
}

export interface TrajectoryPoint {
  sequence_number: number;
  camera_id: string;
  camera_code: string;
  camera_name: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  distance_from_prev_km: number;
  time_delta_seconds: number;
  estimated_speed_kmh: number;
  anomaly?: string;
}

export interface TrajectoryData {
  plate_number: string;
  total_observations: number;
  start_time?: string;
  end_time?: string;
  total_distance_km: number;
  average_speed_kmh: number;
  anomaly_detected: boolean;
  anomaly_reason?: string;
  points: TrajectoryPoint[];
}

export interface VehicleProfile {
  vehicle: Vehicle;
  owner?: VehicleOwner | null;
  violations: Violation[];
  blacklist?: BlacklistRecord | null;
  observations: Observation[];
  trajectory?: TrajectoryData | null;
  alerts: Alert[];
  is_synthetic: boolean;
  disclaimer: string;
}

export interface BlacklistRecord {
  id: string;
  plate_number: string;
  reason: string;
  severity: Severity;
  active: boolean;
  added_at?: string;
  created_at?: string;
}

export interface Alert {
  id: string;
  alert_type: AlertType;
  severity: Severity;
  plate_number?: string;
  camera_id?: string;
  camera_code?: string;
  camera_name?: string;
  description: string;
  risk_score: number;
  status: AlertStatus;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface TrafficSummary {
  active_cameras: number;
  total_cameras: number;
  vehicles_today: number;
  anpr_reads_today: number;
  active_alerts: number;
  average_speed_kmh: number;
  congestion_index: number;
  congestion_level: string;
  peak_hour: string;
  timestamp: string;
}

export interface ODRoute {
  origin_camera_code: string;
  origin_name: string;
  destination_camera_code: string;
  destination_name: string;
  vehicle_count: number;
  avg_travel_time_mins: number;
  avg_speed_kmh: number;
}

export interface HeatmapPoint {
  camera_id: string;
  camera_code: string;
  name: string;
  latitude: number;
  longitude: number;
  density_score: number;
  congestion_level: string;
  vehicle_count: number;
}

export interface SystemComponentStatus {
  status: string;
  latency_ms?: number;
  details?: string;
}

export interface SystemHealth {
  frontend: SystemComponentStatus;
  backend: SystemComponentStatus;
  supabase: SystemComponentStatus;
  anpr_engine: SystemComponentStatus;
  ocr_engine: SystemComponentStatus;
  realtime: SystemComponentStatus;
  overall_status: string;
  api_latency_ms: number;
  processing_latency_ms: number;
  events_per_sec: number;
  uptime_seconds: number;
}

// ==========================================
// Vehicle Investigation Intelligence (TinyFish)
// ==========================================
export type ComparisonStatus = 'MATCH' | 'MISSING' | 'ADDITIONAL' | 'CONFLICT';
export type SourceStatus = 'SUCCESS' | 'NO_RECORDS' | 'ACCESSIBLE' | 'PARTIAL' | 'TIMEOUT' | 'ERROR';
export type RecordType = 'CHALLAN' | 'REGISTRATION' | 'PERMIT' | 'TAX' | 'NOTICE' | 'NEWS' | 'INCIDENT' | 'OTHER';
export type TimelineEventType = 'NAYAN_DETECTION' | 'SOURCE_RECORD' | 'PUBLIC_WEB_FINDING';

export interface InvestigationActivityStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp?: string;
  elapsed_seconds?: number;
}

export interface InvestigationSourceRecord {
  id?: string;
  challan_number?: string;
  notice_id?: string;
  record_type?: RecordType;
  date?: string;
  time?: string;
  location?: string;
  violation?: string;
  amount?: number;
  status?: string;
  source?: string;
  details?: Record<string, any>;
}

export interface InvestigationSourceAnalysis {
  source_name: string;
  source_url: string;
  status: string;
  records_found?: number;
  total_records?: number;
  events?: string[];
  dates?: string[];
  locations?: string[];
  evidence?: string[];
  response_time_ms?: number;
  latency_ms?: number;
  status_note?: string;
  summary?: string;
  records?: InvestigationSourceRecord[];
}

export interface CrossSourceDiscrepancy {
  id: string;
  category: ComparisonStatus;
  field_or_subject?: string;
  title?: string;
  description: string;
  sources_involved: string[];
  evidence: string | Record<string, any>;
  severity?: string;
  confidence?: number;
  recommended_action?: string;
}

export interface WebIntelligenceFinding {
  id?: string;
  title: string;
  url?: string;
  source_url?: string;
  source_name?: string;
  snippet?: string;
  extracted_evidence?: string;
  publication_date?: string;
  published_date?: string;
  event_date?: string;
  relevance_score?: number;
  confidence?: number;
  incident_type?: string;
  relationship_to_nayan_event?: string;
  location_mentioned?: string;
}

export interface InvestigationTimelineEvent {
  id: string;
  timestamp: string;
  event_date?: string;
  event_time?: string;
  event_type: TimelineEventType;
  source?: string;
  source_name?: string;
  source_url?: string;
  title: string;
  description: string;
  location?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  severity?: Severity;
  comparison_status?: ComparisonStatus;
  confidence?: number;
  evidence?: string;
  metadata?: Record<string, any>;
}

export interface InvestigationTrajectorySummary {
  plate_number?: string;
  total_detections?: number;
  total_sightings?: number;
  unique_cameras?: number;
  start_time?: string;
  end_time?: string;
  first_sighting?: string;
  last_sighting?: string;
  camera_sequence?: string[];
  route?: string[];
  direction?: string;
  total_distance_km: number;
  average_speed_kmh?: number;
  cameras_visited?: string[];
  anomalies_flagged?: number;
}

export interface InvestigationRequest {
  plate_number: string;
  start_date: string;
  end_date: string;
  include_web_intelligence?: boolean;
  notes?: string;
}

export interface InvestigationResult {
  id?: string;
  investigation_id?: string;
  plate_number: string;
  start_date: string;
  end_date: string;
  created_at: string;
  completed_at?: string;
  status: string;
  progress_percentage?: number;
  agent_activity?: InvestigationActivityStep[];
  agent_activity_log?: InvestigationActivityStep[];
  vehicle_context?: Record<string, any>;
  trajectory_summary?: InvestigationTrajectorySummary;
  sources: InvestigationSourceAnalysis[] | Record<string, InvestigationSourceAnalysis>;
  cross_source_analysis?: CrossSourceDiscrepancy[];
  cross_source_discrepancies?: CrossSourceDiscrepancy[];
  web_intelligence: WebIntelligenceFinding[];
  timeline?: InvestigationTimelineEvent[];
  unified_timeline?: InvestigationTimelineEvent[];
  summary_verdict: string;
  total_anomalies?: number;
  disclaimer?: string;
}

