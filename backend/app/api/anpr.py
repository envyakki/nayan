from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
import time
from app.models.schemas import (
    ANPRProcessResponse, 
    ANPRCorrectionRequest, 
    ANPRObservationSchema, 
    SimulateObservationRequest
)
from app.anpr.anpr_service import ModularANPRService
from app.services.supabase_service import supabase_service
from app.config import settings

router = APIRouter(prefix="/anpr", tags=["ANPR"])

anpr_engine = ModularANPRService(default_engine=settings.ANPR_OCR_ENGINE)

@router.post("/process", response_model=ANPRProcessResponse)
async def process_frame(
    image: UploadFile = File(..., description="Camera snapshot JPEG/PNG"),
    camera_id: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_accuracy: Optional[float] = Form(None),
    engine: Optional[str] = Form(None)
):
    """
    Process incoming frame from mobile phone camera, desktop webcam, or CCTV RTSP feed.
    Performs plate localization, honest character recognition, validation,
    deduplication, and updates Supabase.
    """
    try:
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        cam_id = camera_id or "LOCAL_WEBCAM"
        response = anpr_engine.process_frame(
            image_bytes=contents,
            camera_id=cam_id,
            engine_override=engine or settings.ANPR_OCR_ENGINE
        )

        # Lookup camera if registered
        cam = supabase_service.get_camera(cam_id) if camera_id else None
        cam_code = cam.get("camera_code") if cam else (camera_id or "LIVE-CAM")
        cam_name = cam.get("name") if cam else "Live Camera Node"

        # Determine true coordinates
        obs_lat = latitude if latitude is not None else (cam.get("latitude") if cam else None)
        obs_lon = longitude if longitude is not None else (cam.get("longitude") if cam else None)
        obs_acc = location_accuracy if location_accuracy is not None else (cam.get("location_accuracy") if cam else None)

        # Update mobile camera location if fresh GPS provided
        if cam and cam.get("camera_type") == "MOBILE" and latitude is not None and longitude is not None:
            cam["latitude"] = latitude
            cam["longitude"] = longitude
            cam["location_accuracy"] = location_accuracy

        # Record all detected plates independently
        for det in response.detections:
            obs = supabase_service.record_observation({
                "plate_number": det.plate_number,
                "camera_id": cam.get("id") if cam else cam_id,
                "camera_code": cam_code,
                "camera_name": cam_name,
                "latitude": obs_lat,
                "longitude": obs_lon,
                "location_accuracy": obs_acc,
                "vehicle_type": det.vehicle_type,
                "ocr_confidence": det.ocr_confidence,
                "detection_confidence": det.detection_confidence,
                "processing_time_ms": response.processing_time_ms,
                "is_corrected": False,
                "data_source": "REAL"
            })
            if obs.get("alert_triggered"):
                det.alert_triggered = obs["alert_triggered"]
            if obs.get("estimated_speed_kmh"):
                det.speed_estimate_kmh = obs["estimated_speed_kmh"]

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ANPR processing error: {str(e)}")

@router.post("/correct")
def correct_plate(req: ANPRCorrectionRequest):
    """
    Operator manual plate correction endpoint.
    Updates observation, flags is_corrected=true, and creates an audit log in Supabase.
    """
    if not req.corrected_plate:
        raise HTTPException(status_code=400, detail="Corrected plate number is required")

    result = supabase_service.correct_observation(
        original_plate=req.original_plate,
        corrected_plate=req.corrected_plate,
        observation_id=req.observation_id
    )
    return result

@router.post("/simulate-sighting", response_model=ANPRObservationSchema)
def simulate_sighting(req: SimulateObservationRequest):
    """
    Operator simulation endpoint for manual triggering of ANPR sightings on a camera node.
    """
    cam = supabase_service.get_camera(req.camera_id) if req.camera_id else None
    if not cam:
        cams = supabase_service.get_cameras(mode="live") or supabase_service.get_cameras(mode="demo")
        cam = cams[0] if cams else None

    cam_id = cam.get("id") if cam else (req.camera_id or "SIM-CAM")
    cam_code = cam.get("camera_code") if cam else "C-SIM"
    cam_name = cam.get("name") if cam else "Simulated Node"
    lat = cam.get("latitude", 28.6139) if cam else 28.6139
    lon = cam.get("longitude", 77.2090) if cam else 77.2090

    obs = supabase_service.record_observation({
        "plate_number": req.plate_number.upper(),
        "camera_id": cam_id,
        "camera_code": cam_code,
        "camera_name": cam_name,
        "latitude": lat,
        "longitude": lon,
        "location_accuracy": 4.0,
        "vehicle_type": "car",
        "ocr_confidence": 0.96,
        "detection_confidence": 0.98,
        "processing_time_ms": 42.0,
        "is_corrected": False,
        "data_source": "REAL"
    })
    return obs

# Secondary router for /observations
observations_router = APIRouter(prefix="/observations", tags=["Observations"])

@observations_router.get("", response_model=List[ANPRObservationSchema])
def list_observations(
    plate: Optional[str] = None, 
    limit: int = 50,
    mode: str = "live"
):
    obs = supabase_service.get_observations(plate=plate, limit=limit, mode=mode)
    return obs
