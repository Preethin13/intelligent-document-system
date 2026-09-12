from __future__ import annotations

import base64
import json
import re
from typing import Any

from openai import OpenAI

from app.config import settings
from app.schemas import DocumentType, json_schema_for, model_for

CLASSIFY_TYPES = [t.value for t in DocumentType]


def _client() -> OpenAI:
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    return OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)


def _image_parts(images: list[bytes]) -> list[dict[str, Any]]:
    parts = []
    for raw in images:
        b64 = base64.b64encode(raw).decode("ascii")
        parts.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"},
            }
        )
    return parts


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        data = json.loads(text[start : end + 1])
        if isinstance(data, dict):
            return data
    raise ValueError("Model did not return valid JSON")


def classify_document(images: list[bytes]) -> str:
    client = _client()
    prompt = (
        "Classify this document. Return JSON only: "
        '{"doc_type": one of '
        + json.dumps(CLASSIFY_TYPES)
        + ', "confidence": number 0-1}. '
        "Use invoice for bills from vendors, receipt for consumer/till receipts, "
        "contract for agreements, id_document for passports/licenses/IDs, "
        "generic otherwise."
    )
    resp = client.chat.completions.create(
        model=settings.openai_model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}, *_image_parts(images[:1])],
            }
        ],
    )
    content = resp.choices[0].message.content or "{}"
    data = _parse_json(content)
    doc_type = str(data.get("doc_type", "generic"))
    if doc_type not in CLASSIFY_TYPES:
        return DocumentType.generic.value
    return doc_type


def extract_document(doc_type: str, images: list[bytes]) -> tuple[dict[str, Any], dict[str, Any], float | None]:
    client = _client()
    schema = json_schema_for(doc_type)
    prompt = (
        f"Extract a {doc_type} from the document image(s). "
        "Return a single JSON object matching this schema. "
        "Use ISO dates (YYYY-MM-DD) when possible, ISO currency codes, and numbers not strings. "
        "For missing values use null. "
        "Include field_confidence as a map of field name to 0-1 confidence for top-level fields.\n\n"
        f"JSON schema:\n{json.dumps(schema)}"
    )
    resp = client.chat.completions.create(
        model=settings.openai_model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}, *_image_parts(images)],
            }
        ],
    )
    raw = _parse_json(resp.choices[0].message.content or "{}")
    if doc_type == DocumentType.id_document.value and isinstance(raw.get("id_type"), str):
        lowered = raw["id_type"].strip().lower()
        raw["id_type"] = lowered if lowered in ("passport", "license", "other") else "other"
    model_cls = model_for(doc_type)
    normalized = model_cls.model_validate(raw).model_dump(mode="json")
    confidences = normalized.get("field_confidence") or {}
    overall = None
    if isinstance(confidences, dict) and confidences:
        vals = [float(v) for v in confidences.values() if isinstance(v, (int, float))]
        if vals:
            overall = sum(vals) / len(vals)
    return raw, normalized, overall
