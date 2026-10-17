import asyncio
import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse

from app.models.schemas import InvestigationRequest, InvestigationResult
from app.services.tinyfish_service import tinyfish_service
from app.services.supabase_service import supabase_service
from app.services.vehicle_resolver import resolve_vehicle_rc_profile
from app.tracking.trajectory_service import TrajectoryService
from app.config import settings

logger = logging.getLogger("nayan.api.investigation")

router = APIRouter(prefix="/investigation", tags=["Vehicle Investigation Intelligence"])

# In-memory investigation storage with Supabase fallback
_investigations_cache: Dict[str, InvestigationResult] = {}
_investigation_events_queues: Dict[str, asyncio.Queue] = {}

@router.post("/start", response_model=InvestigationResult)
async def start_investigation(
    req: InvestigationRequest,
    background_tasks: BackgroundTasks
):
    """
    Initiates a TinyFish-powered Multi-Source Vehicle Investigation across
    Parivahan eChallan, Parivahan Analytics, Delhi Police, and Public Web Intelligence.
    """
    norm_plate = req.plate_number.replace(" ", "").upper()
    logger.info(f"Starting investigation for plate {norm_plate} from {req.start_date} to {req.end_date}")

    # 1. Retrieve full vehicle context and resolve complete RTO RC details
    v_profile = supabase_service.get_vehicle_profile(norm_plate)
    base_context = None
    if v_profile and v_profile.get("owner") and v_profile.get("owner", {}).get("owner_name") != "Registered Citizen":
        base_context = {
            "vehicle": v_profile.get("vehicle", {}),
            "owner": v_profile.get("owner", {}),
            "has_alert": len(v_profile.get("alerts", [])) > 0,
            "alert_severity": v_profile.get("alerts", [{}])[0].get("severity") if v_profile.get("alerts") else None,
            "observations_count": len(v_profile.get("observations", [])),
        }
    vehicle_context = await asyncio.to_thread(resolve_vehicle_rc_profile, norm_plate, base_context)
    # 2. Retrieve Nayan Trajectory Data
    observations = supabase_service.get_observations(plate=norm_plate, limit=100, mode="all")
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
    traj_dict = trajectory.dict() if hasattr(trajectory, "dict") else (trajectory.model_dump() if hasattr(trajectory, "model_dump") else {})

    # 3. Create Event Queue for SSE Streaming
    event_queue: asyncio.Queue = asyncio.Queue()

    def progress_callback(step_id: str, label: str, status: str):
        try:
            event_queue.put_nowait({
                "step_id": step_id,
                "label": label,
                "status": status
            })
        except Exception:
            pass

    # 4. Execute Multi-Source Investigation
    try:
        result = tinyfish_service.execute_investigation(
            request=req,
            vehicle_context=vehicle_context,
            trajectory_data=traj_dict,
            progress_callback=progress_callback
        )
        _investigations_cache[result.investigation_id] = result
        _investigation_events_queues[result.investigation_id] = event_queue
        return result
    except Exception as e:
        logger.error(f"Investigation execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Investigation failed: {str(e)}")

@router.get("/history", response_model=List[InvestigationResult])
def list_investigation_history(
    plate: Optional[str] = Query(None, description="Optional plate filter")
):
    """
    Lists recent vehicle investigations.
    """
    results = list(_investigations_cache.values())
    if plate:
        norm = plate.replace(" ", "").upper()
        results = [r for r in results if r.plate_number == norm]
    results.sort(key=lambda x: x.created_at, reverse=True)
    return results

@router.get("/{investigation_id}", response_model=InvestigationResult)
def get_investigation(investigation_id: str):
    """
    Returns full investigation report dossier by ID.
    """
    if investigation_id in _investigations_cache:
        return _investigations_cache[investigation_id]
    raise HTTPException(status_code=404, detail=f"Investigation {investigation_id} not found")

@router.get("/{investigation_id}/stream")
async def stream_investigation_activity(investigation_id: str):
    """
    Server-Sent Events (SSE) endpoint streaming real-time TinyFish agent progression.
    """
    if investigation_id not in _investigations_cache:
        raise HTTPException(status_code=404, detail=f"Investigation {investigation_id} not found")

    result = _investigations_cache[investigation_id]

    async def event_generator():
        # Stream the steps from activity log
        for step in result.agent_activity_log:
            data = json.dumps({
                "step_id": step.id,
                "label": step.label,
                "status": step.status,
                "detail": step.detail,
                "timestamp": step.timestamp.isoformat() if step.timestamp else None
            })
            yield f"data: {data}\n\n"
            await asyncio.sleep(0.3)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
