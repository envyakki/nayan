import abc
import importlib
import logging
import string
from typing import Tuple, Dict, Any, Optional
import cv2
import numpy as np

logger = logging.getLogger("nayan.anpr")

class OCRService(abc.ABC):
    """Abstract interface for OCR engines."""

    @property
    @abc.abstractmethod
    def engine_name(self) -> str:
        pass

    @abc.abstractmethod
    def is_available(self) -> bool:
        """Returns True if the underlying model/dependencies are installed."""
        pass

    @abc.abstractmethod
    def read_text(self, image: np.ndarray) -> Tuple[str, float]:
        """
        Extract text from cropped plate image.
        Returns: (extracted_text, raw_confidence)
        """
        pass


class OpenCVHeuristicOCRAdapter(OCRService):
    """
    Honest, CPU-optimized character segmentation and template matching engine.
    Extracts real character contours from cropped plate image.
    Never invents or cycles fake plates. If no valid characters are present,
    returns ("", 0.0).
    """

    def __init__(self):
        self._init_templates()

    def _init_templates(self):
        """Pre-render tight-cropped 20x30 normalized templates for digits 0-9 and letters A-Z."""
        self.templates: Dict[str, np.ndarray] = {}
        chars = string.digits + string.ascii_uppercase
        for ch in chars:
            canvas = np.zeros((100, 80), dtype=np.uint8)
            cv2.putText(canvas, ch, (10, 75), cv2.FONT_HERSHEY_SIMPLEX, 2.2, 255, 4, cv2.LINE_AA)
            pts = cv2.findNonZero(canvas)
            if pts is not None:
                x, y, w, h = cv2.boundingRect(pts)
                cropped = canvas[y:y+h, x:x+w]
                self.templates[ch] = cv2.resize(cropped, (20, 30))
            else:
                self.templates[ch] = cv2.resize(canvas, (20, 30))

    @property
    def engine_name(self) -> str:
        return "OpenCV Character Vision"

    def is_available(self) -> bool:
        return True

    def read_text(self, image: np.ndarray) -> Tuple[str, float]:
        if image is None or image.size == 0:
            return "", 0.0

        h, w = image.shape[:2]
        if h < 15 or w < 30:
            return "", 0.0

        # 1. Grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # 2. Contrast Enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # 3. Adaptive & Otsu Thresholding to separate dark characters from light plate
        thresh1 = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)
        thresh2 = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 6)
        _, thresh3 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        best_text = ""
        best_conf = 0.0

        for thresh in [thresh1, thresh2, thresh3]:
            text, conf = self._extract_from_thresh(thresh, h, w)
            if len(text) > len(best_text) or (len(text) == len(best_text) and conf > best_conf):
                best_text = text
                best_conf = conf

        if len(best_text) >= 4 and best_conf >= 0.40:
            return best_text, round(best_conf, 2)

        return "", 0.0

    def _extract_from_thresh(self, thresh: np.ndarray, h: int, w: int) -> Tuple[str, float]:
        if np.mean(thresh) > 127:
            thresh = cv2.bitwise_not(thresh)

        contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        char_boxes = []
        for cnt in contours:
            x, y, cw, ch_h = cv2.boundingRect(cnt)
            aspect_ratio = cw / float(ch_h) if ch_h > 0 else 0
            height_ratio = ch_h / float(h)

            if 0.18 <= height_ratio <= 0.88 and 0.10 <= aspect_ratio <= 1.25 and ch_h >= 12:
                char_boxes.append((x, y, cw, ch_h))

        if len(char_boxes) < 4:
            return "", 0.0

        # Sort left to right
        char_boxes = sorted(char_boxes, key=lambda b: b[0])

        # Filter nested inner contours and duplicate boxes
        filtered_boxes = []
        for b in char_boxes:
            if not filtered_boxes:
                filtered_boxes.append(b)
            else:
                prev = filtered_boxes[-1]
                # If current box is nested inside prev box, ignore inner contour
                if b[0] >= prev[0] and (b[0] + b[2]) <= (prev[0] + prev[2]) and b[1] >= prev[1] and (b[1] + b[3]) <= (prev[1] + prev[3]):
                    continue
                # If prev box is nested inside current box, replace it
                if prev[0] >= b[0] and (prev[0] + prev[2]) <= (b[0] + b[2]) and prev[1] >= b[1] and (prev[1] + prev[3]) <= (b[1] + b[3]):
                    filtered_boxes[-1] = b
                    continue
                # Overlap filter
                if abs(b[0] - prev[0]) < 8:
                    if b[2] * b[3] > prev[2] * prev[3]:
                        filtered_boxes[-1] = b
                else:
                    filtered_boxes.append(b)

        if len(filtered_boxes) < 4:
            return "", 0.0

        # Match each character against templates
        recognized_chars = []
        confs = []

        for x, y, cw, ch_h in filtered_boxes[:14]:
            char_crop = thresh[y:y+ch_h, x:x+cw]
            if char_crop.size == 0:
                continue

            resized_char = cv2.resize(char_crop, (20, 30), interpolation=cv2.INTER_AREA)

            best_ch = ""
            best_score = -1.0

            for ch, tpl in self.templates.items():
                res = cv2.matchTemplate(resized_char, tpl, cv2.TM_CCOEFF_NORMED)
                score = float(res[0][0]) if res.size > 0 else 0.0
                if score > best_score:
                    best_score = score
                    best_ch = ch

            if best_score > 0.40 and best_ch:
                recognized_chars.append(best_ch)
                confs.append(best_score)

        if len(recognized_chars) >= 4:
            avg_conf = sum(confs) / len(confs)
            return "".join(recognized_chars), avg_conf

        return "", 0.0


# Backward compatibility alias
DemoOCRAdapter = OpenCVHeuristicOCRAdapter


class PaddleOCRAdapter(OCRService):
    """Adapter for PaddleOCR when installed."""

    def __init__(self):
        self._ocr_instance = None

    @property
    def engine_name(self) -> str:
        return "PaddleOCR"

    def is_available(self) -> bool:
        try:
            importlib.import_module("paddleocr")
            return True
        except ImportError:
            return False

    def read_text(self, image: np.ndarray) -> Tuple[str, float]:
        if not self.is_available():
            raise RuntimeError("Selected OCR engine (PaddleOCR) is not installed.")
        
        try:
            if self._ocr_instance is None:
                from paddleocr import PaddleOCR
                self._ocr_instance = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            
            result = self._ocr_instance.ocr(image, cls=True)
            if not result or not result[0]:
                return "", 0.0
            
            texts = []
            confs = []
            for line in result[0]:
                text, conf = line[1]
                texts.append(text)
                confs.append(conf)
            
            full_text = "".join(texts)
            avg_conf = sum(confs) / len(confs) if confs else 0.0
            return full_text, avg_conf
        except Exception as e:
            logger.error(f"Error in PaddleOCR inference: {e}")
            return "", 0.0


class EasyOCRAdapter(OCRService):
    """Adapter for EasyOCR when installed."""

    def __init__(self):
        self._reader = None

    @property
    def engine_name(self) -> str:
        return "EasyOCR"

    def is_available(self) -> bool:
        try:
            importlib.import_module("easyocr")
            return True
        except ImportError:
            return False

    def read_text(self, image: np.ndarray) -> Tuple[str, float]:
        if not self.is_available():
            raise RuntimeError("Selected OCR engine (EasyOCR) is not installed.")

        try:
            if self._reader is None:
                import easyocr
                self._reader = easyocr.Reader(['en'], gpu=False)
            
            results = self._reader.readtext(image)
            if not results:
                return "", 0.0
            
            texts = []
            confs = []
            for bbox, text, conf in results:
                texts.append(text)
                confs.append(float(conf))
            
            full_text = "".join(texts)
            avg_conf = sum(confs) / len(confs) if confs else 0.0
            return full_text, avg_conf
        except Exception as e:
            logger.error(f"Error in EasyOCR inference: {e}")
            return "", 0.0


def get_ocr_adapter(engine_name: str) -> OCRService:
    """Factory function for OCR engines with graceful fallback."""
    engine_name = (engine_name or "demo").lower()
    if "paddle" in engine_name:
        adapter = PaddleOCRAdapter()
        if adapter.is_available():
            return adapter
        logger.warning("PaddleOCR requested but not installed. Falling back to OpenCV character engine.")
    elif "easy" in engine_name:
        adapter = EasyOCRAdapter()
        if adapter.is_available():
            return adapter
        logger.warning("EasyOCR requested but not installed. Falling back to OpenCV character engine.")
    
    return OpenCVHeuristicOCRAdapter()
