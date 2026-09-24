import { useId, cloneElement, isValidElement, type ReactElement } from 'react'
import type { ReactNode } from 'react'

type Props = {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
  hint?: string
  id?: string
}

type FieldControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-required'?: boolean
}

export default function FormField({ label, required, error, children, hint, id: idProp }: Props) {
  // F8: associate the label with its control so screen readers announce
  // it. The id is generated when the caller does not supply one.
  const autoId = useId()
  const child = isValidElement<FieldControlProps>(children) ? children : null
  const fieldId = idProp || child?.props.id || autoId
  const hintId = hint && !error ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [child?.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        id: fieldId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : child?.props['aria-invalid'],
        'aria-required': required || child?.props['aria-required'],
      })
    : children
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
