import { AppleSegmentedControl } from '@/apple-ui'
import { useAppearance, type Appearance } from '@/state/appearance'

export default function AppearanceControl() {
  const { appearance, setAppearance } = useAppearance()
  return <fieldset className="mb-5 min-w-0">
    <legend className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">Appearance</legend>
    <AppleSegmentedControl<Appearance> value={appearance} onChange={setAppearance}
      options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
  </fieldset>
}
