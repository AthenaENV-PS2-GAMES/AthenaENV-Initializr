import { Info, TriangleAlert } from 'lucide-react'
import type { SelectionWarnings } from '@/lib/athena/selection'
import type { AthenaRuntime } from '@/lib/athena/types'
import { strings } from '@/lib/strings'
import { cn } from '@/lib/utils'

/** Non-blocking notes about the effective module set. */
export function Warnings({ warnings, runtime }: { warnings: SelectionWarnings; runtime: AthenaRuntime }) {
  const t = strings.warnings
  if (!warnings.noBootDevice && !warnings.erl) return null
  return (
    <ul className="grid gap-2">
      {warnings.noBootDevice &&
        (runtime === 'quickjs' ? (
          <Note tone="warning" title={t.noBootDeviceTitle} body={t.noBootDevice} />
        ) : (
          <Note tone="info" title={t.noBootDeviceNativeTitle} body={t.noBootDevice} />
        ))}
      {warnings.erl && <Note tone="warning" title={t.erlTitle} body={t.erl} />}
    </ul>
  )
}

function Note({ tone, title, body }: { tone: 'warning' | 'info'; title: string; body: string }) {
  const Icon = tone === 'warning' ? TriangleAlert : Info
  return (
    <li
      className={cn(
        'flex gap-2 rounded-lg border p-3 text-xs leading-5',
        tone === 'warning' ? 'border-warning/40 bg-warning/10' : 'border-border bg-muted/40',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone === 'warning' ? 'text-warning' : 'text-muted-foreground')} aria-hidden />
      <span>
        <strong className="font-semibold">{title}.</strong> <span className="text-muted-foreground">{body}</span>
      </span>
    </li>
  )
}
