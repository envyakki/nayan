import math
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from app.models.schemas import TrajectoryResponse, TrajectoryPointSchema

class TrajectoryService:
    """Calculates distances, speeds, and chronological transitions along camera networks."""

    EARTH_RADIUS_KM = 6371.0
    MAX_SPEED_THRESHOLD_KMH = 120.0

    @classmethod
    def haversine_distance_km(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate the great-circle distance between two geographic coordinates in km."""
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return cls.EARTH_RADIUS_KM * c

    @classmethod
    def build_trajectory(
        cls,
        plate_number: str,
        observations: List[Dict[str, Any]],
        cameras_map: Dict[str, Dict[str, Any]],
        max_speed_threshold: float = 120.0
    ) -> TrajectoryResponse:
        """
        Reconstruct vehicle trajectory chronologically.
        Computes consecutive distances, time deltas, speeds, and flags anomalies.
        """
        if not observations:
            return TrajectoryResponse(
                plate_number=plate_number,
                total_observations=0,
                total_distance_km=0.0,
                average_speed_kmh=0.0,
                anomaly_detected=False,
                points=[]
            )

        # Sort observations chronologically
        sorted_obs = sorted(
            observations,
            key=lambda x: x["timestamp"] if isinstance(x["timestamp"], datetime) else datetime.fromisoformat(str(x["timestamp"]).replace("Z", "+00:00"))
        )

        points: List[TrajectoryPointSchema] = []
        total_distance = 0.0
        total_time_hours = 0.0
        anomaly_detected = False
        anomaly_reasons: List[str] = []

        prev_point = None

        for idx, obs in enumerate(sorted_obs):
            cam_id = obs.get("camera_id", "")
            cam_info = cameras_map.get(cam_id, {})
            cam_code = cam_info.get("camera_code", obs.get("camera_code", f"C-0{idx+1}"))
            cam_name = cam_info.get("name", obs.get("camera_name", "Traffic Camera"))

            lat = float(obs.get("latitude") or cam_info.get("latitude", 28.6139))
            lon = float(obs.get("longitude") or cam_info.get("longitude", 77.2090))
            
            ts = obs["timestamp"]
            if not isinstance(ts, datetime):
                ts = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))

            dist_from_prev = 0.0
            time_delta_sec = 0.0
            speed_kmh = 0.0
            anomaly_flag = None

            if prev_point is not None:
                dist_from_prev = cls.haversine_distance_km(
                    prev_point["lat"], prev_point["lon"], lat, lon
                )
                time_delta_sec = max(1.0, (ts - prev_point["ts"]).total_seconds())
                time_hours = time_delta_sec / 3600.0
                speed_kmh = round(dist_from_prev / time_hours, 1)

                total_distance += dist_from_prev
                total_time_hours += time_hours

                # Check for IMPOSSIBLE_SPEED anomaly (> threshold, e.g. 120 km/h)
                if speed_kmh > max_speed_threshold:
                    anomaly_flag = f"IMPOSSIBLE_SPEED: {speed_kmh} km/h (Limit: {max_speed_threshold} km/h)"
                    anomaly_detected = True
                    anomaly_reasons.append(
                        f"Potentially anomalous movement — requires review. Estimated speed {speed_kmh} km/h between {prev_point['cam_code']} and {cam_code}."
                    )
                # Check for physically improbable jump (e.g. >15km in under 3 mins)
                elif dist_from_prev > 15.0 and time_delta_sec < 180:
                    anomaly_flag = "SUSPICIOUS_ROUTE: Improbable distance jump"
                    anomaly_detected = True
                    anomaly_reasons.append(
                        f"Suspicious route jump: {dist_from_prev:.1f} km traversed in {int(time_delta_sec)}s between {prev_point['cam_code']} and {cam_code}."
                    )

            point_schema = TrajectoryPointSchema(
                sequence_number=idx + 1,
                camera_id=cam_id,
                camera_code=cam_code,
                camera_name=cam_name,
                timestamp=ts,
                latitude=lat,
                longitude=lon,
                distance_from_prev_km=round(dist_from_prev, 2),
                time_delta_seconds=round(time_delta_sec, 1),
                estimated_speed_kmh=speed_kmh,
                anomaly=anomaly_flag
            )
            points.append(point_schema)

            prev_point = {
                "lat": lat,
                "lon": lon,
                "ts": ts,
                "cam_code": cam_code
            }

        avg_speed = round(total_distance / total_time_hours, 1) if total_time_hours > 0 else 0.0

        return TrajectoryResponse(
            plate_number=plate_number,
            total_observations=len(points),
            start_time=points[0].timestamp if points else None,
            end_time=points[-1].timestamp if points else None,
            total_distance_km=round(total_distance, 2),
            average_speed_kmh=avg_speed,
            anomaly_detected=anomaly_detected,
            anomaly_reason=" | ".join(anomaly_reasons) if anomaly_reasons else None,
            points=points
        )
