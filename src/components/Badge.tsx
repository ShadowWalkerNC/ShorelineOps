type Variant = 'green' | 'yellow' | 'red' | 'blue' | 'gray'

const VARIANTS: Record<Variant, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  red: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  gray: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

type Props = {
  label: string
  variant?: Variant
  className?: string
}

export default function Badge({ label, variant = 'gray', className = '' }: Props) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        VARIANTS[variant]
      } ${className}`}
    >
      {label}
    </span>
  )
}
