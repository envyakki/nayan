import cv2
import numpy as np
from typing import Tuple

class ImagePreprocessor:
    """OpenCV preprocessing pipeline for ANPR on CPU."""

    @staticmethod
    def decode_image(image_bytes: bytes) -> np.ndarray:
        """Decode raw image bytes to BGR OpenCV image."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image bytes")
        return img

    @staticmethod
    def preprocess_for_plate_detection(img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Convert to grayscale, apply bilateral filtering and Sobel edge detection."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Bilateral filter reduces noise while preserving sharp plate edges
        blurred = cv2.bilateralFilter(gray, d=11, sigmaColor=17, sigmaSpace=17)
        
        # Blackhat or Sobel edge detection to highlight dark characters on light plate or vice-versa
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5))
        tophat = cv2.morphologyEx(blurred, cv2.MORPH_TOPHAT, kernel)
        blackhat = cv2.morphologyEx(blurred, cv2.MORPH_BLACKHAT, kernel)
        
        # Combine morphology
        enhanced = cv2.add(gray, tophat)
        enhanced = cv2.subtract(enhanced, blackhat)
        
        # Edge detection with Canny
        edged = cv2.Canny(enhanced, 30, 200)
        return gray, edged

    @staticmethod
    def preprocess_roi_for_ocr(roi: np.ndarray) -> np.ndarray:
        """Enhance cropped plate Region of Interest (ROI) for OCR clarity."""
        if len(roi.shape) == 3:
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        else:
            gray = roi

        # Normalize size for character analysis
        h, w = gray.shape[:2]
        target_h = 64
        scale = target_h / max(h, 1)
        target_w = int(w * scale)
        resized = cv2.resize(gray, (max(target_w, 64), target_h), interpolation=cv2.INTER_CUBIC)

        # Contrast Limited Adaptive Histogram Equalization (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast = clahe.apply(resized)
        return contrast
