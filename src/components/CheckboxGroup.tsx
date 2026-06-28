type Props = {
  options: string[]
  selected: string[]
  onChange: (item: string) => void
  colorClass?: string
  checkedClass?: string
}

export default function CheckboxGroup({
  options,
  selected,
  onChange,
  colorClass = 'border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-200',
  checkedClass = 'ring-2 ring-primary/60',
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all select-none',
              colorClass,
              checked ? checkedClass : 'opacity-60 hover:opacity-90',
            ].join(' ')}
          >
            {checked ? '✓ ' : ''}{opt}
          </button>
        )
      })}
    </div>
  )
}
