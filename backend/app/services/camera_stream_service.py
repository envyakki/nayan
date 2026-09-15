import logging
from typing import Dict, Any, Optional
from app.models.schemas import StreamType

logger = logging.getLogger("nayan.stream")

class CameraStreamService:
    """
    Manages CCTV and RTSP ingestion pipelines.
    Architecture:
      RTSP Camera -> Backend / OpenCV / FFmpeg -> Frame extraction -> ANPR Pipeline -> Supabase
    """

    @staticmethod
    def get_stream_config(camera: Dict[str, Any]) -> Dict[str, Any]:
        stream_type = camera.get("stream_type", StreamType.DEMO)
        stream_url = camera.get("stream_url")

        if stream_type == StreamType.WEBCAM:
            return {
                "type": "WEBCAM",
                "client_accessible": True,
                "notes": "Streams directly via browser navigator.mediaDevices.getUserMedia()"
            }
        elif stream_type == StreamType.RTSP:
            return {
                "type": "RTSP",
                "client_accessible": False,
                "stream_url": stream_url,
                "backend_ingestion": "OpenCV VideoCapture / FFmpeg worker",
                "notes": "Backend decodes RTSP frames asynchronously and forwards ANPR observations."
            }
        else:
            return {
                "type": "DEMO",
                "client_accessible": True,
                "notes": "Simulated edge CCTV node generating telemetry events."
            }

    @staticmethod
    def test_rtsp_connection(rtsp_url: str) -> bool:
        """
        Attempts to open an RTSP stream using OpenCV for diagnostic health check.
        """
        if not rtsp_url:
            return False
        try:
            import cv2
            cap = cv2.VideoCapture(rtsp_url)
            success = cap.isOpened()
            cap.release()
            return success
        except Exception as e:
            logger.warning(f"RTSP probe failed for {rtsp_url}: {e}")
            return False
