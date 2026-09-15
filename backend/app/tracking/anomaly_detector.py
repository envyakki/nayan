from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from app.tracking.trajectory_service import TrajectoryService

class AnomalyDetector:
    """Rule-based anomaly detection engine for traffic tracking."""

    MAX_REASONABLE_SPEED_KMH = 120.0

    @classmethod
    def evaluate_transition(
        cls,
        last_obs: Dict[str, Any],
        new_obs: Dict[str, Any],
        max_speed: float = 120.0
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluate consecutive sightings for impossible speed or suspicious jumps.
        Returns alert payload dict if anomaly detected, else None.
        """
        if not last_obs or not new_obs:
            return None

        lat1 = float(last_obs.get("latitude", 0))
        lon1 = float(last_obs.get("longitude", 0))
        lat2 = float(new_obs.get("latitude", 0))
        lon2 = float(new_obs.get("longitude", 0))

        if lat1 == 0 or lon1 == 0 or lat2 == 0 or lon2 == 0:
            return None

        ts1 = last_obs.get("timestamp")
        ts2 = new_obs.get("timestamp")
        if not isinstance(ts1, datetime):
            ts1 = datetime.fromisoformat(str(ts1).replace("Z", "+00:00"))
        if not isinstance(ts2, datetime):
            ts2 = datetime.fromisoformat(str(ts2).replace("Z", "+00:00"))

        time_delta_sec = max(1.0, (ts2 - ts1).total_seconds())
        dist_km = TrajectoryService.haversine_distance_km(lat1, lon1, lat2, lon2)
        speed_kmh = round(dist_km / (time_delta_sec / 3600.0), 1)

        plate = new_obs.get("plate_number", "UNKNOWN")
        cam_id = new_obs.get("camera_id")

        if speed_kmh > max_speed:
            return {
                "alert_type": "IMPOSSIBLE_SPEED",
                "severity": "HIGH",
                "plate_number": plate,
                "camera_id": cam_id,
                "description": (
                    f"Potentially anomalous movement — requires review. Estimated speed {speed_kmh} km/h "
                    f"({dist_km:.1f} km in {int(time_delta_sec)}s) exceeds safety threshold of {max_speed} km/h."
                ),
                "risk_score": min(95, int(50 + (speed_kmh - max_speed) * 0.8)),
                "status": "ACTIVE"
            }

        if dist_km > 15.0 and time_delta_sec < 180:
            return {
                "alert_type": "SUSPICIOUS_ROUTE",
                "severity": "MEDIUM",
                "plate_number": plate,
                "camera_id": cam_id,
                "description": (
                    f"Physically improbable corridor transition: {dist_km:.1f} km jumped in {int(time_delta_sec)}s. "
                    "Possible cloned plate or timing discrepancy."
                ),
                "risk_score": 75,
                "status": "ACTIVE"
            }

        return None
