'use client'

import { memo, useId } from 'react'
import { Check, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ModuleInclusion } from '@/lib/athena/resolve'
import type { AthenaCatalogModule } from '@/lib/athena/types'
import { strings } from '@/lib/strings'
import { cn } from '@/lib/utils'

/**
 * A module as one big checkbox: the card is a <label> around a visually hidden
 * native checkbox, so clicks anywhere, Space, and screen readers all work.
 * Locked cards (required / pulled in as a dependency) stay focusable and use
 * aria-disabled so keyboard users can still reach the explanation.
 */
export const ModuleCard = memo(function ModuleCard({
  module: m,
  inclusion,
  includedBy,
  onToggle,
}: {
  module: AthenaCatalogModule
  inclusion: ModuleInclusion | undefined
  /** Checked modules that pull this one in; only meaningful for "dependency". */
  includedBy: readonly string[]
  onToggle: (id: string) => void
}) {
  const uid = useId()
  const t = strings.card
  const checked = inclusion !== undefined
  const locked = inclusion === 'required' || inclusion === 'dependency'
  const lockReason =
    inclusion === 'required' ? t.requiredTooltip : inclusion === 'dependency' ? t.dependencyTooltip(includedBy) : null

  const nameId = `${uid}-name`
  const stateId = `${uid}-state`
  const descId = `${uid}-desc`

  const box = (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
        checked && !locked && 'border-primary bg-primary text-primary-foreground',
        checked && locked && 'border-primary/40 bg-primary/25 text-foreground',
        !checked && 'border-input dark:bg-input/30',
      )}
    >
      {checked && <Check className="size-3.5" />}
    </span>
  )

  return (
    <label
      className={cn(
        'relative flex gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
        locked ? 'cursor-default' : 'cursor-pointer hover:bg-muted/40',
        inclusion === 'selected' && 'border-primary/50 bg-primary/[0.045]',
        inclusion === 'dependency' && 'border-dashed border-primary/40 bg-primary/[0.02]',
        inclusion === 'required' && 'border-border bg-muted/30',
        !checked && 'border-border/70',
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        aria-disabled={locked || undefined}
        aria-labelledby={nameId}
        aria-describedby={`${stateId} ${descId}`}
        onChange={() => {
          if (!locked) onToggle(m.id)
        }}
      />
      {lockReason ? (
        <Tooltip>
          <TooltipTrigger render={<span className="flex" />}>{box}</TooltipTrigger>
          <TooltipContent>{lockReason}</TooltipContent>
        </Tooltip>
      ) : (
        box
      )}

      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 id={nameId} className="text-sm font-semibold">
            {m.name}
          </h4>
          <code className="font-mono text-[11px] text-muted-foreground">{m.id}</code>
          {m.version && <span className="font-mono text-[10px] text-muted-foreground">{t.version(m.version)}</span>}
        </div>

        <div className="flex flex-wrap gap-1">
          {m.required && (
            <Badge className="font-mono text-[10px]">
              <Lock data-icon="inline-start" />
              {t.required}
            </Badge>
          )}
          {m.default && !m.required && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {t.default}
            </Badge>
          )}
          {m.api.quickjs && (
            <Badge variant="outline" className="font-mono text-[10px]" title={t.jsTitle}>
              {t.js}
            </Badge>
          )}
          {m.api.native && (
            <Badge variant="outline" className="font-mono text-[10px]" title={t.cTitle}>
              {t.c}
            </Badge>
          )}
        </div>

        <p id={descId} className="text-xs leading-5 text-muted-foreground">
          {m.description}
        </p>

        {m.dependencies.modules.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {t.dependsOn} <span className="font-mono text-foreground/80">{m.dependencies.modules.join(', ')}</span>
          </p>
        )}
        {m.dependencies.iop.length > 0 && (
          <p className="text-[11px] text-muted-foreground/80">
            {t.iopDrivers} <span className="font-mono">{m.dependencies.iop.join(', ')}</span>
          </p>
        )}

        <p id={stateId} className={cn('text-[11px] font-medium text-primary', !lockReason && 'sr-only')}>
          {inclusion === 'dependency' && includedBy.length > 0 && t.includedBy(includedBy.join(', '))}
          {inclusion === 'required' && t.requiredTooltip}
        </p>
      </div>
    </label>
  )
})
