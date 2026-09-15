from fastapi import APIRouter, HTTPException
from typing import List
from app.models.schemas import BlacklistSchema, BlacklistCreateRequest, AlertSchema
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/blacklist", tags=["Blacklist"])

@router.get("", response_model=List[BlacklistSchema])
def list_blacklist(mode: str = "live"):
    return supabase_service.get_blacklist(mode=mode)

@router.post("", response_model=BlacklistSchema)
def add_to_blacklist(req: BlacklistCreateRequest):
    entry = supabase_service.add_blacklist(
        plate=req.plate_number,
        reason=req.reason,
        severity=req.severity.value
    )
    return entry

@router.delete("/{plate}")
def delete_from_blacklist(plate: str):
    success = supabase_service.remove_blacklist(plate)
    return {"success": success, "plate": plate.upper(), "message": "Vehicle removed from active blacklist"}

@router.post("/{plate}/simulate-hit", response_model=AlertSchema)
def simulate_blacklist_hit(plate: str):
    """
    Simulate an instant camera hit for a blacklisted vehicle.
    Demonstration helper to test automated alert generation.
    """
    norm = plate.replace(" ", "").upper()
    entry = supabase_service.get_blacklist_entry(norm)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Plate {norm} is not in active blacklist")
    
    # Record observation at Camera C-001
    obs = supabase_service.record_observation({
        "plate_number": norm,
        "camera_id": "a0000000-0000-0000-0000-000000000001",
        "camera_code": "C-001",
        "camera_name": "Connaught Place Outer Circle",
        "latitude": 28.6315,
        "longitude": 77.2167,
        "vehicle_type": "sedan",
        "ocr_confidence": 0.98,
        "detection_confidence": 0.96,
        "processing_time_ms": 25.0,
        "is_corrected": False
    })
    
    # Return newest alert
    alerts = supabase_service.get_alerts()
    for a in alerts:
        if a.get("plate_number") == norm and a.get("alert_type") == "BLACKLIST_MATCH":
            return a
            
    raise HTTPException(status_code=500, detail="Failed to retrieve generated alert")
