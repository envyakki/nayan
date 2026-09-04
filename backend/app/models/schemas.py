from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class CameraStatus(str, Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    DEGRADED = "DEGRADED"
    MAINTENANCE = "MAINTENANCE"

class CameraSourceType(str, Enum):
    LAPTOP_WEBCAM = "LAPTOP_WEBCAM"
    RTSP = "RTSP"
    IP_CAMERA = "IP_CAMERA"
    DEMO = "DEMO"

class CameraType(str, Enum):
    CCTV = "CCTV"
    IP_CAMERA = "IP_CAMERA"
    LAPTOP_WEBCAM = "LAPTOP_WEBCAM"

class StreamType(str, Enum):
    WEBCAM = "WEBCAM"
    WEBRTC = "WEBRTC"
    RTSP = "RTSP"
    DEMO = "DEMO"

class SeverityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"

class AlertTypeEnum(str, Enum):
    BLACKLISTED_VEHICLE = "BLACKLISTED_VEHICLE"
    BLACKLIST_MATCH = "BLACKLIST_MATCH"
    CHALLAN_MATCH = "CHALLAN_MATCH"
    IMPOSSIBLE_SPEED = "IMPOSSIBLE_SPEED"
    SUSPICIOUS_ROUTE = "SUSPICIOUS_ROUTE"
    LOW_CONFIDENCE_OCR = "LOW_CONFIDENCE_OCR"
    LOW_OCR_CONFIDENCE = "LOW_OCR_CONFIDENCE"
    CAMERA_OFFLINE = "CAMERA_OFFLINE"
    REPEATED_APPEARANCE = "REPEATED_APPEARANCE"

class AlertStatusEnum(str, Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"

class CameraSchema(BaseModel):
    id: str
    camera_code: str
    camera_name: Optional[str] = None
    name: str
    source_type: str = "LAPTOP_WEBCAM"
    source_url: Optional[str] = None
    location_name: str
    latitude: float
    longitude: float
    status: CameraStatus = CameraStatus.ONLINE
    camera_type: str = "CCTV"
    location_source: Optional[str] = "REAL"  # REAL or DEMO
    location_accuracy: Optional[float] = None
    last_seen: Optional[datetime] = None
    stream_type: str = "WEBCAM"
    stream_url: Optional[str] = None
    vehicles_per_min: Optional[int] = 0
    anpr_per_min: Optional[int] = 0
    data_source: Optional[str] = "REAL"
    created_at: Optional[datetime] = None

class CameraHeartbeatRequest(BaseModel):
    camera_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = "ONLINE"

class CameraRegistrationRequest(BaseModel):
    name: str
    camera_type: Optional[str] = "CCTV"
    source_type: Optional[str] = "LAPTOP_WEBCAM"
    location_name: str
    latitude: float
    longitude: float
    stream_type: str = "RTSP"
    stream_url: Optional[str] = None
    location_source: Optional[str] = "REAL"

class CameraLocationUpdateRequest(BaseModel):
    location_name: Optional[str] = None
    latitude: float
    longitude: float
    location_source: Optional[str] = "MANUAL"

class VehicleOwnerSchema(BaseModel):
    id: str
    vehicle_id: str
    owner_name: str
    ownership_type: str = "Individual"
    registration_date: Optional[datetime] = None
    data_source: str = "DEMO"

class ViolationSchema(BaseModel):
    id: str
    vehicle_id: str
    violation_type: str
    violation_date: datetime
    status: str = "PENDING"  # PENDING, PAID, DISPUTED
    camera_id: Optional[str] = None
    camera_name: Optional[str] = None
    location_name: Optional[str] = None
    fine_amount: Optional[int] = None
    data_source: str = "DEMO"

class DetectionItem(BaseModel):
    plate_number: str
    raw_ocr: Optional[str] = None
    normalized_plate: str
    ocr_confidence: float
    detection_confidence: float
    vehicle_type: str = "CAR"  # CAR, MOTORCYCLE, BUS, TRUCK, PERSON
    track_id: Optional[int] = None
    bbox: List[int] = Field(..., description="[x1, y1, x2, y2] of license plate")
    vehicle_bbox: Optional[List[int]] = Field(None, description="[x1, y1, x2, y2] of detected vehicle")
    ocr_engine: str = "demo"
    alert_triggered: Optional[str] = None
    speed_estimate_kmh: Optional[float] = None
    is_demo: bool = False

class ANPRProcessResponse(BaseModel):
    success: bool
    detections: List[DetectionItem]
    processing_time_ms: float
    camera_id: str
    engine_used: str
    mode: str
    disclaimer: str = "DEMO / EXPERIMENTAL MODE: Local computer vision detection"

class ANPRCorrectionRequest(BaseModel):
    observation_id: Optional[str] = None
    original_plate: str
    corrected_plate: str
    camera_id: Optional[str] = None
    reason: Optional[str] = "Manual operator validation"

class ANPRObservationSchema(BaseModel):
    id: str
    plate_number: str
    camera_id: Optional[str] = None
    camera_code: Optional[str] = None
    camera_name: Optional[str] = None
    timestamp: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    direction: Optional[str] = "NORTHBOUND"
    vehicle_type: Optional[str] = "car"
    ocr_confidence: float = 0.0
    detection_confidence: float = 0.0
    image_url: Optional[str] = None
    processing_time_ms: float = 0.0
    is_corrected: bool = False
    alert_triggered: Optional[str] = None
    data_source: Optional[str] = "REAL"
    created_at: Optional[datetime] = None

class TrajectoryPointSchema(BaseModel):
    sequence_number: int
    camera_id: str
    camera_code: str
    camera_name: str
    timestamp: datetime
    latitude: float
    longitude: float
    distance_from_prev_km: float = 0.0
    time_delta_seconds: float = 0.0
    estimated_speed_kmh: float = 0.0
    anomaly: Optional[str] = None

class TrajectoryResponse(BaseModel):
    plate_number: str
    total_observations: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_distance_km: float = 0.0
    average_speed_kmh: float = 0.0
    anomaly_detected: bool = False
    anomaly_reason: Optional[str] = None
    points: List[TrajectoryPointSchema]

class VehicleSchema(BaseModel):
    id: str
    plate_number: str
    vehicle_type: str = "car"
    vehicle_class: str = "Private Car"
    color: str = "White"
    registration_status: str = "ACTIVE"
    registration_date: Optional[datetime] = None
    registration_valid_until: Optional[datetime] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    observation_count: int = 1
    cameras_visited: int = 1
    average_speed_kmh: Optional[float] = 42.0
    has_alert: bool = False
    alert_severity: Optional[str] = None
    data_source: Optional[str] = "REAL"
    created_at: Optional[datetime] = None

class BlacklistSchema(BaseModel):
    id: str
    vehicle_id: Optional[str] = None
    plate_number: str
    reason: str
    severity: SeverityEnum = SeverityEnum.HIGH
    active: bool = True
    added_at: Optional[datetime] = None
    data_source: Optional[str] = "REAL"
    created_at: Optional[datetime] = None

class VehicleDetailProfileResponse(BaseModel):
    vehicle: VehicleSchema
    owner: Optional[VehicleOwnerSchema] = None
    violations: List[ViolationSchema] = []
    blacklist: Optional[BlacklistSchema] = None
    observations: List[ANPRObservationSchema] = []
    trajectory: Optional[TrajectoryResponse] = None
    alerts: List['AlertSchema'] = []
    is_synthetic: bool = True
    disclaimer: str = "SYNTHETIC DEMO DATA: Exposes only non-sensitive registration metadata. No real personal records."

class BlacklistCreateRequest(BaseModel):
    plate_number: str
    reason: str
    severity: SeverityEnum = SeverityEnum.HIGH
    active: bool = True

class AlertSchema(BaseModel):
    id: str
    alert_type: AlertTypeEnum
    severity: SeverityEnum
    plate_number: Optional[str] = None
    camera_id: Optional[str] = None
    camera_code: Optional[str] = None
    camera_name: Optional[str] = None
    description: str
    risk_score: int = 50
    status: AlertStatusEnum = AlertStatusEnum.ACTIVE
    data_source: Optional[str] = "REAL"
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

class AlertUpdateRequest(BaseModel):
    status: AlertStatusEnum

class TrafficSummaryResponse(BaseModel):
    active_cameras: int
    total_cameras: int
    vehicles_today: int
    anpr_reads_today: int
    active_alerts: int
    average_speed_kmh: float
    congestion_index: float
    congestion_level: str
    peak_hour: str
    timestamp: datetime

class ODRoute(BaseModel):
    origin_camera_code: str
    origin_name: str
    destination_camera_code: str
    destination_name: str
    vehicle_count: int
    avg_travel_time_mins: float
    avg_speed_kmh: float

class HeatmapPoint(BaseModel):
    camera_id: str
    camera_code: str
    name: str
    latitude: float
    longitude: float
    density_score: float
    congestion_level: str
    vehicle_count: int

class SystemComponentStatus(BaseModel):
    status: str  # ONLINE, OFFLINE, WARNING
    latency_ms: Optional[float] = None
    details: Optional[str] = None

class SystemHealthResponse(BaseModel):
    frontend: SystemComponentStatus
    backend: SystemComponentStatus
    supabase: SystemComponentStatus
    anpr_engine: SystemComponentStatus
    ocr_engine: SystemComponentStatus
    realtime: SystemComponentStatus
    overall_status: str
    api_latency_ms: float
    processing_latency_ms: float
    events_per_sec: float
    uptime_seconds: float

class SimulateObservationRequest(BaseModel):
    plate_number: str
    camera_id: Optional[str] = None
    speed_kmh: Optional[float] = None

# ============================================================================
# VEHICLE INVESTIGATION INTELLIGENCE (TINYFISH INTEGRATION) SCHEMAS
# ============================================================================

class ComparisonStatusEnum(str, Enum):
    MATCH = "MATCH"
    MISSING = "MISSING"
    ADDITIONAL = "ADDITIONAL"
    CONFLICT = "CONFLICT"

class SourceStatusEnum(str, Enum):
    CHECKED = "CHECKED"
    UNAVAILABLE = "UNAVAILABLE"
    NO_RELEVANT_RESULT = "NO_RELEVANT_RESULT"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"

class RecordTypeEnum(str, Enum):
    VEHICLE_REGISTRATION = "VEHICLE_REGISTRATION"
    CHALLAN = "CHALLAN"
    VIOLATION = "VIOLATION"
    INCIDENT = "INCIDENT"
    ACCIDENT_REPORT = "ACCIDENT_REPORT"
    NEWS_REPORT = "NEWS_REPORT"
    PUBLIC_NOTICE = "PUBLIC_NOTICE"

class TimelineEventTypeEnum(str, Enum):
    NAYAN_DETECTION = "NAYAN_DETECTION"
    SOURCE_RECORD = "SOURCE_RECORD"
    PUBLIC_WEB_FINDING = "PUBLIC_WEB_FINDING"

class InvestigationActivityStep(BaseModel):
    id: str
    label: str
    status: str = "completed"  # pending, running, completed, warning, error
    timestamp: Optional[datetime] = None
    detail: Optional[str] = None

class InvestigationSourceAnalysis(BaseModel):
    source_name: str
    source_url: str
    status: SourceStatusEnum
    records_found: int = 0
    events: List[str] = []
    dates: List[str] = []
    locations: List[str] = []
    evidence: List[str] = []
    response_time_ms: Optional[float] = None
    status_note: Optional[str] = None

class CrossSourceDiscrepancy(BaseModel):
    id: str
    category: ComparisonStatusEnum
    field_or_subject: str
    description: str
    sources_involved: List[str] = []
    evidence: str
    severity: Optional[str] = "INFO"

class WebIntelligenceFinding(BaseModel):
    id: str
    title: str
    source_name: str
    source_url: str
    publication_date: Optional[str] = None
    event_date: Optional[str] = None
    extracted_evidence: str
    relationship_to_nayan_event: str
    relevance_score: float = 0.85
    confidence: float = 0.90

class InvestigationTimelineEvent(BaseModel):
    id: str
    event_type: TimelineEventTypeEnum
    timestamp: datetime
    event_date: str
    event_time: str
    source_name: str
    source_url: Optional[str] = None
    title: str
    description: str
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    confidence: Optional[float] = None
    comparison_status: Optional[ComparisonStatusEnum] = None
    evidence: Optional[str] = None

class InvestigationTrajectorySummary(BaseModel):
    total_sightings: int = 0
    first_sighting: Optional[datetime] = None
    last_sighting: Optional[datetime] = None
    camera_sequence: List[str] = []
    route: List[str] = []
    direction: Optional[str] = None
    total_distance_km: float = 0.0
    average_speed_kmh: float = 0.0

class InvestigationRequest(BaseModel):
    plate_number: str
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    include_web_intelligence: bool = True

class InvestigationResult(BaseModel):
    investigation_id: str
    plate_number: str
    start_date: str
    end_date: str
    status: str = "COMPLETED"  # IN_PROGRESS, COMPLETED, FAILED
    created_at: datetime
    completed_at: Optional[datetime] = None
    vehicle_context: Dict[str, Any] = {}
    trajectory_summary: Optional[InvestigationTrajectorySummary] = None
    sources: List[InvestigationSourceAnalysis] = []
    cross_source_analysis: List[CrossSourceDiscrepancy] = []
    web_intelligence: List[WebIntelligenceFinding] = []
    timeline: List[InvestigationTimelineEvent] = []
    agent_activity_log: List[InvestigationActivityStep] = []
    summary_verdict: str
    disclaimer: str = (
        "INVESTIGATION ASSISTANCE NOTICE: Information synthesized from authorized/public sources "
        "and public web records. Does not constitute autonomous legal accusation. Human verification required."
    )

VehicleDetailProfileResponse.model_rebuild()
InvestigationResult.model_rebuild()
