# NAYAN — System Architecture & Technical Specifications

NAYAN is a high-performance, local-first Automatic Number Plate Recognition (ANPR) and city-wide vehicle movement intelligence platform designed for smart city command centers and modern intelligent transportation systems (ITS).

---

## 1. High-Level Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          OPERATOR BROWSER CLIENT                       │
│  React 18 + TypeScript + Vite + Tailwind CSS + Leaflet GIS + Recharts │
│                                                                        │
│  [Live ANPR Viewport]         [GIS Tactical Map]     [Realtime Alerts] │
│  navigator.mediaDevices       20 Delhi CCTV Nodes    Blacklist Matches │
│  .getUserMedia()              Trajectory Polyline    Speed Anomalies   │
└───────────────────▲──────────────────────────────────▲─────────────────┘
                    │                                  │
    HTTP / FormData │ (Multipart Canvas JPEG)          │ REST API / JSON
                    ▼                                  │
┌──────────────────────────────────────────────────────┴─────────────────┐
│                       FASTAPI AI & VISION SERVICE                      │
│                          (Python on localhost:8000)                    │
│                                                                        │
│  ┌────────────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │   OpenCV Preprocessor  │  │ Plate Detector │  │  Pluggable OCR   │  │
│  │ Bilateral / Blackhat   │─▶│ Aspect Ratio   │─▶│ Demo / PaddleOCR │  │
│  │ Adaptive Otsu Thresh   │  │ Contour Filter │  │ EasyOCR Adapter  │  │
│  └────────────────────────┘  └────────────────┘  └────────┬─────────┘  │
│                                                           │            │
│  ┌────────────────────────┐  ┌────────────────┐           ▼            │
│  │ Anomaly Detection      │  │ Haversine Path │  ┌──────────────────┐  │
│  │ IMPOSSIBLE_SPEED >120  │◀─│ Speed & Delta  │◀─│ Indian Plate Val │  │
│  │ SUSPICIOUS_ROUTE       │  │ Reconstruct    │  │ Confusion Matrix │  │
│  └────────────────────────┘  └────────────────┘  └──────────────────┘  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE POSTGRESQL CLUSTER                     │
│                                                                        │
│  • cameras (20 Delhi nodes)           • trajectories & points          │
│  • vehicles (200+ profiles)           • blacklist & alerts             │
│  • anpr_observations (5,000+ reads)   • traffic_events & audit_logs    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Computer Vision & ANPR Pipeline

The ANPR engine is designed to run efficiently on standard laptop CPUs without requiring dedicated GPUs.

### A. Preprocessing (`backend/app/anpr/preprocessor.py`)
1. **Grayscale Conversion**: Eliminates chrominance noise.
2. **Bilateral Filtering**: Smooths plate background noise while preserving sharp character contours:
   $$\text{BF}(I)_p = \frac{1}{W_p} \sum_{q \in S} G_{\sigma_s}(\|p - q\|) G_{\sigma_r}(|I_p - I_q|) I_q$$
3. **Morphological Filtering**: TopHat and BlackHat operations with a rectangular structuring element $(13 \times 5)$ emphasize embossed text against white/yellow plate backgrounds.
4. **Otsu Adaptive Binarization**: Computes optimal threshold minimizing intra-class variance.

### B. Plate Localization (`backend/app/anpr/plate_detector.py`)
- Finds external contours in Canny edge field.
- Filters candidate rectangles matching standard Indian High Security Registration Plate (HSRP) aspect ratios:
  $$2.0 \le \frac{\text{Width}}{\text{Height}} \le 5.5$$
- Adds 5% horizontal and 10% vertical padding to prevent glyph clipping.

### C. Pluggable OCR Architecture (`backend/app/anpr/ocr_service.py`)
NAYAN uses an abstract adapter pattern `OCRService`:
- **`DemoOCRAdapter`**: Built-in CPU heuristic engine. Requires no heavy deep learning libraries, runs instantaneously, and outputs clear `DEMO MODE` indicators.
- **`PaddleOCRAdapter`**: Plugin adapter connecting to Baidu PaddleOCR (PP-OCRv4). Automatically activates if `paddleocr` is installed.
- **`EasyOCRAdapter`**: Plugin adapter connecting to JaidedAI EasyOCR (CRAFT + CRNN). Automatically activates if `easyocr` is installed.
- **Graceful Fallback**: If an uninstalled engine is selected, the system notifies the operator without crashing.

### D. Indian License Plate Normalization (`backend/app/anpr/indian_plate_validator.py`)
Indian vehicle registrations follow standard MoRTH specifications:
- Standard format: `[State: 2 chars][RTO: 1-2 digits][Series: 1-3 chars][Number: 4 digits]` (e.g. `DL01AB1234`, `HR26DK4521`).
- Bharat (BH) series: `[Year: 2 digits][BH][Number: 4 digits][Series: 2 chars]` (e.g. `22BH1234AA`).
- **Positional Confusion Substitution**:
  - In state and series positions: maps ambiguous digits `0 -> O`, `1 -> I`, `8 -> B`, `5 -> S`, `2 -> Z`.
  - In RTO and registration number positions: maps ambiguous letters `O -> 0`, `I/L -> 1`, `B -> 8`, `S -> 5`, `Z -> 2`.

---

## 3. Movement Intelligence & Trajectory Reconstruction

### Haversine Distance Calculation
Distance between consecutive camera observations $(lat_1, lon_1)$ and $(lat_2, lon_2)$ is computed using the spherical Earth radius $R = 6371.0\text{ km}$:
$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$
$$d = 2R \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$

### Velocity & Anomaly Heuristics
Velocity along the corridor is derived from chronological time difference $\Delta t = t_2 - t_1$:
$$v = \frac{d}{\Delta t / 3600}\text{ (km/h)}$$

1. **`IMPOSSIBLE_SPEED`**:
   Triggered if $v > 120\text{ km/h}$ in urban traffic. Automatically logged as:
   > *"Potentially anomalous movement — requires review. Estimated speed $v$ km/h exceeds safety threshold."*
2. **`SUSPICIOUS_ROUTE`**:
   Triggered if distance jump exceeds $15\text{ km}$ in under $180\text{ seconds}$, indicating possible cloned registration plates or unsynchronized edge timestamps.

---

## 4. CCTV & RTSP Ingestion Architecture

While the client demonstration module utilizes browser webcams (`navigator.mediaDevices.getUserMedia`) for lightweight local testing and verification, the platform includes a production-ready RTSP streaming architecture:

```text
[ Physical RTSP / ONVIF Camera ]
               │
               ▼  RTSP H.264 Stream (rtsp://camera-ip:554/stream1)
[ Backend Ingestion Worker (FFmpeg / OpenCV VideoCapture) ]
               │
               ▼  Keyframe Decimation (5-10 FPS)
[ ModularANPRService ]
               │
               ▼  JSON Observation Records
[ Supabase PostgreSQL & Realtime Channel ]
               │
               ▼  WebSocket Push
[ Operator Command Center Dashboard ]
```

---

## 5. Security & Row Level Security (RLS)

- **Key Separation**:
  - `VITE_SUPABASE_ANON_KEY`: Safe for frontend exposure. Bound by RLS policies.
  - `SUPABASE_SERVICE_ROLE_KEY`: Restricted exclusively to the FastAPI backend environment. Never transmitted to the browser.
- **Audit Logging**: Every operator action (manual OCR plate corrections, blacklist additions, alert status modifications) is immutably recorded in `audit_logs` with timestamps and operator identity.
