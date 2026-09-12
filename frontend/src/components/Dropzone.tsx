import { useCallback, useState } from 'react'

type Props = {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function Dropzone({ onFiles, disabled }: Props) {
  const [over, setOver] = useState(false)

  const take = useCallback(
    (list: FileList | null) => {
      if (!list || disabled) return
      onFiles(Array.from(list))
    },
    [disabled, onFiles],
  )

  return (
    <label
      className={`block cursor-pointer rounded-lg border border-dashed px-6 py-10 text-center transition ${
        over ? 'border-sky-400 bg-sky-950/40' : 'border-slate-600 bg-slate-900/60'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
    >
      <input
        type="file"
        className="hidden"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        multiple
        disabled={disabled}
        onChange={(e) => take(e.target.files)}
      />
      <div className="text-sm font-medium text-slate-100">Drop PDFs or images here</div>
      <div className="mt-1 text-xs text-slate-400">Invoices, receipts, contracts, IDs, or any PDF — click to browse</div>
    </label>
  )
}
