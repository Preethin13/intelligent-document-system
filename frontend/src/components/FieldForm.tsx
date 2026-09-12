import type { DocType, Issue } from '../types'

type Props = {
  docType: DocType | null
  fields: Record<string, unknown>
  issues: Issue[]
  onChange: (next: Record<string, unknown>) => void
}

function str(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function Field({
  label,
  name,
  value,
  issues,
  onChange,
  type = 'text',
}: {
  label: string
  name: string
  value: string
  issues: Issue[]
  onChange: (v: string) => void
  type?: string
}) {
  const related = issues.filter((i) => i.field === name)
  const err = related.some((i) => i.severity === 'error')
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded border bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none ${
          err ? 'border-rose-500' : related.length ? 'border-amber-500' : 'border-slate-700'
        }`}
      />
    </label>
  )
}

function numOrNull(v: string): number | null {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function emptyItem(docType: DocType): Record<string, unknown> {
  if (docType === 'invoice') return { description: '', quantity: null, unit_price: null, amount: null }
  if (docType === 'receipt') return { description: '', quantity: null, amount: null }
  if (docType === 'contract') return { name: '', role: '' }
  return { key: '', value: '' }
}

export function FieldForm({ docType, fields, issues, onChange }: Props) {
  const set = (name: string, value: unknown) => onChange({ ...fields, [name]: value })

  if (!docType) {
    return <p className="text-sm text-slate-400">Waiting for classification…</p>
  }

  if (docType === 'invoice') {
    const items = Array.isArray(fields.line_items) ? (fields.line_items as Record<string, unknown>[]) : []
    return (
      <div className="space-y-3">
        <Field label="Vendor" name="vendor_name" value={str(fields.vendor_name)} issues={issues} onChange={(v) => set('vendor_name', v || null)} />
        <Field label="Invoice number" name="invoice_number" value={str(fields.invoice_number)} issues={issues} onChange={(v) => set('invoice_number', v || null)} />
        <Field label="Invoice date" name="invoice_date" value={str(fields.invoice_date)} issues={issues} onChange={(v) => set('invoice_date', v || null)} />
        <Field label="Due date" name="due_date" value={str(fields.due_date)} issues={issues} onChange={(v) => set('due_date', v || null)} />
        <Field label="Currency" name="currency" value={str(fields.currency)} issues={issues} onChange={(v) => set('currency', v || null)} />
        <Field label="Bill to" name="bill_to" value={str(fields.bill_to)} issues={issues} onChange={(v) => set('bill_to', v || null)} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Subtotal" name="subtotal" value={str(fields.subtotal)} issues={issues} onChange={(v) => set('subtotal', numOrNull(v))} />
          <Field label="Tax" name="tax" value={str(fields.tax)} issues={issues} onChange={(v) => set('tax', numOrNull(v))} />
          <Field label="Total" name="total" value={str(fields.total)} issues={issues} onChange={(v) => set('total', numOrNull(v))} />
        </div>
        <ArrayEditor
          title="Line items"
          field="line_items"
          issues={issues}
          rows={items}
          columns={['description', 'quantity', 'unit_price', 'amount']}
          onChange={(rows) => set('line_items', rows)}
          newRow={() => emptyItem('invoice')}
        />
      </div>
    )
  }

  if (docType === 'receipt') {
    const items = Array.isArray(fields.items) ? (fields.items as Record<string, unknown>[]) : []
    return (
      <div className="space-y-3">
        <Field label="Merchant" name="merchant" value={str(fields.merchant)} issues={issues} onChange={(v) => set('merchant', v || null)} />
        <Field label="Date/time" name="datetime" value={str(fields.datetime)} issues={issues} onChange={(v) => set('datetime', v || null)} />
        <Field label="Currency" name="currency" value={str(fields.currency)} issues={issues} onChange={(v) => set('currency', v || null)} />
        <Field label="Payment method" name="payment_method" value={str(fields.payment_method)} issues={issues} onChange={(v) => set('payment_method', v || null)} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Subtotal" name="subtotal" value={str(fields.subtotal)} issues={issues} onChange={(v) => set('subtotal', numOrNull(v))} />
          <Field label="Tax" name="tax" value={str(fields.tax)} issues={issues} onChange={(v) => set('tax', numOrNull(v))} />
          <Field label="Total" name="total" value={str(fields.total)} issues={issues} onChange={(v) => set('total', numOrNull(v))} />
        </div>
        <ArrayEditor
          title="Items"
          field="items"
          issues={issues}
          rows={items}
          columns={['description', 'quantity', 'amount']}
          onChange={(rows) => set('items', rows)}
          newRow={() => emptyItem('receipt')}
        />
      </div>
    )
  }

  if (docType === 'contract') {
    const parties = Array.isArray(fields.parties) ? (fields.parties as Record<string, unknown>[]) : []
    const clauses = Array.isArray(fields.key_clauses) ? (fields.key_clauses as Record<string, unknown>[]) : []
    return (
      <div className="space-y-3">
        <Field label="Title" name="title" value={str(fields.title)} issues={issues} onChange={(v) => set('title', v || null)} />
        <Field label="Effective date" name="effective_date" value={str(fields.effective_date)} issues={issues} onChange={(v) => set('effective_date', v || null)} />
        <Field label="Expiration date" name="expiration_date" value={str(fields.expiration_date)} issues={issues} onChange={(v) => set('expiration_date', v || null)} />
        <Field label="Governing law" name="governing_law" value={str(fields.governing_law)} issues={issues} onChange={(v) => set('governing_law', v || null)} />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(fields.signatures_present)}
            onChange={(e) => set('signatures_present', e.target.checked)}
          />
          Signatures present
        </label>
        <ArrayEditor
          title="Parties"
          field="parties"
          issues={issues}
          rows={parties}
          columns={['name', 'role']}
          onChange={(rows) => set('parties', rows)}
          newRow={() => emptyItem('contract')}
        />
        <ArrayEditor
          title="Key clauses"
          field="key_clauses"
          issues={issues}
          rows={clauses}
          columns={['name', 'excerpt']}
          onChange={(rows) => set('key_clauses', rows)}
          newRow={() => ({ name: '', excerpt: '' })}
        />
      </div>
    )
  }

  if (docType === 'id_document') {
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">ID type</span>
          <select
            value={str(fields.id_type) || 'other'}
            onChange={(e) => set('id_type', e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          >
            <option value="passport">Passport</option>
            <option value="license">License</option>
            <option value="other">Other</option>
          </select>
        </label>
        <Field label="Full name" name="full_name" value={str(fields.full_name)} issues={issues} onChange={(v) => set('full_name', v || null)} />
        <Field label="Date of birth" name="date_of_birth" value={str(fields.date_of_birth)} issues={issues} onChange={(v) => set('date_of_birth', v || null)} />
        <Field label="Document number" name="document_number" value={str(fields.document_number)} issues={issues} onChange={(v) => set('document_number', v || null)} />
        <Field label="Issue date" name="issue_date" value={str(fields.issue_date)} issues={issues} onChange={(v) => set('issue_date', v || null)} />
        <Field label="Expiry date" name="expiry_date" value={str(fields.expiry_date)} issues={issues} onChange={(v) => set('expiry_date', v || null)} />
        <Field label="Country" name="country" value={str(fields.country)} issues={issues} onChange={(v) => set('country', v || null)} />
        <Field label="Address" name="address" value={str(fields.address)} issues={issues} onChange={(v) => set('address', v || null)} />
      </div>
    )
  }

  const kvs = Array.isArray(fields.fields) ? (fields.fields as Record<string, unknown>[]) : []
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Summary</span>
        <textarea
          value={str(fields.summary)}
          onChange={(e) => set('summary', e.target.value || null)}
          rows={4}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
        />
      </label>
      <ArrayEditor
        title="Fields"
        field="fields"
        issues={issues}
        rows={kvs}
        columns={['key', 'value']}
        onChange={(rows) => set('fields', rows)}
        newRow={() => ({ key: '', value: '' })}
      />
    </div>
  )
}

function ArrayEditor({
  title,
  field,
  rows,
  columns,
  issues,
  onChange,
  newRow,
}: {
  title: string
  field: string
  rows: Record<string, unknown>[]
  columns: string[]
  issues: Issue[]
  onChange: (rows: Record<string, unknown>[]) => void
  newRow: () => Record<string, unknown>
}) {
  const err = issues.some((i) => i.field === field && i.severity === 'error')
  return (
    <div className={`rounded border p-2 ${err ? 'border-rose-500' : 'border-slate-800'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        <button
          type="button"
          className="text-xs text-sky-300 hover:text-sky-200"
          onClick={() => onChange([...rows, newRow()])}
        >
          Add row
        </button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-slate-500">No rows</p>}
        {rows.map((row, idx) => (
          <div key={idx} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr) auto` }}>
            {columns.map((col) => (
              <input
                key={col}
                placeholder={col}
                value={str(row[col])}
                onChange={(e) => {
                  const next = rows.map((r, i) => (i === idx ? { ...r, [col]: coerce(col, e.target.value) } : r))
                  onChange(next)
                }}
                className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
            ))}
            <button
              type="button"
              className="text-xs text-rose-300"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function coerce(col: string, value: string): string | number | null {
  if (['quantity', 'unit_price', 'amount'].includes(col)) return numOrNull(value)
  return value
}
