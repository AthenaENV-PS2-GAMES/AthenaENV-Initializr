import type { AthenaRuntime } from '@/lib/athena/types'
import { strings } from '@/lib/strings'
import { cn } from '@/lib/utils'

/** Segmented control built on native radios (arrow keys move between options). */
export function RuntimeSelector({
  runtimes,
  artifacts,
  value,
  onChange,
}: {
  runtimes: readonly AthenaRuntime[]
  artifacts: Record<AthenaRuntime, string[]>
  value: AthenaRuntime
  onChange: (runtime: AthenaRuntime) => void
}) {
  const t = strings.runtime
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t.legend}</legend>
      <div className={cn('grid gap-2', runtimes.length > 1 && 'sm:grid-cols-2')}>
        {runtimes.map((runtime) => {
          const option = t.options[runtime]
          const checked = runtime === value
          const produced = artifacts[runtime] ?? []
          return (
            <label
              key={runtime}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                checked ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{option.label}</span>
                <input
                  type="radio"
                  name="athena-runtime"
                  value={runtime}
                  checked={checked}
                  onChange={() => onChange(runtime)}
                  className="size-3.5 accent-[var(--primary)]"
                />
              </span>
              <span className="text-xs leading-5 text-muted-foreground">{option.description}</span>
              {produced.length > 0 && (
                <span className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <span>{t.produces}</span>
                  {produced.map((name) => (
                    <code key={name} className="rounded bg-muted px-1 py-0.5 text-foreground">
                      {name}
                    </code>
                  ))}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
