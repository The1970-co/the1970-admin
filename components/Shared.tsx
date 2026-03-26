'use client'

import { branches } from '@/lib/admin-data'
import { summarizePermissions } from '@/lib/admin-helpers'

export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}) {
  const base =
    'inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition'
  const tone =
    variant === 'primary'
      ? 'bg-neutral-900 text-white hover:bg-neutral-800'
      : variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-500'
      : variant === 'success'
      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
      : 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50'
  const state = disabled ? 'cursor-not-allowed opacity-50' : ''

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${state} ${className}`}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode
  tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue'
}) {
  const styles: Record<string, string> = {
    gray: 'border-neutral-200 bg-neutral-100 text-neutral-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  )
}

export function StatCard({
  title,
  value,
  sub,
}: {
  title: string
  value: React.ReactNode
  sub: string
}) {
  return (
    <Panel>
      <div className="p-5">
        <p className="text-sm text-neutral-500">{title}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{value}</h3>
        <p className="mt-2 text-xs text-neutral-500">{sub}</p>
      </div>
    </Panel>
  )
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-xl text-neutral-500">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Header({
  search,
  setSearch,
  user,
  employees,
  activeEmployeeId,
  setActiveEmployeeId,
}: {
  search: string
  setSearch: (v: string) => void
  user: any
  employees: any[]
  activeEmployeeId: string
  setActiveEmployeeId: (v: string) => void
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
          The 1970 Operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Admin System
        </h1>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none md:w-[320px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm nhanh order, SKU, sản phẩm..."
        />

        {user.role === 'ADMIN' && (
          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none md:w-[260px]"
            value={activeEmployeeId}
            onChange={(e) => setActiveEmployeeId(e.target.value)}
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.code}
              </option>
            ))}
          </select>
        )}

        <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
          {user.role === 'ADMIN' ? 'Admin preview' : 'Staff view'}
        </div>
      </div>
    </div>
  )
}

export function PermissionModuleCard({
  label,
  description,
  items,
}: {
  label: string
  description: string
  items: string[]
}) {
  const hasItems = items && items.length > 0

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{label}</p>
          <Badge tone={hasItems ? 'blue' : 'gray'}>
            {hasItems ? `${items.length} quyền` : 'Không có'}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
        <p className="mt-3 text-sm italic text-neutral-700">
          {summarizePermissions(items)}
        </p>
      </div>
    </div>
  )
}