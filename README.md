# Intelligent Document Processing & Validation

Local web app: upload a PDF or image → classify → extract fields → validate → review → export JSON/CSV.

## Run

1. Put your OpenAI key in `.env` (copy from `.env.example` if needed):

```
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini
```

2. Start both servers:

```bash
chmod +x dev.sh
./dev.sh
```

3. Open [http://localhost:5173](http://localhost:5173).

Or start them separately:

```bash
# terminal 1
source .venv/bin/activate
cd backend && PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8000

# terminal 2
cd frontend && npm run dev
```

## What it does

- Inbox: drop invoices, receipts, contracts, IDs, or generic PDFs
- Extraction uses a vision model (`gpt-4o-mini` by default)
- Rule engine checks required fields, dates, totals, and confidence
- Review: preview, edit fields, save & validate, export, delete
- Home (`← Home`) leaves review without saving; after validate you get a confirmation plus `← Home`

## API

- `POST /api/documents` — upload
- `GET /api/documents` — list
- `GET /api/documents/{id}` — extraction + issues
- `PATCH /api/documents/{id}` — save edits and re-validate
- `DELETE /api/documents/{id}` — delete
- `GET /api/documents/{id}/export?format=json|csv`
