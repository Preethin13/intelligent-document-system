import type { DocStatus, DocType } from '../types'

const statusClass: Record<DocStatus, string> = {
  uploaded: 'bg-slate-700 text-slate-100',
  processing: 'bg-sky-900 text-sky-100',
  needs_review: 'bg-amber-900 text-amber-100',
  valid: 'bg-emerald-900 text-emerald-100',
  failed: 'bg-rose-900 text-rose-100',
}

const typeLabel: Record<DocType, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  contract: 'Contract',
  id_document: 'ID',
  generic: 'Generic',
}

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusClass[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export function TypeBadge({ type }: { type: DocType | null }) {
  if (!type) return <span className="text-slate-500">—</span>
  return <span className="text-slate-200">{typeLabel[type]}</span>
}
