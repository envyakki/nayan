# NAYAN — Setup & Demonstration Guide

This guide walks through configuring and launching NAYAN locally on a Windows machine.

---

## 1. Prerequisites

Ensure you have installed:
- **Python 3.10+** (verified with Python 3.13)
- **Node.js 18+** & **npm 9+** (verified with Node v24, npm 11)
- Modern web browser (Chrome, Edge, Firefox) with camera permissions enabled

---

## 2. Backend Setup (FastAPI + OpenCV)

Open PowerShell and navigate to the backend directory:

```powershell
cd backend

# 1. Create Python virtual environment
python -m venv .venv

# 2. Activate virtual environment
.\.venv\Scripts\activate

# 3. Install requirements
pip install -r requirements.txt

# 4. Seed demo data (20 Delhi cameras, 200+ vehicles, 5,000+ observations)
python scripts\seed_demo_data.py

# 5. Start FastAPI server on port 8000
uvicorn app.main:app --reload --port 8000
```

FastAPI will start at `http://localhost:8000`.
Interactive Swagger API documentation is available at `http://localhost:8000/docs`.

---

## 3. Frontend Setup (React + TypeScript + Vite)

Open a second PowerShell terminal:

```powershell
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

Vite will serve the frontend at `http://localhost:5173`.

---

## 4. Supabase Database Configuration

NAYAN works out of the box with an automated local deterministic data provider. When you are ready to link a live cloud Supabase database:

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste the contents of `supabase/migrations/20260904_initial_schema.sql` and run it.
4. Optional: Run `supabase/seed.sql` to populate initial demo data directly in PostgreSQL.
5. In your project root `.env`:
   ```env
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   SUPABASE_URL=https://<your-project-id>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```
6. Restart FastAPI and Vite. The status badges in the UI will display **SUPABASE CLUSTER CONNECTED**.

---

## 5. Official 18-Step Demonstration Script

Follow these steps for a complete live system demonstration:

| Step | Action | Expected Result |
|---|---|---|
| **1** | Open `http://localhost:5173` | Command Center Overview loads in dark cyber theme. |
| **2** | Review Dashboard Cards | Displays 20 cameras, 2,824 vehicles, 5,000+ reads, active alerts. |
| **3** | Click **Live ANPR Camera** in sidebar | Live ANPR module opens. |
| **4** | Click **START CAMERA** | Browser triggers camera permission popup. |
| **5** | Grant permission | Real webcam video feed displays with live FPS and inference telemetry. |
| **6** | Click **SCAN FRAME** | Canvas captures frame and sends to `POST /api/anpr/process`. |
| **7** | Review ANPR Result | Bounding box draws over plate area with recognized normalized plate and confidence score. |
| **8** | Click **Manual Correction** | Operator modal opens, edit `DL01A81234` → `DL01AB1234`, click **Save Correction**. Stored to Supabase with `is_corrected=true` and audit logged. |
| **9** | Open **Vehicle Search** | Search for `DL01AB1234` to view sighting profile. |
| **10** | Click **Reconstruct Trajectory** | Navigates to Trajectory page for `DL01AB1234`. |
| **11** | Inspect Route | Leaflet GIS map draws connected corridor between 5 sequential Delhi cameras (Akshardham → ITO → India Gate → AIIMS → Dhaula Kuan). |
| **12** | Click **PLAY** | Vehicle marker animates along corridor with speed multiplier (0.5x–5x). |
| **13** | Search `DL03CA7788` | Speed anomaly banner flags `IMPOSSIBLE_SPEED: 182.4 km/h`. |
| **14** | Open **Traffic Analytics** | View hourly volume trends, vehicle type breakdown, and Origin-Destination (OD) table. |
| **15** | Open **Security Alerts** | View active critical alerts including `BLACKLIST_MATCH` and `CAMERA_OFFLINE`. |
| **16** | Open **Blacklist Watch** | Click **Add Vehicle to Blacklist**, enter plate `DL09XY1111` with reason "Stolen Vehicle". |
| **17** | Click **Simulate Hit** | Automated camera sighting fires instant `CRITICAL` toast alert and registers on dashboard. |
| **18** | Click **Acknowledge** | Alert moves to acknowledged status in Supabase. |
