from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import VehicleSchema, TrajectoryResponse, VehicleDetailProfileResponse
from app.services.supabase_service import supabase_service
from app.tracking.trajectory_service import TrajectoryService
from app.config import settings

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

@router.get("", response_model=List[VehicleSchema])
def list_vehicles(
    query: Optional[str] = Query(None, description="Partial or exact plate number"),
    mode: str = Query("live", description="live, demo, or all")
):
    vehicles = supabase_service.get_vehicles(query=query, mode=mode)
    alerts = supabase_service.get_alerts(status="ACTIVE", mode=mode)
    alert_plates = {a.get("plate_number"): a.get("severity") for a in alerts if a.get("plate_number")}

    results = []
    for v in vehicles:
        plate = v["plate_number"]
        has_alert = plate in alert_plates
        alert_sev = alert_plates.get(plate)
        results.append(VehicleSchema(
            id=v.get("id", plate),
            plate_number=plate,
            vehicle_type=v.get("vehicle_type", "car"),
            first_seen=v.get("first_seen"),
            last_seen=v.get("last_seen"),
            observation_count=v.get("observation_count", 1),
            cameras_visited=v.get("cameras_visited", 1),
            average_speed_kmh=v.get("average_speed_kmh", 42.0),
            has_alert=has_alert,
            alert_severity=alert_sev
        ))
    return results

@router.get("/{plate}/profile", response_model=VehicleDetailProfileResponse)
def get_vehicle_profile(plate: str, mode: str = Query("live", description="live, demo, or all")):
    """
    Returns full investigation profile: registered owner, violations/challans, 
    blacklist entry, ANPR observations, observed camera-to-camera trajectory, and alerts.
    """
    profile = supabase_service.get_vehicle_profile(plate=plate, mode=mode)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Vehicle profile for {plate} not found")
    return profile

@router.get("/{plate}", response_model=VehicleSchema)
def get_vehicle(plate: str):
    v = supabase_service.get_vehicle(plate)
    if not v:
        profile = supabase_service.get_vehicle_profile(plate)
        if profile and profile.get("vehicle"):
            v = profile["vehicle"]
        else:
            raise HTTPException(status_code=404, detail=f"Vehicle with plate {plate} not found")
    
    alerts = supabase_service.get_alerts(status="ACTIVE")
    alert_plates = {a.get("plate_number"): a.get("severity") for a in alerts if a.get("plate_number")}
    norm = v["plate_number"]
    return VehicleSchema(
        id=v.get("id", norm),
        plate_number=norm,
        vehicle_type=v.get("vehicle_type", "car"),
        vehicle_class=v.get("vehicle_class", "Private Car"),
        color=v.get("color", "White"),
        registration_status=v.get("registration_status", "ACTIVE"),
        registration_date=v.get("registration_date"),
        registration_valid_until=v.get("registration_valid_until"),
        first_seen=v.get("first_seen"),
        last_seen=v.get("last_seen"),
        observation_count=v.get("observation_count", 1),
        cameras_visited=v.get("cameras_visited", 1),
        average_speed_kmh=v.get("average_speed_kmh", 42.0),
        has_alert=norm in alert_plates,
        alert_severity=alert_plates.get(norm),
        data_source=v.get("data_source", "REAL")
    )

@router.get("/{plate}/trajectory", response_model=TrajectoryResponse)
def get_vehicle_trajectory(plate: str):
    norm_plate = plate.replace(" ", "").upper()
    observations = supabase_service.get_observations(plate=norm_plate, limit=100, mode="all")
    
    # Retrieve camera coordinate lookup
    cams = supabase_service.get_cameras()
    cams_map = {c["id"]: c for c in cams}
    for c in cams:
        if "camera_code" in c:
            cams_map[c["camera_code"]] = c

    trajectory = TrajectoryService.build_trajectory(
        plate_number=norm_plate,
        observations=observations,
        cameras_map=cams_map,
        max_speed_threshold=settings.MAX_REASONABLE_SPEED_KMH
    )
    return trajectory
