"""
NAYAN — Demo Data Seed Script
Populates Supabase (or local cache) with:
- 20 Delhi CCTV Cameras
- 200+ Vehicles
- 5,000+ Observations
- Deterministic vehicles: DL01AB1234, DL03CA7788, HR26DK4521, UP16BT9021
- Active Blacklist records and alerts
- Traffic density events
"""

import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.supabase_service import supabase_service

DELHI_CAMERAS = [
    ("C-001", "Connaught Place Outer Circle", "Connaught Place, Central Delhi", 28.6315, 77.2167, "ONLINE", "WEBCAM"),
    ("C-002", "AIIMS Ring Road Flyover", "AIIMS Ansari Nagar, South Delhi", 28.5684, 77.2089, "ONLINE", "DEMO"),
    ("C-003", "Dhaula Kuan Metro Interchange", "Dhaula Kuan, South West Delhi", 28.5921, 77.1618, "ONLINE", "DEMO"),
    ("C-004", "India Gate C-Hexagon", "Rajpath, Central Delhi", 28.6129, 77.2295, "ONLINE", "DEMO"),
    ("C-005", "ITO Crossing North Gate", "ITO Junction, East-Central Delhi", 28.6304, 77.2410, "ONLINE", "DEMO"),
    ("C-006", "Lajpat Nagar Ring Road", "Lajpat Nagar II, South Delhi", 28.5700, 77.2400, "ONLINE", "DEMO"),
    ("C-007", "Nehru Place Outer Ring", "Nehru Place IT Hub, South Delhi", 28.5494, 77.2534, "ONLINE", "DEMO"),
    ("C-008", "Karol Bagh Pusa Road", "Karol Bagh, Central-West Delhi", 28.6448, 77.1895, "ONLINE", "DEMO"),
    ("C-009", "Kashmere Gate ISBT North", "Kashmere Gate, North Delhi", 28.6665, 77.2289, "OFFLINE", "DEMO"),
    ("C-010", "Ashram Chowk Underpass", "Ashram, South East Delhi", 28.5733, 77.2589, "ONLINE", "DEMO"),
    ("C-011", "Moolchand Underpass Entry", "Defence Colony, South Delhi", 28.5670, 77.2340, "ONLINE", "DEMO"),
    ("C-012", "South Extension Market", "South Extension I, South Delhi", 28.5715, 77.2215, "ONLINE", "DEMO"),
    ("C-013", "Barakhamba Road Radial", "Barakhamba, Central Delhi", 28.6290, 77.2240, "ONLINE", "DEMO"),
    ("C-014", "Akshardham NH-24 Entry", "Commonwealth Games Village, East Delhi", 28.6180, 77.2790, "ONLINE", "DEMO"),
    ("C-015", "Mayur Vihar Phase 1 Flyover", "Mayur Vihar, East Delhi", 28.6040, 77.2950, "ONLINE", "DEMO"),
    ("C-016", "Saket District Centre", "Saket, South Delhi", 28.5280, 77.2180, "MAINTENANCE", "DEMO"),
    ("C-017", "Hauz Khas Aurobindo Marg", "Hauz Khas, South Delhi", 28.5490, 77.2020, "ONLINE", "DEMO"),
    ("C-018", "Janakpuri District Centre", "Janakpuri West, West Delhi", 28.6290, 77.0810, "ONLINE", "DEMO"),
    ("C-019", "Rohini Sector 10 Chowk", "Rohini, North West Delhi", 28.7150, 77.1150, "ONLINE", "DEMO"),
    ("C-020", "Delhi Airport T3 Approach", "Aerocity Mahipalpur, South West Delhi", 28.5560, 77.0990, "ONLINE", "DEMO")
]

BLACKLIST_RECORDS = [
    ("HR26DK4521", "Armed Robbery getaway vehicle - FIR #892/2026 Special Cell", "CRITICAL"),
    ("UP16BT9021", "Reported stolen from Sector 62 Noida - High value theft", "HIGH"),
    ("DL07XY9999", "Fake HSRP registration plate / multiple traffic violations", "MEDIUM")
]

VEHICLE_TYPES = ["car", "suv", "motorcycle", "truck", "bus", "auto-rickshaw"]
STATES = ["DL", "HR", "UP", "MH", "PB", "RJ"]

def generate_random_plate():
    state = random.choice(STATES)
    rto = f"{random.randint(1, 14):02d}"
    series = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=2))
    num = f"{random.randint(1000, 9999)}"
    return f"{state}{rto}{series}{num}"

def run_seed():
    print("=" * 60)
    print("NAYAN - Seeding Demo Data")
    print(f"Supabase Status: {'CONNECTED' if supabase_service.is_connected() else 'LOCAL / OFFLINE (DEMO STATE)'}")
    print("=" * 60)

    now = datetime.now(timezone.utc)
    camera_ids = []

    # 1. Seed Cameras
    print(f"[*] Seeding {len(DELHI_CAMERAS)} Cameras...")
    for idx, cam in enumerate(DELHI_CAMERAS):
        code, name, loc, lat, lon, status, stype = cam
        cam_id = f"a0000000-0000-0000-0000-{idx+1:012d}"
        camera_ids.append(cam_id)
        data = {
            "id": cam_id,
            "camera_code": code,
            "name": name,
            "location_name": loc,
            "latitude": lat,
            "longitude": lon,
            "status": status,
            "stream_type": stype
        }
        if supabase_service.is_connected() and supabase_service.client:
            try:
                supabase_service.client.table("cameras").upsert(data).execute()
            except Exception as e:
                print(f"  [!] Supabase camera error: {e}")
        supabase_service.cameras[cam_id] = data

    # 2. Seed Blacklist
    print(f"[*] Seeding {len(BLACKLIST_RECORDS)} Blacklist Records...")
    for plate, reason, sev in BLACKLIST_RECORDS:
        data = {
            "id": str(uuid.uuid4()),
            "plate_number": plate,
            "reason": reason,
            "severity": sev,
            "active": True
        }
        if supabase_service.is_connected() and supabase_service.client:
            try:
                supabase_service.client.table("blacklist").upsert(data).execute()
            except Exception as e:
                print(f"  [!] Supabase blacklist error: {e}")
        supabase_service.blacklist[plate] = data

    # 3. Seed Deterministic & Synthetic Vehicles (200+ vehicles)
    print("[*] Generating 220+ Vehicles and 5,000+ Observations...")
    deterministic = ["DL01AB1234", "DL03CA7788", "HR26DK4521", "UP16BT9021", "MH12RN8890"]
    vehicles_pool = list(deterministic)

    for _ in range(215):
        vehicles_pool.append(generate_random_plate())

    for idx, plate in enumerate(vehicles_pool):
        v_type = random.choice(VEHICLE_TYPES)
        first_seen = now - timedelta(days=random.randint(1, 14), hours=random.randint(0, 23))
        last_seen = now - timedelta(minutes=random.randint(1, 120))
        v_data = {
            "id": str(uuid.uuid4()),
            "plate_number": plate,
            "vehicle_type": v_type,
            "first_seen": first_seen,
            "last_seen": last_seen,
            "observation_count": random.randint(3, 45),
            "cameras_visited": random.randint(2, 12),
            "average_speed_kmh": round(random.uniform(25.0, 58.0), 1),
            "has_alert": plate in [b[0] for b in BLACKLIST_RECORDS] or plate == "DL03CA7788"
        }
        supabase_service.vehicles[plate] = v_data

    # 4. Deterministic Trajectory Observations
    print("[*] Generating deterministic trajectory for DL01AB1234 (multi-camera route)...")
    dl01_route = [
        ("C-014", "Akshardham NH-24 Entry", 28.6180, 77.2790, 85),
        ("C-005", "ITO Crossing North Gate", 28.6304, 77.2410, 70),
        ("C-004", "India Gate C-Hexagon", 28.6129, 77.2295, 52),
        ("C-002", "AIIMS Ring Road Flyover", 28.5684, 77.2089, 30),
        ("C-003", "Dhaula Kuan Metro Interchange", 28.5921, 77.1618, 15)
    ]
    for code, name, lat, lon, mins_ago in dl01_route:
        supabase_service.record_observation({
            "plate_number": "DL01AB1234",
            "camera_code": code,
            "camera_name": name,
            "latitude": lat,
            "longitude": lon,
            "direction": "WESTBOUND",
            "vehicle_type": "car",
            "ocr_confidence": 0.96,
            "detection_confidence": 0.94,
            "timestamp": now - timedelta(minutes=mins_ago),
            "processing_time_ms": 28.0,
            "is_corrected": False
        })

    print("[*] Generating anomalous transition for DL03CA7788 (impossible speed)...")
    supabase_service.record_observation({
        "plate_number": "DL03CA7788",
        "camera_code": "C-009",
        "camera_name": "Kashmere Gate ISBT North",
        "latitude": 28.6665,
        "longitude": 77.2289,
        "direction": "SOUTHBOUND",
        "vehicle_type": "suv",
        "ocr_confidence": 0.94,
        "detection_confidence": 0.90,
        "timestamp": now - timedelta(minutes=40),
        "processing_time_ms": 34.0,
        "is_corrected": False
    })
    supabase_service.record_observation({
        "plate_number": "DL03CA7788",
        "camera_code": "C-020",
        "camera_name": "Delhi Airport T3 Approach",
        "latitude": 28.5560,
        "longitude": 77.0990,
        "direction": "WESTBOUND",
        "vehicle_type": "suv",
        "ocr_confidence": 0.91,
        "detection_confidence": 0.88,
        "timestamp": now - timedelta(minutes=34),
        "processing_time_ms": 30.0,
        "is_corrected": False
    })

    print("[*] Populating 5,000+ background ANPR observations...")
    # Add synthetic observations
    for _ in range(5050):
        plate = random.choice(vehicles_pool)
        cam = random.choice(DELHI_CAMERAS)
        code, name, loc, lat, lon, status, stype = cam
        mins_ago = random.randint(1, 1440)
        supabase_service.observations.append({
            "id": str(uuid.uuid4()),
            "plate_number": plate,
            "camera_code": code,
            "camera_name": name,
            "latitude": lat,
            "longitude": lon,
            "direction": random.choice(["NORTHBOUND", "SOUTHBOUND", "EASTBOUND", "WESTBOUND"]),
            "vehicle_type": random.choice(VEHICLE_TYPES),
            "ocr_confidence": round(random.uniform(0.82, 0.99), 2),
            "detection_confidence": round(random.uniform(0.85, 0.98), 2),
            "timestamp": now - timedelta(minutes=mins_ago),
            "processing_time_ms": round(random.uniform(22.0, 48.0), 1),
            "is_corrected": False
        })

    print("=" * 60)
    print(f"SUCCESS: Seed complete!")
    print(f"Cameras: {len(supabase_service.cameras)}")
    print(f"Vehicles: {len(supabase_service.vehicles)}")
    print(f"Observations: {len(supabase_service.observations)}")
    print(f"Blacklist: {len(supabase_service.blacklist)}")
    print(f"Active Alerts: {len(supabase_service.alerts)}")
    print("=" * 60)

if __name__ == "__main__":
    run_seed()
