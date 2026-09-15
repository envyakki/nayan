from fastapi import APIRouter
from typing import List
from app.models.schemas import TrafficSummaryResponse, HeatmapPoint, ODRoute
from app.analytics.traffic_analytics import TrafficAnalyticsService

router = APIRouter(prefix="/traffic", tags=["Traffic"])

@router.get("/summary", response_model=TrafficSummaryResponse)
def get_traffic_summary(mode: str = "live"):
    return TrafficAnalyticsService.get_summary(mode=mode)

@router.get("/heatmap", response_model=List[HeatmapPoint])
def get_traffic_heatmap():
    return TrafficAnalyticsService.get_heatmap_points()

@router.get("/od", response_model=List[ODRoute])
def get_traffic_od():
    return TrafficAnalyticsService.get_od_routes()
