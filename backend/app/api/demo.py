from fastapi import APIRouter
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/demo", tags=["Demo Management"])

@router.post("/load")
def load_demo_data():
    """Explicitly seeds demo vehicles, trajectories, and alerts."""
    result = supabase_service.load_demo_dataset()
    return result

@router.post("/clear")
def clear_demo_data():
    """Clears only DEMO records while strictly preserving real webcam sightings."""
    result = supabase_service.clear_demo_dataset()
    return result

@router.get("/status")
def get_demo_status():
    real_v = len([v for v in supabase_service.vehicles.values() if v.get("data_source") == "REAL"])
    demo_v = len([v for v in supabase_service.vehicles.values() if v.get("data_source") == "DEMO"])
    real_o = len([o for o in supabase_service.observations if o.get("data_source") == "REAL"])
    demo_o = len([o for o in supabase_service.observations if o.get("data_source") == "DEMO"])
    real_a = len([a for a in supabase_service.alerts if a.get("data_source") == "REAL"])
    demo_a = len([a for a in supabase_service.alerts if a.get("data_source") == "DEMO"])

    return {
        "real_vehicles": real_v,
        "demo_vehicles": demo_v,
        "real_observations": real_o,
        "demo_observations": demo_o,
        "real_alerts": real_a,
        "demo_alerts": demo_a,
        "is_demo_loaded": demo_v > 0
    }
