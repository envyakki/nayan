from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict
from app.models.schemas import (
    CameraSchema, 
    CameraHeartbeatRequest,
    CameraRegistrationRequest,
    CameraLocationUpdateRequest
)
from app.services.supabase_service import supabase_service
from app.services.camera_stream_service import CameraStreamService

router = APIRouter(prefix="/cameras", tags=["Cameras"])

@router.get("", response_model=List[CameraSchema])
def list_cameras(mode: str = Query("live")):
    """List registered camera nodes (filtered by mode: 'live' or 'demo')."""
    cams = supabase_service.get_cameras(mode=mode)
    return cams

@router.get("/summary")
def get_camera_summary(mode: str = Query("live")):
    """Get online, offline, degraded, and total camera counts."""
    return supabase_service.get_camera_summary(mode=mode)

@router.post("/heartbeat")
def camera_heartbeat(req: CameraHeartbeatRequest):
    """Heartbeat endpoint for laptop webcam or physical camera node."""
    cam = supabase_service.update_camera_heartbeat(
        camera_id=req.camera_id,
        latitude=req.latitude,
        longitude=req.longitude,
        status=req.status or "ONLINE"
    )
    if not cam:
        # Auto-register camera if webcam node
        cam = supabase_service.register_camera(
            name=f"Webcam ({req.camera_id})",
            source_type="LAPTOP_WEBCAM",
            location_name="Operator Command Station",
            latitude=req.latitude or 28.6139,
            longitude=req.longitude or 77.2090
        )
    return cam

@router.post("/register", response_model=CameraSchema)
def register_camera(req: CameraRegistrationRequest):
    """Operator registration of permanent CCTV, IP Camera, or Laptop Webcam."""
    cam = supabase_service.register_camera(
        name=req.name,
        source_type=req.source_type or "LAPTOP_WEBCAM",
        camera_type=req.camera_type or "CCTV",
        location_name=req.location_name,
        latitude=req.latitude,
        longitude=req.longitude,
        stream_type=req.stream_type,
        stream_url=req.stream_url,
        location_source=req.location_source or "REAL"
    )
    return cam

@router.get("/{camera_id}", response_model=CameraSchema)
def get_camera(camera_id: str):
    cam = supabase_service.get_camera(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return cam

@router.patch("/{camera_id}/status")
def update_camera_status(camera_id: str, status: str = Query(..., pattern="^(ONLINE|OFFLINE|MAINTENANCE)$")):
    cam = supabase_service.update_camera_status(camera_id, status)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    # If camera set to OFFLINE, trigger CAMERA_OFFLINE alert
    if status == "OFFLINE":
        supabase_service.create_alert({
            "alert_type": "CAMERA_OFFLINE",
            "severity": "MEDIUM",
            "plate_number": None,
            "camera_id": cam["id"],
            "camera_code": cam.get("camera_code"),
            "camera_name": cam.get("name"),
            "description": f"Camera {cam.get('camera_code')} ({cam.get('name')}) has transitioned to OFFLINE.",
            "risk_score": 60,
            "status": "ACTIVE",
            "data_source": cam.get("data_source", "REAL")
        })
    return cam

@router.patch("/{camera_id}/location", response_model=CameraSchema)
def update_camera_location(camera_id: str, req: CameraLocationUpdateRequest):
    cam = supabase_service.update_camera_location(
        camera_id=camera_id,
        location_name=req.location_name,
        latitude=req.latitude,
        longitude=req.longitude,
        location_source=req.location_source or "MANUAL"
    )
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return cam

@router.get("/{camera_id}/stream-config")
def get_stream_config(camera_id: str):
    cam = supabase_service.get_camera(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return CameraStreamService.get_stream_config(cam)
