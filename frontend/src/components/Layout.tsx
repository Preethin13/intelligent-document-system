import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-56 shrink-0 border-r border-slate-800 bg-[#0a1424] p-4 md:flex md:flex-col">
        <div className="text-sm font-semibold tracking-tight text-white">Intelligent Documents</div>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">Extract, validate, and review</p>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 ${isActive ? 'bg-sky-900/70 text-white' : 'text-slate-300 hover:bg-slate-900'}`
            }
          >
            Home
          </NavLink>
        </nav>
        <ol className="mt-8 space-y-2 text-[11px] text-slate-500">
          <li>1. Upload</li>
          <li>2. Extract</li>
          <li>3. Validate</li>
          <li>4. Review</li>
        </ol>
      </aside>
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
