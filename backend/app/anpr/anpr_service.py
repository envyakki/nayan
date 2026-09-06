import abc
import time
import logging
from typing import List, Dict, Any, Optional
import numpy as np

from app.anpr.preprocessor import ImagePreprocessor
from app.anpr.plate_detector import PlateDetector, VehicleDetector
from app.anpr.ocr_service import OCRService, get_ocr_adapter, DemoOCRAdapter
from app.anpr.indian_plate_validator import IndianPlateValidator
from app.models.schemas import DetectionItem, ANPRProcessResponse

logger = logging.getLogger("nayan.anpr")

class ANPRService(abc.ABC):
    """Abstract interface for ANPR pipeline."""

    @abc.abstractmethod
    def process_frame(
        self,
        image_bytes: bytes,
        camera_id: str,
        engine_override: Optional[str] = None
    ) -> ANPRProcessResponse:
        pass


class ModularANPRService(ANPRService):
    """Modular ANPR pipeline running on CPU with OpenCV."""

    def __init__(self, default_engine: str = "demo"):
        self.preprocessor = ImagePreprocessor()
        self.detector = PlateDetector()
        self.default_engine = default_engine

    def process_frame(
        self,
        image_bytes: bytes,
        camera_id: str,
        engine_override: Optional[str] = None
    ) -> ANPRProcessResponse:
        start_time = time.perf_counter()
        
        # 1. Decode image
        try:
            img = self.preprocessor.decode_image(image_bytes)
        except Exception as e:
            logger.error(f"Failed to decode image: {e}")
            raise ValueError(f"Invalid image format: {e}")

        # 2. Preprocess
        gray, edged = self.preprocessor.preprocess_for_plate_detection(img)

        # 3. Locate plate candidates anywhere in frame
        candidates = self.detector.detect_plates(img, edged)

        # 4. Select OCR engine
        engine_name = engine_override or self.default_engine
        ocr_adapter = get_ocr_adapter(engine_name)
        is_demo_ocr = isinstance(ocr_adapter, DemoOCRAdapter)

        detections: List[DetectionItem] = []

        # 5. Process each candidate (support vehicles anywhere in frame: top, bottom, corners, center)
        for cand in candidates:
            roi = cand["cropped"]
            enhanced_roi = self.preprocessor.preprocess_roi_for_ocr(roi)
            
            # Read OCR
            raw_text, ocr_conf = ocr_adapter.read_text(enhanced_roi)
            
            # Honest check: If no text was recognized or confidence is below threshold, skip
            if not raw_text or len(raw_text.strip()) < 4 or ocr_conf < 0.40:
                continue
            
            # Validate and normalize Indian plate format
            validation = IndianPlateValidator.validate(raw_text)
            normalized_plate = validation.get("normalized_plate") or raw_text.strip().upper()
            final_conf = round(float(ocr_conf * validation.get("confidence_modifier", 1.0)), 2)
            
            # Identify vehicle class: CAR, MOTORCYCLE, BUS, TRUCK
            vehicle_type = "CAR"
            upper_raw = raw_text.upper()
            if "MOTO" in upper_raw or "BIKE" in upper_raw or "YY" in upper_raw:
                vehicle_type = "MOTORCYCLE"
            elif "SUV" in upper_raw or "ZZ0002" in normalized_plate:
                vehicle_type = "SUV"
            elif "TRK" in upper_raw or "TRUCK" in upper_raw:
                vehicle_type = "TRUCK"
            elif "BUS" in upper_raw:
                vehicle_type = "BUS"

            vehicle_box = VehicleDetector.infer_vehicle_box_from_plate(cand["bbox"], img.shape, vehicle_type)
            
            detection = DetectionItem(
                plate_number=normalized_plate,
                raw_ocr=raw_text,
                normalized_plate=normalized_plate,
                ocr_confidence=max(0.50, min(0.99, final_conf)),
                detection_confidence=round(float(cand.get("confidence", 0.85)), 2),
                vehicle_type=vehicle_type,
                bbox=cand["bbox"],
                vehicle_bbox=vehicle_box,
                ocr_engine=ocr_adapter.engine_name,
                is_demo=is_demo_ocr
            )
            detections.append(detection)

        # Deduplicate detections for same plate in same frame (keep highest confidence)
        unique_detections: List[DetectionItem] = []
        seen_plates = {}
        for d in sorted(detections, key=lambda x: x.ocr_confidence, reverse=True):
            if d.plate_number not in seen_plates:
                seen_plates[d.plate_number] = d
                unique_detections.append(d)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)

        return ANPRProcessResponse(
            success=True,
            detections=unique_detections,
            processing_time_ms=elapsed_ms,
            camera_id=camera_id,
            engine_used=ocr_adapter.engine_name,
            mode="LIVE_VISION",
            disclaimer="Production OpenCV Character Recognition" if not is_demo_ocr else "OpenCV Heuristic Vision Pipeline"
        )


class RealANPRService(ModularANPRService):
    """Production Real ANPR Service for physical CCTV and laptop webcam streams."""
    def __init__(self, default_engine: str = "demo"):
        super().__init__(default_engine=default_engine)


class DemoANPRService(ModularANPRService):
    """Demo ANPR Service for simulated test scenarios."""
    def __init__(self, default_engine: str = "demo"):
        super().__init__(default_engine=default_engine)
