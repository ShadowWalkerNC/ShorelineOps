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
}

export default function FormField({ label, required, error, children, hint, id: idProp }: Props) {
  // F8: associate the label with its control so screen readers announce
  // it. The id is generated when the caller does not supply one.
  const autoId = useId()
  const fieldId = idProp || autoId
  const hintId = hint && !error ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        id: (children as ReactElement<FieldControlProps>).props.id ?? fieldId,
        'aria-describedby': describedBy,
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
