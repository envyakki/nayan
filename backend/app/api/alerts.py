from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import AlertSchema, AlertUpdateRequest
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertSchema])
def list_alerts(
    status: Optional[str] = Query(None, description="ACTIVE, ACKNOWLEDGED, or RESOLVED"),
    severity: Optional[str] = Query(None, description="CRITICAL, HIGH, MEDIUM, LOW"),
    mode: str = Query("live", description="live, demo, or all")
):
    alerts = supabase_service.get_alerts(status=status, severity=severity, mode=mode)
    return alerts

@router.patch("/{id}", response_model=AlertSchema)
def update_alert_status(id: str, req: AlertUpdateRequest):
    updated = supabase_service.update_alert(id, req.status.value)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Alert {id} not found")
    return updated
