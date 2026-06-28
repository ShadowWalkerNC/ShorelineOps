import type { Resident } from '@/types'

type Props = {
  residents: Resident[]
  onEdit?: (r: Resident) => void
  onDelete?: (id: string) => void
}

const STATUS_COLORS: Record<Resident['status'], string> = {
  Active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Hospital: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  LOA: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Passed Away': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export default function ResidentTable({ residents, onEdit, onDelete }: Props) {
  if (residents.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        No residents found. Add your first resident to get started.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Room</th>
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Diet</th>
            <th className="px-4 py-3 text-left font-medium">Texture</th>
            <th className="px-4 py-3 text-left font-medium">Allergies</th>
            <th className="px-4 py-3 text-left font-medium">Ensure/day</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {residents.map((r) => (
            <tr
              key={r.id}
              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <td className="px-4 py-3 font-mono text-slate-500">{r.room}</td>
              <td className="px-4 py-3 font-medium">{r.name}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.dietType}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                {r.texture !== 'Regular' ? (
                  <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 rounded text-xs">
                    {r.texture}
                  </span>
                ) : (
                  <span className="text-slate-400">Regular</span>
                )}
              </td>
              <td className="px-4 py-3">
                {r.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {r.allergies.map((a) => (
                      <span key={a} className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-1.5 py-0.5 rounded text-xs">
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {r.ensurePerDay > 0 ? (
                  <span className="font-medium text-teal-600 dark:text-teal-400">{r.ensurePerDay}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(r)}
                      className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(r.id)}
                      className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
