import cv2
import numpy as np
from typing import List, Tuple, Dict, Any

class VehicleDetector:
    """
    Vehicle detector supporting primary classes: CAR, MOTORCYCLE, BUS, TRUCK.
    Identifies vehicles anywhere inside the frame (top-left, top-right, bottom-left, bottom-right, center).
    """

    @staticmethod
    def infer_vehicle_box_from_plate(plate_bbox: List[int], img_shape: Tuple[int, int], vehicle_type: str = "CAR") -> List[int]:
        h, w = img_shape[:2]
        px1, py1, px2, py2 = plate_bbox
        pw = max(10, px2 - px1)
        ph = max(5, py2 - py1)

        v_type = vehicle_type.upper()
        if v_type == "MOTORCYCLE":
            vx1 = max(0, px1 - int(pw * 0.9))
            vy1 = max(0, py1 - int(ph * 3.2))
            vx2 = min(w, px2 + int(pw * 0.9))
            vy2 = min(h, py2 + int(ph * 1.8))
        elif v_type in ["BUS", "TRUCK"]:
            vx1 = max(0, px1 - int(pw * 2.2))
            vy1 = max(0, py1 - int(ph * 6.5))
            vx2 = min(w, px2 + int(pw * 2.2))
            vy2 = min(h, py2 + int(ph * 2.2))
        else:  # CAR or SUV
            vx1 = max(0, px1 - int(pw * 1.6))
            vy1 = max(0, py1 - int(ph * 4.8))
            vx2 = min(w, px2 + int(pw * 1.6))
            vy2 = min(h, py2 + int(ph * 1.6))

        return [vx1, vy1, vx2, vy2]


class PlateDetector:
    """Plate localization using OpenCV contour, aspect-ratio, and heuristic analysis."""

    def __init__(self, min_ratio: float = 1.4, max_ratio: float = 7.0, min_area_ratio: float = 0.002):
        self.min_ratio = min_ratio
        self.max_ratio = max_ratio
        self.min_area_ratio = min_area_ratio

    @staticmethod
    def _compute_iou(boxA: List[int], boxB: List[int]) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = max(1, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
        boxBArea = max(1, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

        iou = interArea / float(boxAArea + boxBArea - interArea)
        return iou

    def detect_plates(self, img: np.ndarray, edged: np.ndarray) -> List[Dict[str, Any]]:
        """
        Locate license plate candidates in the image.
        Returns list of dicts with:
        - bbox: [x1, y1, x2, y2]
        - cropped: np.ndarray (plate ROI)
        - confidence: float
        """
        h, w = img.shape[:2]
        total_area = h * w
        raw_candidates = []

        # Find contours
        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:35]

        for cnt in contours:
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
            
            x, y, bw, bh = cv2.boundingRect(approx)
            area = bw * bh
            aspect_ratio = bw / float(bh) if bh > 0 else 0

            if self.min_ratio <= aspect_ratio <= self.max_ratio and (area / total_area) >= self.min_area_ratio:
                pad_x = int(bw * 0.06)
                pad_y = int(bh * 0.12)
                x1 = max(0, x - pad_x)
                y1 = max(0, y - pad_y)
                x2 = min(w, x + bw + pad_x)
                y2 = min(h, y + bh + pad_y)
                
                cropped = img[y1:y2, x1:x2]
                if cropped.size > 0:
                    raw_candidates.append({
                        "bbox": [x1, y1, x2, y2],
                        "cropped": cropped,
                        "confidence": 0.88 + min(0.1, (area / total_area) * 0.2)
                    })

        # NMS Deduplication: filter overlapping candidates
        nms_candidates: List[Dict[str, Any]] = []
        for cand in sorted(raw_candidates, key=lambda c: c["confidence"], reverse=True):
            overlap = False
            for kept in nms_candidates:
                if self._compute_iou(cand["bbox"], kept["bbox"]) > 0.35:
                    overlap = True
                    break
            if not overlap:
                nms_candidates.append(cand)

        # Center reticle ROI fallback / auxiliary:
        # Matches the viewfinder alignment box on the mobile camera screen
        cx1 = int(w * 0.15)
        cy1 = int(h * 0.25)
        cx2 = int(w * 0.85)
        cy2 = int(h * 0.75)
        center_crop = img[cy1:cy2, cx1:cx2]
        
        # If no strong candidate found, use center crop
        if not nms_candidates:
            nms_candidates.append({
                "bbox": [cx1, cy1, cx2, cy2],
                "cropped": center_crop,
                "confidence": 0.78
            })
        elif len(nms_candidates) < 3:
            # Also append center crop as secondary candidate if not heavily overlapping
            if not any(self._compute_iou([cx1, cy1, cx2, cy2], c["bbox"]) > 0.5 for c in nms_candidates):
                nms_candidates.append({
                    "bbox": [cx1, cy1, cx2, cy2],
                    "cropped": center_crop,
                    "confidence": 0.72
                })

        return nms_candidates[:3]
