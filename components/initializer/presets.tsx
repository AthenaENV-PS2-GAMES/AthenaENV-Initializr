import { Button } from '@/components/ui/button'
import { PRESET_IDS, type PresetId } from '@/lib/athena/selection'
import { strings } from '@/lib/strings'

/** `active` is the preset whose selection equals the current one, if any. */
export function Presets({ active, onApply }: { active: PresetId | null; onApply: (preset: PresetId) => void }) {
  const t = strings.presets
  return (
    <div role="group" aria-labelledby="presets-legend" className="grid gap-2">
      <span id="presets-legend" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {t.legend}
      </span>
      <div className="flex flex-wrap gap-2">
        {PRESET_IDS.map((id) => (
          <Button
            key={id}
            variant={active === id ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={active === id}
            title={t.hints[id]}
            onClick={() => onApply(id)}
            className="font-mono text-xs aria-pressed:border-primary/60"
          >
            {t[id]}
          </Button>
        ))}
      </div>
    </div>
  )
}
