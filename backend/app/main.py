from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api.health import router as health_router
from app.api.cameras import router as cameras_router
from app.api.vehicles import router as vehicles_router
from app.api.anpr import router as anpr_router, observations_router
from app.api.traffic import router as traffic_router
from app.api.alerts import router as alerts_router
from app.api.blacklist import router as blacklist_router
from app.api.demo import router as demo_router
from app.api.investigation import router as investigation_router
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nayan.main")

app = FastAPI(
    title="NAYAN — Networked AI for Yield & ANPR Navigation",
    description="Enterprise Multi-Camera Automatic Number Plate Recognition and vehicle movement intelligence platform.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api
app.include_router(health_router, prefix="/api")
app.include_router(cameras_router, prefix="/api")
app.include_router(vehicles_router, prefix="/api")
app.include_router(anpr_router, prefix="/api")
app.include_router(observations_router, prefix="/api")
app.include_router(traffic_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(blacklist_router, prefix="/api")
app.include_router(demo_router, prefix="/api")
app.include_router(investigation_router, prefix="/api")

@app.get("/")
def root():
    return {
        "platform": "NAYAN — Networked AI for Yield & ANPR Navigation",
        "short_name": "NAYAN",
        "tagline": "Networked AI for Yield & ANPR Navigation",
        "status": "ONLINE",
        "docs": "/docs",
        "mode": "DEMO" if settings.DEMO_MODE else "LIVE"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
