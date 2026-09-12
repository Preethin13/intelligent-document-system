import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteDocument, exportUrl, fileUrl, getDocument, patchDocument, reprocessDocument } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FieldForm } from '../components/FieldForm'
import { StatusBadge, TypeBadge } from '../components/StatusBadge'
import type { DocumentDetail } from '../types'

export function Review() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [fields, setFields] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveResult, setSaveResult] = useState<'valid' | 'needs_review' | null>(null)
  const fieldsHydrated = useRef(false)
  const fieldsRef = useRef<Record<string, unknown>>({})
  const savingRef = useRef(false)

  useEffect(() => {
    fieldsHydrated.current = false
    setDoc(null)
    setNotice(null)
    setSaveResult(null)
  }, [id])

  useEffect(() => {
    fieldsRef.current = fields
  }, [fields])

  useEffect(() => {
    if (!id) return
    let stop = false

    const documentId = id
    async function load(forceFields = false) {
      if (savingRef.current) return
      try {
        const d = await getDocument(documentId)
        if (stop || savingRef.current) return
        setDoc(d)
        const pending = d.status === 'uploaded' || d.status === 'processing'
        if (forceFields || !fieldsHydrated.current) {
          setFields(d.fields ?? {})
          if (!pending) fieldsHydrated.current = true
        }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e))
      }
    }

    load(true)
    const t = setInterval(() => {
      void load(false)
    }, 2000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [id])

  if (error && !doc) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-rose-300">
        {error} · <Link to="/">Back to inbox</Link>
      </div>
    )
  }
  if (!doc) {
    return <div className="px-4 py-8 text-sm text-slate-400">Loading…</div>
  }

  const pending = doc.status === 'uploaded' || doc.status === 'processing'
  const isPdf = doc.mime === 'application/pdf' || doc.filename.toLowerCase().endsWith('.pdf')
  const errorCount = doc.issues.filter((i) => i.severity === 'error').length
  const warningCount = doc.issues.filter((i) => i.severity === 'warning').length

  async function save() {
    if (!doc) return
    if (pending) {
      setNotice('Wait until extraction finishes, then save again.')
      return
    }
    if (!doc.doc_type) {
      setError('This file has no document type yet. Use Reprocess after extraction is set up, then save.')
      return
    }
    setSaving(true)
    savingRef.current = true
    setError(null)
    setNotice('Saving and running validation…')
    setSaveResult(null)
    try {
      const next = await patchDocument(doc.id, fieldsRef.current)
      setDoc(next)
      setFields(next.fields ?? {})
      fieldsHydrated.current = true
      const errors = next.issues.filter((i) => i.severity === 'error').length
      const warnings = next.issues.filter((i) => i.severity === 'warning').length
      if (errors) {
        setSaveResult('needs_review')
        setNotice(
          `Saved. Validation found ${errors} error${errors === 1 ? '' : 's'}${warnings ? ` and ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}. Fix them here, or go back to Home.`,
        )
      } else {
        setSaveResult('valid')
        setNotice(
          warnings
            ? `Validation confirmed. This document is valid, with ${warnings} warning${warnings === 1 ? '' : 's'}.`
            : 'Validation confirmed. This document passed and is marked valid.',
        )
      }
    } catch (e) {
      setNotice(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function reprocess() {
    if (!doc) return
    setSaving(true)
    savingRef.current = true
    setError(null)
    setNotice('Reprocessing…')
    fieldsHydrated.current = false
    try {
      await reprocessDocument(doc.id)
      const next = await getDocument(doc.id)
      setDoc(next)
      setFields(next.fields ?? {})
      setNotice('Extraction started. Save & validate will be available when it finishes.')
    } catch (e) {
      setNotice(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function remove() {
    if (!doc) return
    setDeleting(true)
    setError(null)
    try {
      await deleteDocument(doc.id)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0a1424]/80 px-4 py-3">
        <div className="min-w-0">
          <button type="button" className="text-xs text-sky-300 hover:underline" onClick={() => navigate('/')}>
            ← Home
          </button>
          <h1 className="mt-2 truncate text-sm font-semibold text-white">{doc.filename}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <TypeBadge type={doc.doc_type} />
            <StatusBadge status={doc.status} />
            {doc.extraction?.confidence != null && (
              <span>confidence {(doc.extraction.confidence * 100).toFixed(0)}%</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <a className="btn btn-ghost" href={exportUrl(doc.id, 'json')}>
            Export JSON
          </a>
          <a className="btn btn-ghost" href={exportUrl(doc.id, 'csv')}>
            Export CSV
          </a>
          <button type="button" className="btn btn-ghost" onClick={reprocess} disabled={saving || deleting}>
            Reprocess
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)} disabled={saving || deleting}>
            Delete
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || deleting}>
            {saving ? 'Saving…' : pending ? 'Waiting for extraction' : 'Save & validate'}
          </button>
        </div>
      </header>

      {notice && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm ${
            saveResult === 'valid'
              ? 'border-emerald-800 bg-emerald-950/50 text-emerald-100'
              : saveResult === 'needs_review'
                ? 'border-amber-800 bg-amber-950/40 text-amber-100'
                : 'border-sky-900 bg-sky-950/50 text-sky-100'
          }`}
        >
          <p>{notice}</p>
          {saveResult && (
            <button type="button" className="shrink-0 text-sm text-sky-300 hover:underline" onClick={() => navigate('/')}>
              ← Home
            </button>
          )}
        </div>
      )}
      {error && <div className="border-b border-rose-900 bg-rose-950/40 px-4 py-2 text-xs text-rose-200">{error}</div>}
      {doc.error_message && (
        <div className="border-b border-rose-900 bg-rose-950/40 px-4 py-2 text-xs text-rose-200">{doc.error_message}</div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_280px]">
        <section className="min-h-0 border-r border-slate-800 bg-slate-950">
          {isPdf ? (
            <iframe title="preview" className="h-full w-full" src={fileUrl(doc.id)} />
          ) : (
            <div className="flex h-full items-start justify-center overflow-auto p-4">
              <img src={fileUrl(doc.id)} alt={doc.filename} className="max-w-full rounded shadow" />
            </div>
          )}
        </section>
        <section className="min-h-0 overflow-auto border-r border-slate-800 p-4">
          {pending ? (
            <p className="text-sm text-slate-400">Processing… classification and extraction usually take a few seconds.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <FieldForm docType={doc.doc_type} fields={fields} issues={doc.issues} onChange={setFields} />
            </form>
          )}
        </section>
        <aside className="min-h-0 overflow-auto p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Issues
            {doc.issues.length > 0 && (
              <span className="ml-2 font-normal normal-case text-slate-500">
                {errorCount} errors · {warningCount} warnings
              </span>
            )}
          </h2>
          {doc.issues.length === 0 && !pending && (
            <p className="text-sm text-emerald-300">No issues. This record can be exported.</p>
          )}
          <ul className="space-y-2">
            {doc.issues.map((issue, i) => (
              <li
                key={`${issue.field}-${issue.code}-${i}`}
                className={`rounded-lg border px-2 py-2 text-xs ${
                  issue.severity === 'error' ? 'border-rose-800 bg-rose-950/50 text-rose-100' : 'border-amber-800 bg-amber-950/40 text-amber-100'
                }`}
              >
                <div className="font-medium">
                  {issue.field} · {issue.severity}
                </div>
                <div className="mt-0.5 text-slate-300">{issue.message}</div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="border-t border-slate-800 bg-[#0a1424] px-4 py-3 lg:hidden">
        <button type="button" className="btn btn-primary w-full py-2.5 text-sm" onClick={() => void save()} disabled={saving || deleting}>
          {saving ? 'Saving…' : pending ? 'Waiting for extraction' : 'Save & validate'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this document?"
        body={`${doc.filename} will be removed from the inbox, along with its file and extracted fields.`}
        busy={deleting}
        onCancel={() => !deleting && setConfirmDelete(false)}
        onConfirm={remove}
      />
    </div>
  )
}
