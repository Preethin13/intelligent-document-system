from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Document, Extraction, FieldOverride, ValidationRun, utcnow
from app.services.llm import classify_document, extract_document
from app.services.pdf import document_to_images
from app.validation import has_errors, validate_record


def process_document(db: Session, document_id: str) -> None:
    doc = db.get(Document, document_id)
    if not doc:
        return
    doc.status = "processing"
    doc.error_message = None
    db.commit()
    try:
        images = document_to_images(doc.path, doc.mime)
        if not images:
            raise RuntimeError("Could not render any pages from this file")
        doc_type = classify_document(images)
        raw, normalized, overall = extract_document(doc_type, images)
        extraction = Extraction(
            document_id=doc.id,
            raw_llm_json=json.dumps(raw),
            normalized_json=json.dumps(normalized),
            model=settings.openai_model,
            confidence=overall,
        )
        db.add(extraction)

        issues = validate_record(doc_type, normalized, normalized.get("field_confidence") or {})
        run = ValidationRun(
            document_id=doc.id,
            passed=not has_errors(issues),
            issues_json=json.dumps(issues),
        )
        db.add(run)
        doc.doc_type = doc_type
        doc.status = "valid" if run.passed else "needs_review"
        doc.updated_at = utcnow()
        db.commit()
    except Exception as exc:  # noqa: BLE001 — persist failure for the UI
        db.rollback()
        doc = db.get(Document, document_id)
        if doc:
            doc.status = "failed"
            doc.error_message = str(exc)
            doc.updated_at = utcnow()
            db.commit()


def apply_edits_and_validate(db: Session, document_id: str, fields: dict) -> Document | None:
    doc = db.get(Document, document_id)
    if not doc:
        return None
    if not doc.doc_type:
        return None
    override = FieldOverride(document_id=doc.id, fields_json=json.dumps(fields))
    db.add(override)
    confidence = fields.get("field_confidence") or {}
    issues = validate_record(doc.doc_type, fields, confidence)
    run = ValidationRun(
        document_id=doc.id,
        passed=not has_errors(issues),
        issues_json=json.dumps(issues),
    )
    db.add(run)
    doc.status = "valid" if run.passed else "needs_review"
    doc.error_message = None
    doc.updated_at = utcnow()
    db.commit()
    db.refresh(doc)
    return doc
