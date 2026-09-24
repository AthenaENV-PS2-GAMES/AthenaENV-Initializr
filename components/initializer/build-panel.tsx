'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Clock, Download, FileText, Hammer, Link2, Loader2, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { artifactUrl, type ServerInfo } from '@/lib/athena/api'
import { durationBetween, formatDuration, shortCommit } from '@/lib/athena/format'
import { sameIds } from '@/lib/athena/selection'
import type { AthenaBuildJob, AthenaRuntime } from '@/lib/athena/types'
import { strings } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { copyText, CopyButton } from './copy-button'
import { LOCAL_BUILD_ID } from './local-build-commands'

/** The selection a build was (or is being) made for. */
export interface BuildKey {
  runtime: AthenaRuntime
  /** Checked ids, sorted. */
  modules: string[]
}

export type BuildState =
  | { phase: 'idle' }
  | { phase: 'submitting'; key: BuildKey }
  /** Opening a `?build=<id>` link. */
  | { phase: 'loading'; id: string }
  /** queued, building, done or failed: follows job.status. */
  | { phase: 'job'; job: AthenaBuildJob; cached: boolean }
  | { phase: 'timeout'; job: AthenaBuildJob }
  | { phase: 'error'; title: string; message: string; key: BuildKey | null }

const PRIMARY_ARTIFACTS = ['athena.elf', 'athena-sdk.tar.gz']

const MAKEFILE_SNIPPET = `ATHENA_SDK = path/to/athena-sdk
include $(ATHENA_SDK)/athena.mk
EE_BIN = game.elf
EE_OBJS = main.o
EE_INCS = $(ATHENA_INCS)
EE_LIBS = $(ATHENA_LIBS)
EE_LDFLAGS = $(ATHENA_LDFLAGS)
include $(PS2SDK)/samples/Makefile.pref
include $(PS2SDK)/samples/Makefile.eeglobal`

export function buildLink(id: string): string {
  return `${window.location.origin}${window.location.pathname}?build=${id}`
}

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [enabled])
  return now
}

export function BuildPanel({
  server,
  build,
  stale,
  canBuild,
  effective,
  onBuild,
  onRetry,
}: {
  server: ServerInfo | null
  build: BuildState
  /** The shown result belongs to a different selection or runtime. */
  stale: boolean
  canBuild: boolean
  /** The effective module ids the page currently shows, sorted. */
  effective: readonly string[]
  onBuild: () => void
  onRetry: () => void
}) {
  const t = strings.build

  if (!server) {
    return (
      <div className="grid gap-1 rounded-lg border border-dashed p-3 text-xs leading-5">
        <strong className="font-semibold">{t.localModeTitle}</strong>
        <span className="text-muted-foreground">{t.localModeBody}</span>
        <a href={`#${LOCAL_BUILD_ID}`} className="w-fit rounded text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          {t.localModeLink}
        </a>
      </div>
    )
  }

  const submitting = build.phase === 'submitting'
  const hasResult = build.phase === 'job' || build.phase === 'timeout'

  return (
    <div className="grid grid-cols-1 gap-3">
      <Button size="lg" onClick={onBuild} disabled={!canBuild} className="h-10 w-full font-mono text-sm">
        {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Hammer data-icon="inline-start" />}
        {submitting ? t.submitting : hasResult && stale ? t.rebuild : t.button}
      </Button>
      <div aria-live="polite" className="empty:hidden">
        <BuildStatus build={build} stale={stale} effective={effective} onRetry={onRetry} />
      </div>
    </div>
  )
}

function BuildStatus({
  build,
  stale,
  effective,
  onRetry,
}: {
  build: BuildState
  stale: boolean
  effective: readonly string[]
  onRetry: () => void
}) {
  const t = strings.build
  switch (build.phase) {
    case 'idle':
    case 'submitting':
      return null
    case 'loading':
      return (
        <StatusBox>
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          <span>{t.loadingJob}</span>
        </StatusBox>
      )
    case 'error':
      return (
        <StatusBox tone="error">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span className="grid gap-1">
            <strong className="font-semibold">{build.title}</strong>
            <span className="break-words text-muted-foreground">{build.message}</span>
          </span>
        </StatusBox>
      )
    case 'timeout':
      return (
        <StatusBox tone="error" stale={stale}>
          <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span className="grid gap-2">
            <strong className="font-semibold">{t.timeoutTitle}</strong>
            <span className="text-muted-foreground">{t.timeout}</span>
            <LogLink job={build.job} prominent />
          </span>
        </StatusBox>
      )
    case 'job':
      return <JobStatus job={build.job} cached={build.cached} stale={stale} effective={effective} onRetry={onRetry} />
  }
}

function JobStatus({
  job,
  cached,
  stale,
  effective,
  onRetry,
}: {
  job: AthenaBuildJob
  cached: boolean
  stale: boolean
  effective: readonly string[]
  onRetry: () => void
}) {
  const t = strings.build
  const building = job.status === 'building'
  const now = useNow(building)

  if (job.status === 'queued') {
    return (
      <StatusBox stale={stale}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
        <span>{t.queued(job.position)}</span>
      </StatusBox>
    )
  }

  if (building) {
    const created = Date.parse(job.created)
    return (
      <StatusBox stale={stale}>
        <span className="grid w-full gap-2">
          <span>{t.building}</span>
          <span role="progressbar" aria-label={t.status.building} className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
            <span className="animate-indeterminate absolute inset-y-0 w-2/5 rounded-full bg-ps2" />
          </span>
          {!Number.isNaN(created) && (
            <span aria-live="off" className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {t.elapsed(formatDuration(now - created))}
            </span>
          )}
        </span>
      </StatusBox>
    )
  }

  if (job.status === 'failed') {
    return (
      <StatusBox tone="error" stale={stale}>
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <span className="grid min-w-0 gap-2">
          <strong className="font-semibold">{t.failedTitle}</strong>
          <span className="break-words text-muted-foreground">{job.error || t.failedUnknown}</span>
          <span className="flex flex-wrap gap-2">
            <LogLink job={job} prominent />
            {!stale && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw data-icon="inline-start" />
                {t.retry}
              </Button>
            )}
          </span>
        </span>
      </StatusBox>
    )
  }

  return <DoneCard job={job} cached={cached} stale={stale} effective={effective} />
}

function DoneCard({
  job,
  cached,
  stale,
  effective,
}: {
  job: AthenaBuildJob
  cached: boolean
  stale: boolean
  effective: readonly string[]
}) {
  const t = strings.build
  const duration = job.finished ? durationBetween(job.created, job.finished) : null
  const artifacts = [...job.artifacts].sort(
    (a, b) => Number(PRIMARY_ARTIFACTS.includes(b.name)) - Number(PRIMARY_ARTIFACTS.includes(a.name)),
  )
  const hasTypings = job.artifacts.some((a) => a.name === 'athena.d.ts')
  const differs = !stale && !sameIds(job.modules, effective)

  return (
    <div className={cn('grid grid-cols-1 gap-4 rounded-lg border border-success/40 bg-success/5 p-4 text-xs', stale && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        <CircleCheck className="size-4 text-success" aria-hidden />
        <strong className="text-sm font-semibold">{t.doneTitle}</strong>
        {cached && <Badge variant="secondary" className="font-mono text-[10px]">{t.cached}</Badge>}
        {stale && <StaleBadge />}
      </div>

      <div className="grid gap-2">
        {artifacts.map((a) => (
          <a
            key={a.name}
            href={artifactUrl(a.url)}
            download={a.name}
            className={cn(
              buttonVariants({ variant: PRIMARY_ARTIFACTS.includes(a.name) ? 'default' : 'outline', size: 'lg' }),
              'h-9 w-full justify-start font-mono text-xs',
            )}
          >
            <Download data-icon="inline-start" />
            {t.download(a.name)}
          </a>
        ))}
      </div>

      <div className="grid gap-1.5">
        <span className="text-[11px] text-muted-foreground">{t.modulesBuilt}</span>
        <span className="flex flex-wrap gap-1">
          {job.modules.map((id) => (
            <span key={id} className="rounded border px-1.5 py-0.5 font-mono text-[10px]">
              {id}
            </span>
          ))}
        </span>
        {differs && <span className="text-[11px] text-muted-foreground italic">{t.modulesDiffer}</span>}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
        {job.commit && (
          <>
            <dt className="text-muted-foreground">{t.commit}</dt>
            <dd>{shortCommit(job.commit)}</dd>
          </>
        )}
        {duration !== null && (
          <>
            <dt className="text-muted-foreground">{t.duration}</dt>
            <dd>{formatDuration(duration)}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <LogLink job={job} />
        <Button variant="outline" size="sm" onClick={() => copyText(buildLink(job.id), t.linkCopied)}>
          <Link2 data-icon="inline-start" />
          {t.copyLink}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-border/60 pt-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t.nextStep}</span>
        {job.runtime === 'quickjs' ? (
          <ul className="grid list-disc gap-1 pl-4 leading-5">
            <li>{t.nextQuickjs}</li>
            {hasTypings && <li>{t.nextTypings}</li>}
          </ul>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="leading-5">{t.nextNative}:</p>
              <CopyButton text={MAKEFILE_SNIPPET} label={t.copyMakefile} className="-mt-1 shrink-0" />
            </div>
            <pre className="overflow-x-auto rounded-lg border bg-background/80 p-3 font-mono text-[11px] leading-5">
              <code>{MAKEFILE_SNIPPET}</code>
            </pre>
          </>
        )}
      </div>
    </div>
  )
}

function LogLink({ job, prominent = false }: { job: AthenaBuildJob; prominent?: boolean }) {
  if (!job.log) return null
  return (
    <a
      href={artifactUrl(job.log)}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ variant: prominent ? 'secondary' : 'outline', size: 'sm' }), 'w-fit')}
    >
      <FileText data-icon="inline-start" />
      {strings.build.viewLog}
    </a>
  )
}

function StaleBadge() {
  return (
    <Badge variant="outline" className="font-mono text-[10px]">
      {strings.build.previousSelection}
    </Badge>
  )
}

function StatusBox({
  children,
  tone = 'neutral',
  stale = false,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'error'
  stale?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-2 rounded-lg border p-3 text-xs leading-5',
        tone === 'error' ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/30',
      )}
    >
      {stale && <StaleBadge />}
      <div className="flex items-start gap-2">{children}</div>
    </div>
  )
}
