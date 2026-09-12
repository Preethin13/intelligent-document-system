from app.validation import has_errors, validate_record


def test_invoice_totals_and_required():
    issues = validate_record(
        "invoice",
        {
            "vendor_name": "Acme",
            "invoice_number": "INV-1",
            "invoice_date": "2026-01-01",
            "due_date": "2025-01-01",
            "currency": "USD",
            "subtotal": 100,
            "tax": 10,
            "total": 50,
        },
    )
    codes = {i["code"] for i in issues}
    assert "totals_mismatch" in codes
    assert "date_order" in codes
    assert has_errors(issues)


def test_invoice_valid():
    issues = validate_record(
        "invoice",
        {
            "vendor_name": "Acme",
            "invoice_number": "INV-1",
            "invoice_date": "2026-01-01",
            "due_date": "2026-01-31",
            "currency": "USD",
            "subtotal": 100,
            "tax": 10,
            "total": 110,
        },
        {"vendor_name": 0.9, "invoice_number": 0.9, "invoice_date": 0.9, "total": 0.9},
    )
    assert not has_errors(issues)


def test_contract_parties():
    issues = validate_record(
        "contract",
        {"title": "MSA", "effective_date": "2026-01-01", "parties": [{"name": "A"}]},
    )
    assert any(i["code"] == "min_length" for i in issues)
