import type { ModuleInclusion } from '@/lib/athena/resolve'
import { strings } from '@/lib/strings'
import { cn } from '@/lib/utils'

const GROUPS: { kind: ModuleInclusion; label: string; chip: string }[] = [
  { kind: 'selected', label: strings.summary.selected, chip: 'border-primary/50 bg-primary/10 text-foreground' },
  { kind: 'dependency', label: strings.summary.dependencies, chip: 'border-dashed border-border text-muted-foreground' },
  { kind: 'required', label: strings.summary.required, chip: 'border-border bg-muted text-muted-foreground' },
]

export function SelectionSummary({ inclusion, total }: { inclusion: ReadonlyMap<string, ModuleInclusion>; total: number }) {
  return (
    <div className="grid gap-2">
      <p className="font-mono text-sm font-semibold">{strings.summary.count(inclusion.size, total)}</p>
      <dl className="grid gap-1.5">
        {GROUPS.map(({ kind, label, chip }) => {
          const ids = [...inclusion].filter(([, k]) => k === kind).map(([id]) => id).sort()
          return (
            <div key={kind} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-2">
              <dt className="pt-0.5 text-[11px] text-muted-foreground">{label}</dt>
              <dd className="flex flex-wrap gap-1">
                {ids.length ? (
                  ids.map((id) => (
                    <span key={id} className={cn('rounded border px-1.5 py-0.5 font-mono text-[10px]', chip)}>
                      {id}
                    </span>
                  ))
                ) : (
                  <span className="pt-0.5 text-[11px] text-muted-foreground/70">{strings.summary.none}</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
