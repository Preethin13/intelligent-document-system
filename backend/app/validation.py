from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from app.config import settings

RULES_DIR = Path(__file__).resolve().parent / "schemas"


class Issue(dict):
    def __init__(self, field: str, severity: str, code: str, message: str):
        super().__init__(field=field, severity=severity, code=code, message=message)


def _load_rules(doc_type: str) -> dict[str, Any]:
    path = RULES_DIR / f"{doc_type}.rules.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def _get(data: dict[str, Any], field: str) -> Any:
    parts = field.split(".")
    cur: Any = data
    for p in parts:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt, length in (
        ("%Y-%m-%dT%H:%M:%S", 19),
        ("%Y-%m-%dT%H:%M", 16),
        ("%Y-%m-%d", 10),
        ("%Y/%m/%d", 10),
        ("%d/%m/%Y", 10),
        ("%m/%d/%Y", 10),
    ):
        try:
            return datetime.strptime(text[:length], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def validate_record(
    doc_type: str,
    data: dict[str, Any],
    field_confidence: dict[str, float] | None = None,
) -> list[Issue]:
    rules = _load_rules(doc_type)
    issues: list[Issue] = []
    confidence = field_confidence or data.get("field_confidence") or {}

    for field in rules.get("required", []):
        if _is_empty(_get(data, field)):
            issues.append(Issue(field, "error", "required", f"{field} is required"))

    for field in rules.get("date_fields", []):
        value = _get(data, field)
        if _is_empty(value):
            continue
        if _parse_date(value) is None:
            issues.append(Issue(field, "error", "date_format", f"{field} is not a recognizable date"))

    for pair in rules.get("date_order", []):
        if len(pair) != 2:
            continue
        a, b = pair
        da, db = _parse_date(_get(data, a)), _parse_date(_get(data, b))
        if da and db and db < da:
            issues.append(Issue(b, "error", "date_order", f"{b} must be on or after {a}"))

    today = date.today()
    for field in rules.get("expiry_future", []):
        d = _parse_date(_get(data, field))
        if d and d < today:
            issues.append(Issue(field, "warning", "expired", f"{field} is in the past"))

    currency = _get(data, rules.get("currency_field", "")) if rules.get("currency_field") else None
    if rules.get("currency_field") and currency:
        if not re.fullmatch(r"[A-Z]{3}", str(currency).strip()):
            issues.append(
                Issue(rules["currency_field"], "warning", "currency", "Currency should be a 3-letter ISO code (e.g. USD)")
            )

    for field in rules.get("non_negative", []):
        num = _as_float(_get(data, field))
        if num is not None and num < 0:
            issues.append(Issue(field, "error", "non_negative", f"{field} cannot be negative"))

    totals = rules.get("totals")
    if totals:
        parts = [_as_float(_get(data, f)) for f in totals.get("parts", [])]
        total = _as_float(_get(data, totals.get("total", "total")))
        if total is not None and all(p is not None for p in parts):
            expected = sum(parts)  # type: ignore[arg-type]
            tol = float(totals.get("tolerance", 0.05))
            if abs(expected - total) > tol:
                issues.append(
                    Issue(
                        totals.get("total", "total"),
                        "error",
                        "totals_mismatch",
                        f"subtotal + tax ({expected:.2f}) does not match total ({total:.2f})",
                    )
                )

    for spec in rules.get("min_array_length", []):
        field = spec["field"]
        value = _get(data, field)
        min_len = spec.get("min", 1)
        if not isinstance(value, list) or len(value) < min_len:
            issues.append(Issue(field, "error", "min_length", spec.get("message", f"{field} is too short")))

    for spec in rules.get("patterns", []):
        when = spec.get("when") or {}
        skip = False
        for k, v in when.items():
            if _get(data, k) != v:
                skip = True
                break
        if skip:
            continue
        field = spec["field"]
        value = _get(data, field)
        if _is_empty(value):
            continue
        if not re.fullmatch(spec["regex"], str(value).strip(), flags=re.IGNORECASE):
            issues.append(Issue(field, "warning", "pattern", spec.get("message", f"{field} has an unexpected format")))

    threshold = settings.confidence_threshold
    for field in rules.get("confidence_fields", []):
        conf = confidence.get(field)
        if conf is not None and conf < threshold and not _is_empty(_get(data, field)):
            issues.append(
                Issue(
                    field,
                    "warning",
                    "low_confidence",
                    f"{field} confidence {conf:.2f} is below {threshold:.2f}",
                )
            )

    return issues


def has_errors(issues: list[Issue]) -> bool:
    return any(i["severity"] == "error" for i in issues)
