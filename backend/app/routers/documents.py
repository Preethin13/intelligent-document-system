from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal, get_db
from app.models import Document, Extraction, FieldOverride, ValidationRun, new_id
from app.pipeline import apply_edits_and_validate, process_document

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
}


class PatchBody(BaseModel):
    fields: dict[str, Any]


def _run_process(document_id: str) -> None:
    db = SessionLocal()
    try:
        process_document(db, document_id)
    finally:
        db.close()


def latest_extraction(db: Session, document_id: str) -> Extraction | None:
    return (
        db.query(Extraction)
        .filter(Extraction.document_id == document_id)
        .order_by(Extraction.created_at.desc())
        .first()
    )


def latest_validation(db: Session, document_id: str) -> ValidationRun | None:
    return (
        db.query(ValidationRun)
        .filter(ValidationRun.document_id == document_id)
        .order_by(ValidationRun.created_at.desc())
        .first()
    )


def latest_overrides(db: Session, document_id: str) -> dict | None:
    row = (
        db.query(FieldOverride)
        .filter(FieldOverride.document_id == document_id)
        .order_by(FieldOverride.created_at.desc())
        .first()
    )
    if not row:
        return None
    return json.loads(row.fields_json)


def current_fields(db: Session, document_id: str) -> dict:
    overrides = latest_overrides(db, document_id)
    if overrides is not None:
        return overrides
    ext = latest_extraction(db, document_id)
    if not ext:
        return {}
    return json.loads(ext.normalized_json)


def serialize_document(db: Session, doc: Document, detail: bool = False) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": doc.id,
        "filename": doc.filename,
        "mime": doc.mime,
        "doc_type": doc.doc_type,
        "status": doc.status,
        "error_message": doc.error_message,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }
    if not detail:
        return payload
    ext = latest_extraction(db, doc.id)
    val = latest_validation(db, doc.id)
    fields = current_fields(db, doc.id)
    payload["fields"] = fields
    payload["extraction"] = None
    if ext:
        payload["extraction"] = {
            "model": ext.model,
            "confidence": ext.confidence,
            "raw": json.loads(ext.raw_llm_json),
            "created_at": ext.created_at.isoformat() if ext.created_at else None,
        }
    payload["issues"] = json.loads(val.issues_json) if val else []
    payload["passed"] = val.passed if val else False
    payload["has_overrides"] = latest_overrides(db, doc.id) is not None
    return payload


@router.post("")
async def upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    mime = file.content_type or "application/octet-stream"
    suffix = ALLOWED.get(mime)
    name = file.filename or "upload"
    if suffix is None:
        lower = name.lower()
        if lower.endswith(".pdf"):
            mime, suffix = "application/pdf", ".pdf"
        elif lower.endswith(".png"):
            mime, suffix = "image/png", ".png"
        elif lower.endswith((".jpg", ".jpeg")):
            mime, suffix = "image/jpeg", ".jpg"
        elif lower.endswith(".webp"):
            mime, suffix = "image/webp", ".webp"
        else:
            raise HTTPException(400, "Upload a PDF or PNG/JPEG/WebP image")

    upload_root = Path(settings.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)

    doc_id = new_id()
    dest = upload_root / f"{doc_id}{suffix}"
    dest.write_bytes(await file.read())

    doc = Document(
        id=doc_id,
        filename=name,
        mime=mime,
        path=str(dest),
        status="uploaded",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    background_tasks.add_task(_run_process, doc.id)
    return serialize_document(db, doc)


@router.get("")
def list_documents(db: Session = Depends(get_db)):
    rows = db.query(Document).order_by(Document.created_at.desc()).all()
    return [serialize_document(db, d) for d in rows]


@router.get("/{document_id}")
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return serialize_document(db, doc, detail=True)


@router.get("/{document_id}/file")
def get_file(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc or not Path(doc.path).exists():
        raise HTTPException(404, "File not found")
    return FileResponse(doc.path, media_type=doc.mime, filename=doc.filename)


@router.patch("/{document_id}")
def patch_document(document_id: str, body: PatchBody, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status in ("uploaded", "processing"):
        raise HTTPException(409, "Document is still processing")
    updated = apply_edits_and_validate(db, document_id, body.fields)
    if not updated:
        raise HTTPException(400, "Cannot validate until extraction has a document type")
    return serialize_document(db, updated, detail=True)


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    path = Path(doc.path)
    db.delete(doc)
    db.commit()
    if path.exists() and path.is_file():
        path.unlink()
    return {"ok": True, "id": document_id}


@router.post("/{document_id}/reprocess")
def reprocess(document_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.status = "uploaded"
    doc.error_message = None
    db.commit()
    background_tasks.add_task(_run_process, doc.id)
    return serialize_document(db, doc)


@router.get("/{document_id}/export")
def export_document(
    document_id: str,
    format: str = Query("json", alias="format"),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    fields = current_fields(db, document_id)
    record = {
        "id": doc.id,
        "filename": doc.filename,
        "doc_type": doc.doc_type,
        "status": doc.status,
        "fields": fields,
    }
    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["field", "value"])
        writer.writerow(["id", doc.id])
        writer.writerow(["filename", doc.filename])
        writer.writerow(["doc_type", doc.doc_type or ""])
        writer.writerow(["status", doc.status])
        for key, value in fields.items():
            if key == "field_confidence":
                continue
            writer.writerow([key, json.dumps(value) if isinstance(value, (dict, list)) else value])
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{doc.id}.csv"'},
        )
    return Response(
        content=json.dumps(record, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{doc.id}.json"'},
    )
