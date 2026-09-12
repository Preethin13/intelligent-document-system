export type DocType = 'invoice' | 'receipt' | 'contract' | 'id_document' | 'generic'

export type DocStatus = 'uploaded' | 'processing' | 'needs_review' | 'valid' | 'failed'

export type Issue = {
  field: string
  severity: 'error' | 'warning'
  code: string
  message: string
}

export type DocumentListItem = {
  id: string
  filename: string
  mime: string
  doc_type: DocType | null
  status: DocStatus
  error_message: string | null
  created_at: string | null
  updated_at: string | null
}

export type DocumentDetail = DocumentListItem & {
  fields: Record<string, unknown>
  extraction: {
    model: string
    confidence: number | null
    raw: unknown
    created_at: string | null
  } | null
  issues: Issue[]
  passed: boolean
  has_overrides: boolean
}

export type Health = {
  ok: boolean
  model: string
  has_api_key: boolean
}
