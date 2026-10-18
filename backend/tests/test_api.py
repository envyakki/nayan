import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
import numpy as np
import cv2
import io

client = TestClient(app)

def test_all():
    # 1. Default CAM-01 Camera verification (Requirement 3)
    cams = client.get('/api/cameras?mode=live').json()
    print(f"LIVE MODE CAMERAS: {len(cams)}")
    assert len(cams) >= 1, "Expected CAM-01 to be registered by default"
    cam01 = next((c for c in cams if c['camera_code'] == 'CAM-01'), None)
    assert cam01 is not None, "CAM-01 must be present in live mode"
    assert cam01['latitude'] == 28.6139
    assert cam01['longitude'] == 77.2090
    assert cam01['location_source'] == 'MANUAL'
    print(f"PASS: Default CAM-01 verified: {cam01['camera_name']} ({cam01['latitude']}, {cam01['longitude']}) [Source: {cam01['location_source']}]")

    # 2. Location Configuration API Test (Requirement 3 & 13)
    patch_loc_res = client.patch(f"/api/cameras/{cam01['id']}/location", json={
        "location_name": "Delhi Traffic Central Node",
        "latitude": 28.6200,
        "longitude": 77.2100,
        "location_source": "MANUAL"
    })
    assert patch_loc_res.status_code == 200, f"Location update failed: {patch_loc_res.text}"
    updated_cam = patch_loc_res.json()
    assert updated_cam['latitude'] == 28.6200
    assert updated_cam['longitude'] == 77.2100
    assert updated_cam['location_name'] == "Delhi Traffic Central Node"
    print("PASS: PATCH /cameras/{camera_id}/location successfully updated camera location")

    # Restore default CAM-01 location
    client.patch(f"/api/cameras/{cam01['id']}/location", json={
        "location_name": "Operator Command Station",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "location_source": "MANUAL"
    })

    # 3. Observation Coordinate Inheritance (Requirement 5)
    obs_res = client.post('/api/anpr/simulate-sighting', json={
        "plate_number": "DL 99 ZZ 0001",
        "camera_id": "cam-01"
    })
    assert obs_res.status_code == 200
    obs_data = obs_res.json()
    assert obs_data['latitude'] == 28.6139, f"Expected 28.6139, got {obs_data['latitude']}"
    assert obs_data['longitude'] == 77.2090, f"Expected 77.2090, got {obs_data['longitude']}"
    print(f"PASS: Observation strictly inherited CAM-01 coordinates: ({obs_data['latitude']}, {obs_data['longitude']})")

    # 4. Alert Generation & Deduplication (Requirements 1, 2, 12)
    # A. Clean Plate DL 99 ZZ 0001 must NOT trigger Blacklist Alert
    prof_clean = client.get('/api/vehicles/DL 99 ZZ 0001/profile?mode=live').json()
    assert prof_clean['blacklist'] is None, "DL 99 ZZ 0001 must NOT have active blacklist"
    print("PASS: DL 99 ZZ 0001 is CLEAR (No Blacklist Alert)")

    # B. Blacklisted Plate DL 99 ZZ 0002 triggers Critical Alert on first detection
    obs_bl1 = client.post('/api/anpr/simulate-sighting', json={
        "plate_number": "DL 99 ZZ 0002",
        "camera_id": "cam-01"
    }).json()
    assert obs_bl1.get('alert_triggered') == 'BLACKLISTED_VEHICLE'
    alerts1 = client.get('/api/alerts?mode=live').json()
    bl_alerts1 = [a for a in alerts1 if a.get('plate_number') == 'DL 99 ZZ 0002']
    assert len(bl_alerts1) >= 1
    initial_alert_count = len(bl_alerts1)
    print(f"PASS: DL 99 ZZ 0002 generated Blacklist Alert (count={initial_alert_count})")

    # C. Deduplication check: Second detection within cooldown does NOT spawn duplicate alert
    obs_bl2 = client.post('/api/anpr/simulate-sighting', json={
        "plate_number": "DL 99 ZZ 0002",
        "camera_id": "cam-01"
    }).json()
    alerts2 = client.get('/api/alerts?mode=live').json()
    bl_alerts2 = [a for a in alerts2 if a.get('plate_number') == 'DL 99 ZZ 0002']
    assert len(bl_alerts2) == initial_alert_count, f"Expected {initial_alert_count} alerts after dedup, got {len(bl_alerts2)}"
    print("PASS: Alert Deduplication successfully suppressed duplicate alert during cooldown")

    # D. Challan Pending Plate HR 99 YY 0003 generates Challan Match
    prof_challan = client.get('/api/vehicles/HR 99 YY 0003/profile?mode=demo').json()
    assert len(prof_challan['violations']) >= 1
    assert any(v['status'] == 'PENDING' for v in prof_challan['violations'])
    print("PASS: HR 99 YY 0003 verified with PENDING traffic violation")

    # 5. Honest OCR Check: Blank/noise frame must return NO plates detected!
    blank_img = np.zeros((480, 640, 3), dtype=np.uint8)
    _, blank_buf = cv2.imencode('.jpg', blank_img)
    blank_res = client.post(
        '/api/anpr/process',
        files={'image': ('blank.jpg', io.BytesIO(blank_buf.tobytes()), 'image/jpeg')},
        data={'camera_id': 'cam-01'}
    ).json()
    assert len(blank_res['detections']) == 0
    print("PASS: Honest OCR correctly returns 0 detections on blank image (No plate detected)")

    # 6. Real Plate Frame Recognition
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.rectangle(img, (140, 200), (500, 280), (255, 255, 255), -1)
    cv2.putText(img, 'DL01AB1234', (160, 260), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 0, 0), 4)
    _, buf = cv2.imencode('.jpg', img)

    res_anpr = client.post(
        '/api/anpr/process',
        files={'image': ('frame.jpg', io.BytesIO(buf.tobytes()), 'image/jpeg')},
        data={'camera_id': 'cam-01'}
    )
    assert res_anpr.status_code == 200
    detections = res_anpr.json()['detections']
    assert len(detections) >= 1
    print(f"PASS: Plate recognized via character segmentation -> {detections[0]['plate_number']}")

    # 7. Demo Mode Trajectory Coordinates (Requirement 15)
    client.post('/api/demo/load')
    prof_traj = client.get('/api/vehicles/DL 99 ZZ 0002/profile?mode=demo').json()
    points = prof_traj['trajectory']['points']
    assert len(points) == 3
    assert points[0]['camera_code'] == 'CAM-01'
    assert points[1]['camera_code'] == 'CAM-02'
    assert points[2]['camera_code'] == 'CAM-04'
    assert points[0]['latitude'] == 28.6315
    assert points[1]['latitude'] == 28.5700
    assert points[2]['latitude'] == 28.6139
    print("PASS: Observed trajectory connects actual camera locations CAM-01 -> CAM-02 -> CAM-04")

    print("\nALL VERIFICATION TESTS FOR NAYAN PASSED 100%!")

if __name__ == "__main__":
    test_all()
