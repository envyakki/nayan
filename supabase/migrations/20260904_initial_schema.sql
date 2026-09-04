-- NAYAN: Initial PostgreSQL Schema for Supabase with Data Source Separation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CAMERAS
CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    camera_type VARCHAR(20) NOT NULL DEFAULT 'CCTV' CHECK (camera_type IN ('CCTV', 'IP_CAMERA', 'MOBILE')),
    device_session_id VARCHAR(100),
    location_name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_accuracy DOUBLE PRECISION,
    last_seen TIMESTAMPTZ DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'MAINTENANCE')),
    stream_type VARCHAR(50) DEFAULT 'WEBCAM' CHECK (stream_type IN ('WEBCAM', 'WEBRTC', 'RTSP', 'DEMO')),
    stream_url TEXT,
    data_source VARCHAR(20) DEFAULT 'REAL' CHECK (data_source IN ('REAL', 'DEMO')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number VARCHAR(30) UNIQUE NOT NULL,
    vehicle_type VARCHAR(50) DEFAULT 'car',
    first_seen TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now(),
    observation_count INT DEFAULT 1,
    data_source VARCHAR(20) DEFAULT 'REAL' CHECK (data_source IN ('REAL', 'DEMO')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ANPR OBSERVATIONS
CREATE TABLE IF NOT EXISTS anpr_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number VARCHAR(30) NOT NULL,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT now(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    direction VARCHAR(50) DEFAULT 'NORTHBOUND',
    vehicle_type VARCHAR(50) DEFAULT 'car',
    ocr_confidence DOUBLE PRECISION DEFAULT 0.0,
    detection_confidence DOUBLE PRECISION DEFAULT 0.0,
    image_url TEXT,
    processing_time_ms DOUBLE PRECISION DEFAULT 0.0,
    is_corrected BOOLEAN DEFAULT FALSE,
    data_source VARCHAR(20) DEFAULT 'REAL' CHECK (data_source IN ('REAL', 'DEMO')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TRAJECTORIES
CREATE TABLE IF NOT EXISTS trajectories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number VARCHAR(30) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    total_distance_km DOUBLE PRECISION DEFAULT 0.0,
    average_speed_kmh DOUBLE PRECISION DEFAULT 0.0,
    anomaly_detected BOOLEAN DEFAULT FALSE,
    data_source VARCHAR(20) DEFAULT 'REAL' CHECK (data_source IN ('REAL', 'DEMO')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TRAJECTORY POINTS
CREATE TABLE IF NOT EXISTS trajectory_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trajectory_id UUID REFERENCES trajectories(id) ON DELETE CASCADE,
    observation_id UUID REFERENCES anpr_observations(id) ON DELETE SET NULL,
    sequence_number INT NOT NULL,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    estimated_speed_kmh DOUBLE PRECISION DEFAULT 0.0,
    data_source VARCHAR(20) DEFAULT 'REAL' CHECK (data_source IN ('REAL', 'DEMO')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. BLACKLIST
CREATE TABLE IF NOT EXISTS blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number VARCHAR(30) UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    active BOOLEAN DEFAULT TRUE,
    data_source VARCHAR(20) DEFAULT 'REAL' CHECK (data_source IN ('REAL', 'DEMO')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ALERTS
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('BLACKLIST_MATCH', 'IMPOSSIBLE_SPEED', 'SUSPICIOUS_ROUTE', 'LOW_OCR_CONFIDENCE', 'CAMERA_OFFLINE', 'REPEATED_APPEARANCE')),
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    plate_number VARCHAR(30),
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    risk_score INT DEFAULT 50,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
    data_source VARCHAR(20) DEFAULT 'REAL' CHECK (data_source IN ('REAL', 'DEMO')),
    created_at TIMESTAMPTZ DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

-- 8. TRAFFIC EVENTS
CREATE TABLE IF NOT EXISTS traffic_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_id UUID REFERENCES cameras(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT now(),
    vehicle_count INT DEFAULT 0,
    average_speed DOUBLE PRECISION DEFAULT 0.0,
    density_score DOUBLE PRECISION DEFAULT 0.0,
    congestion_level VARCHAR(20) DEFAULT 'LOW' CHECK (congestion_level IN ('LOW', 'MODERATE', 'HEAVY', 'SEVERE')),
    data_source VARCHAR(20) DEFAULT 'REAL' CHECK (data_source IN ('REAL', 'DEMO')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) DEFAULT 'system_operator',
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);
CREATE INDEX IF NOT EXISTS idx_anpr_plate ON anpr_observations(plate_number);
CREATE INDEX IF NOT EXISTS idx_anpr_timestamp ON anpr_observations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anpr_data_source ON anpr_observations(data_source);
CREATE INDEX IF NOT EXISTS idx_vehicles_data_source ON vehicles(data_source);
CREATE INDEX IF NOT EXISTS idx_alerts_data_source ON alerts(data_source);

-- RLS POLICIES
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE anpr_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trajectory_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cameras" ON cameras FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to cameras" ON cameras FOR ALL USING (true);
CREATE POLICY "Allow public read access to vehicles" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to vehicles" ON vehicles FOR ALL USING (true);
CREATE POLICY "Allow public read access to anpr_observations" ON anpr_observations FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to anpr_observations" ON anpr_observations FOR ALL USING (true);
CREATE POLICY "Allow public read access to trajectories" ON trajectories FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to trajectories" ON trajectories FOR ALL USING (true);
CREATE POLICY "Allow public read access to trajectory_points" ON trajectory_points FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to trajectory_points" ON trajectory_points FOR ALL USING (true);
CREATE POLICY "Allow public read access to blacklist" ON blacklist FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to blacklist" ON blacklist FOR ALL USING (true);
CREATE POLICY "Allow public read access to alerts" ON alerts FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to alerts" ON alerts FOR ALL USING (true);
CREATE POLICY "Allow public read access to traffic_events" ON traffic_events FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to traffic_events" ON traffic_events FOR ALL USING (true);
CREATE POLICY "Allow public read access to audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow service/anon write to audit_logs" ON audit_logs FOR ALL USING (true);
