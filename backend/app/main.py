from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import PROJECT_ROOT, settings
from app.db import Base, engine
from app.models import Document, Extraction, FieldOverride, ValidationRun  # noqa: F401
from app.routers.documents import router as documents_router

FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"


def _ensure_dirs() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if settings.database_url.startswith("sqlite:///"):
        raw = settings.database_url.replace("sqlite:///", "", 1)
        Path(raw).parent.mkdir(parents=True, exist_ok=True)


_ensure_dirs()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Intelligent Document Processing & Validation")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(documents_router)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "model": settings.openai_model,
        "has_api_key": bool(settings.openai_api_key),
    }


assets_dir = FRONTEND_DIST / "assets"
if assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/")
def spa_index():
    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise HTTPException(503, "Frontend is not built. Run npm run build in frontend/.")
    return FileResponse(index)


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(404, "Not found")
    candidate = FRONTEND_DIST / full_path
    if candidate.is_file():
        return FileResponse(candidate)
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(404, "Not found")
