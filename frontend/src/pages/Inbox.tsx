import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { deleteDocument, fileUrl, getHealth, listDocuments, uploadDocument } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Dropzone } from '../components/Dropzone'
import { StatusBadge, TypeBadge } from '../components/StatusBadge'
import type { DocumentListItem, DocStatus, DocType, Health } from '../types'

const FILTERS: Array<{ id: 'all' | DocType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'receipt', label: 'Receipts' },
  { id: 'contract', label: 'Contracts' },
  { id: 'id_document', label: 'IDs' },
  { id: 'generic', label: 'Generic' },
]

export function Inbox() {
  const navigate = useNavigate()
  const location = useLocation()
  const [docs, setDocs] = useState<DocumentListItem[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [filter, setFilter] = useState<'all' | DocType>('all')
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    const [list, h] = await Promise.all([listDocuments(), getHealth()])
    setDocs(list)
    setHealth(h)
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)))
    const t = setInterval(() => {
      refresh().catch(() => undefined)
    }, 2500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const msg = (location.state as { flash?: string } | null)?.flash
    if (!msg) return
    setFlash(msg)
    navigate('.', { replace: true, state: {} })
  }, [location.state, navigate])

  const visible = useMemo(
    () => (filter === 'all' ? docs : docs.filter((d) => d.doc_type === filter)),
    [docs, filter],
  )

  const counts = useMemo(() => {
    const tally = { all: docs.length, valid: 0, needs_review: 0, failed: 0, processing: 0 }
    for (const d of docs) {
      if (d.status === 'valid') tally.valid += 1
      else if (d.status === 'needs_review') tally.needs_review += 1
      else if (d.status === 'failed') tally.failed += 1
      else tally.processing += 1
    }
    return tally
  }, [docs])

  async function onFiles(files: File[]) {
    setBusy(true)
    setError(null)
    try {
      const uploaded: DocumentListItem[] = []
      for (const file of files) {
        uploaded.push(await uploadDocument(file))
      }
      await refresh()
      if (uploaded.length === 1) navigate(`/documents/${uploaded[0].id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteDocument(pendingDelete.id)
      setPendingDelete(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="h-full overflow-auto">
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Document inbox</h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload → extract → validate → review. Click a document to open it, or delete it from the list.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          {health?.has_api_key ? (
            <span>Model {health.model}</span>
          ) : health ? (
            <span className="text-amber-300">Set OPENAI_API_KEY in .env to extract</span>
          ) : error ? (
            <span className="text-amber-300">API is offline. The backend needs to be running.</span>
          ) : (
            <span>Connecting…</span>
          )}
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="In inbox" value={counts.all} />
        <Stat label="Valid" value={counts.valid} />
        <Stat label="Needs review" value={counts.needs_review} />
        <Stat label="Failed" value={counts.failed} />
      </div>

      <Dropzone onFiles={onFiles} disabled={busy} />
      {busy && <p className="mt-2 text-xs text-sky-300">Uploading and starting extraction…</p>}
      {flash && <p className="mt-3 rounded-lg border border-sky-900 bg-sky-950/40 px-3 py-2 text-sm text-sky-100">{flash}</p>}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1 text-xs ${filter === f.id ? 'bg-sky-800 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_130px_1fr_88px] bg-slate-900 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 md:grid">
          <span>File</span>
          <span>Type</span>
          <span>Status</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>
        {visible.length === 0 && (
          <div className="px-3 py-10 text-center text-sm text-slate-500">
            No documents yet. Drop a file to run classification, extraction, and validation.
          </div>
        )}
        {visible.map((d) => (
          <DocRow
            key={d.id}
            doc={d}
            onOpen={() => navigate(`/documents/${d.id}`)}
            onDelete={() => setPendingDelete(d)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete this document?"
        body={
          pendingDelete
            ? `${pendingDelete.filename} will be removed from the inbox, along with its file and extracted fields.`
            : ''
        }
        busy={deleting}
        onCancel={() => !deleting && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  )
}

function isImage(doc: DocumentListItem) {
  return doc.mime.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(doc.filename)
}

function DocRow({
  doc,
  onOpen,
  onDelete,
}: {
  doc: DocumentListItem
  onOpen: () => void
  onDelete: () => void
}) {
  const pending = isPending(doc.status)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={`grid cursor-pointer items-center gap-2 border-t border-slate-800 px-3 py-2.5 text-sm hover:bg-slate-900/80 md:grid-cols-[minmax(0,1.4fr)_120px_130px_1fr_88px] ${
        pending ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Thumb doc={doc} />
        <div className="min-w-0">
          <div className="truncate font-medium text-sky-300">{doc.filename}</div>
          {doc.error_message && <div className="truncate text-[11px] text-rose-300">{doc.error_message}</div>}
        </div>
      </div>
      <div>
        <TypeBadge type={doc.doc_type} />
      </div>
      <div>
        <StatusBadge status={doc.status} />
      </div>
      <div className="text-xs text-slate-400">{doc.updated_at ? new Date(doc.updated_at).toLocaleString() : '—'}</div>
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-ghost text-rose-200 hover:bg-rose-950"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function Thumb({ doc }: { doc: DocumentListItem }) {
  if (isImage(doc)) {
    return <img src={fileUrl(doc.id)} alt="" className="h-10 w-10 rounded-md object-cover ring-1 ring-slate-700" />
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-[10px] font-medium text-slate-300 ring-1 ring-slate-700">
      PDF
    </div>
  )
}

function isPending(status: DocStatus) {
  return status === 'uploaded' || status === 'processing'
}
