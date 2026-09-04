-- NAYAN: Seed Data
-- 1. Insert 20 Delhi Cameras
INSERT INTO cameras (id, camera_code, name, location_name, latitude, longitude, status, stream_type) VALUES
('a0000000-0000-0000-0000-000000000001', 'C-001', 'Connaught Place Outer Circle', 'Connaught Place, Central Delhi', 28.6315, 77.2167, 'ONLINE', 'WEBCAM'),
('a0000000-0000-0000-0000-000000000002', 'C-002', 'AIIMS Ring Road Flyover', 'AIIMS Ansari Nagar, South Delhi', 28.5684, 77.2089, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000003', 'C-003', 'Dhaula Kuan Metro Interchange', 'Dhaula Kuan, South West Delhi', 28.5921, 77.1618, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000004', 'C-004', 'India Gate C-Hexagon', 'Rajpath, Central Delhi', 28.6129, 77.2295, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000005', 'C-005', 'ITO Crossing North Gate', 'ITO Junction, East-Central Delhi', 28.6304, 77.2410, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000006', 'C-006', 'Lajpat Nagar Ring Road', 'Lajpat Nagar II, South Delhi', 28.5700, 77.2400, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000007', 'C-007', 'Nehru Place Outer Ring', 'Nehru Place IT Hub, South Delhi', 28.5494, 77.2534, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000008', 'C-008', 'Karol Bagh Pusa Road', 'Karol Bagh, Central-West Delhi', 28.6448, 77.1895, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000009', 'C-009', 'Kashmere Gate ISBT North', 'Kashmere Gate, North Delhi', 28.6665, 77.2289, 'OFFLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000010', 'C-010', 'Ashram Chowk Underpass', 'Ashram, South East Delhi', 28.5733, 77.2589, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000011', 'C-011', 'Moolchand Underpass Entry', 'Defence Colony, South Delhi', 28.5670, 77.2340, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000012', 'C-012', 'South Extension Market', 'South Extension I, South Delhi', 28.5715, 77.2215, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000013', 'C-013', 'Barakhamba Road Radial', 'Barakhamba, Central Delhi', 28.6290, 77.2240, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000014', 'C-014', 'Akshardham NH-24 Entry', 'Commonwealth Games Village, East Delhi', 28.6180, 77.2790, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000015', 'C-015', 'Mayur Vihar Phase 1 Flyover', 'Mayur Vihar, East Delhi', 28.6040, 77.2950, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000016', 'C-016', 'Saket District Centre', 'Saket, South Delhi', 28.5280, 77.2180, 'MAINTENANCE', 'DEMO'),
('a0000000-0000-0000-0000-000000000017', 'C-017', 'Hauz Khas Aurobindo Marg', 'Hauz Khas, South Delhi', 28.5490, 77.2020, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000018', 'C-018', 'Janakpuri District Centre', 'Janakpuri West, West Delhi', 28.6290, 77.0810, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000019', 'C-019', 'Rohini Sector 10 Chowk', 'Rohini, North West Delhi', 28.7150, 77.1150, 'ONLINE', 'DEMO'),
('a0000000-0000-0000-0000-000000000020', 'C-020', 'Delhi Airport T3 Approach', 'Aerocity Mahipalpur, South West Delhi', 28.5560, 77.0990, 'ONLINE', 'DEMO')
ON CONFLICT (camera_code) DO NOTHING;

-- 2. Insert Blacklist Records
INSERT INTO blacklist (id, plate_number, reason, severity, active) VALUES
('b0000000-0000-0000-0000-000000000001', 'HR26DK4521', 'Armed Robbery getaway vehicle - FIR #892/2026 Special Cell', 'CRITICAL', true),
('b0000000-0000-0000-0000-000000000002', 'UP16BT9021', 'Reported stolen from Sector 62 Noida - High value theft', 'HIGH', true),
('b0000000-0000-0000-0000-000000000003', 'DL07XY9999', 'Fake HSRP registration plate / multiple traffic violations', 'MEDIUM', true)
ON CONFLICT (plate_number) DO NOTHING;

-- 3. Insert Deterministic Vehicles
INSERT INTO vehicles (id, plate_number, vehicle_type, first_seen, last_seen, observation_count) VALUES
('c0000000-0000-0000-0000-000000000001', 'DL01AB1234', 'car', now() - INTERVAL '3 hours', now() - INTERVAL '15 minutes', 5),
('c0000000-0000-0000-0000-000000000002', 'DL03CA7788', 'suv', now() - INTERVAL '2 hours', now() - INTERVAL '10 minutes', 3),
('c0000000-0000-0000-0000-000000000003', 'HR26DK4521', 'sedan', now() - INTERVAL '4 hours', now() - INTERVAL '5 minutes', 4),
('c0000000-0000-0000-0000-000000000004', 'UP16BT9021', 'motorcycle', now() - INTERVAL '5 hours', now() - INTERVAL '35 minutes', 3),
('c0000000-0000-0000-0000-000000000005', 'MH12RN8890', 'truck', now() - INTERVAL '6 hours', now() - INTERVAL '1 hour', 2)
ON CONFLICT (plate_number) DO NOTHING;

-- 4. Insert Observations for Trajectory of DL01AB1234
INSERT INTO anpr_observations (id, plate_number, camera_id, timestamp, latitude, longitude, direction, vehicle_type, ocr_confidence, detection_confidence, processing_time_ms) VALUES
('d0000000-0000-0000-0000-000000000001', 'DL01AB1234', 'a0000000-0000-0000-0000-000000000014', now() - INTERVAL '85 minutes', 28.6180, 77.2790, 'WESTBOUND', 'car', 0.96, 0.94, 28.5),
('d0000000-0000-0000-0000-000000000002', 'DL01AB1234', 'a0000000-0000-0000-0000-000000000005', now() - INTERVAL '70 minutes', 28.6304, 77.2410, 'WESTBOUND', 'car', 0.95, 0.92, 31.0),
('d0000000-0000-0000-0000-000000000003', 'DL01AB1234', 'a0000000-0000-0000-0000-000000000004', now() - INTERVAL '52 minutes', 28.6129, 77.2295, 'SOUTHBOUND', 'car', 0.97, 0.96, 26.4),
('d0000000-0000-0000-0000-000000000004', 'DL01AB1234', 'a0000000-0000-0000-0000-000000000002', now() - INTERVAL '30 minutes', 28.5684, 77.2089, 'SOUTHBOUND', 'car', 0.93, 0.91, 33.2),
('d0000000-0000-0000-0000-000000000005', 'DL01AB1234', 'a0000000-0000-0000-0000-000000000003', now() - INTERVAL '15 minutes', 28.5921, 77.1618, 'WESTBOUND', 'car', 0.98, 0.95, 29.1);

-- 5. Insert Observations for DL03CA7788 (Impossible Speed anomaly)
INSERT INTO anpr_observations (id, plate_number, camera_id, timestamp, latitude, longitude, direction, vehicle_type, ocr_confidence, detection_confidence, processing_time_ms) VALUES
('d0000000-0000-0000-0000-000000000006', 'DL03CA7788', 'a0000000-0000-0000-0000-000000000009', now() - INTERVAL '40 minutes', 28.6665, 77.2289, 'SOUTHBOUND', 'suv', 0.94, 0.90, 34.1),
('d0000000-0000-0000-0000-000000000007', 'DL03CA7788', 'a0000000-0000-0000-0000-000000000020', now() - INTERVAL '34 minutes', 28.5560, 77.0990, 'WESTBOUND', 'suv', 0.91, 0.88, 30.5);

-- 6. Insert Blacklist Hit Observation for HR26DK4521
INSERT INTO anpr_observations (id, plate_number, camera_id, timestamp, latitude, longitude, direction, vehicle_type, ocr_confidence, detection_confidence, processing_time_ms) VALUES
('d0000000-0000-0000-0000-000000000008', 'HR26DK4521', 'a0000000-0000-0000-0000-000000000001', now() - INTERVAL '5 minutes', 28.6315, 77.2167, 'NORTHBOUND', 'sedan', 0.99, 0.97, 24.8);

-- 7. Insert Active Alerts
INSERT INTO alerts (id, alert_type, severity, plate_number, camera_id, description, risk_score, status, created_at) VALUES
('e0000000-0000-0000-0000-000000000001', 'BLACKLIST_MATCH', 'CRITICAL', 'HR26DK4521', 'a0000000-0000-0000-0000-000000000001', 'CRITICAL MATCH: Vehicle HR26DK4521 flagged for Armed Robbery detected at C-001 (Connaught Place Outer Circle)', 95, 'ACTIVE', now() - INTERVAL '5 minutes'),
('e0000000-0000-0000-0000-000000000002', 'IMPOSSIBLE_SPEED', 'HIGH', 'DL03CA7788', 'a0000000-0000-0000-0000-000000000020', 'Potentially anomalous movement — requires review. Estimated speed 182.4 km/h between Kashmere Gate and Delhi Airport (6 mins elapsed, 18.2 km distance).', 85, 'ACTIVE', now() - INTERVAL '34 minutes'),
('e0000000-0000-0000-0000-000000000003', 'CAMERA_OFFLINE', 'MEDIUM', NULL, 'a0000000-0000-0000-0000-000000000009', 'Camera C-009 (Kashmere Gate ISBT North) has stopped emitting video feed heartbeat.', 60, 'ACTIVE', now() - INTERVAL '2 hours');

-- 8. Insert Traffic Events
INSERT INTO traffic_events (camera_id, timestamp, vehicle_count, average_speed, density_score, congestion_level) VALUES
('a0000000-0000-0000-0000-000000000001', now(), 142, 38.5, 0.65, 'MODERATE'),
('a0000000-0000-0000-0000-000000000002', now(), 210, 24.2, 0.88, 'HEAVY'),
('a0000000-0000-0000-0000-000000000003', now(), 185, 45.0, 0.72, 'MODERATE'),
('a0000000-0000-0000-0000-000000000004', now(), 98, 42.1, 0.40, 'LOW'),
('a0000000-0000-0000-0000-000000000005', now(), 265, 18.4, 0.94, 'SEVERE'),
('a0000000-0000-0000-0000-000000000010', now(), 240, 21.0, 0.91, 'SEVERE');
