import type { DocumentDetail, DocumentListItem, Health } from './types'

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') return data.detail
    return JSON.stringify(data.detail ?? data)
  } catch {
    return res.statusText
  }
}

export async function getHealth(): Promise<Health> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  const res = await fetch('/api/documents')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const res = await fetch(`/api/documents/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function uploadDocument(file: File): Promise<DocumentListItem> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/documents', { method: 'POST', body })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function patchDocument(id: string, fields: Record<string, unknown>): Promise<DocumentDetail> {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function reprocessDocument(id: string): Promise<DocumentListItem> {
  const res = await fetch(`/api/documents/${id}/reprocess`, { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export function exportUrl(id: string, format: 'json' | 'csv'): string {
  return `/api/documents/${id}/export?format=${format}`
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export function fileUrl(id: string): string {
  return `/api/documents/${id}/file`
}
