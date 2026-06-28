import type { ReactNode } from 'react'

type Props = {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
  hint?: string
}

export default function FormField({ label, required, error, children, hint }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
