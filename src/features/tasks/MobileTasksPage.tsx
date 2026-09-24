import { Link } from 'react-router-dom'
import { ChevronRight, Thermometer, Truck, Users, ChefHat } from 'lucide-react'

// These are navigation shortcuts, not scheduled tasks or evidence of completed checks.
const operationalTools = [
  { title: 'Production and temperature records', description: 'Open the kitchen sheet and record observations in the operational tool.', route: '/kitchen/sheet', icon: Thermometer },
  { title: 'Resident orders and allergies', description: 'Review current dietary orders, NPO status, and allergy information.', route: '/residents', icon: Users },
  { title: 'Tray assembly and dispatch', description: 'Open the current tray run and its recorded assembly events.', route: '/kitchen/dispatch', icon: Truck },
  { title: 'Production preparation', description: 'Review preparation sheets and approved recipes for the meal service.', route: '/production', icon: ChefHat },
]

export default function MobileTasksPage() {
  return <div className="mx-auto max-w-2xl space-y-4 pb-6">
    <header>
      <h1 className="text-2xl font-bold">Shift operations</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Open the operational tools to review and record today’s work.</p>
    </header>
    <section aria-labelledby="checklist-status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <h2 id="checklist-status" className="font-semibold">No recorded shift checklist</h2>
      <p className="mt-2 text-sm">A shared checklist is not connected to this page. Completion, assignment, and handoff status are unavailable here. Use the records in each operational tool and your facility’s handoff process.</p>
    </section>
    <nav aria-label="Shift operational tools" className="space-y-3">
      {operationalTools.map(({ title, description, route, icon: Icon }) => <Link key={route} to={route} className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:hover:bg-slate-800">
        <Icon aria-hidden="true" className="h-6 w-6 shrink-0 text-teal-600" />
        <div className="min-w-0 flex-1"><span className="font-semibold">{title}</span><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p></div>
        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0" />
      </Link>)}
    </nav>
  </div>
}
