import { ChevronRight, ExternalLink, Terminal } from 'lucide-react'
import { localBuildCommands } from '@/lib/athena/selection'
import type { AthenaRuntime } from '@/lib/athena/types'
import { strings } from '@/lib/strings'
import { CopyButton } from './copy-button'

export const LOCAL_BUILD_ID = 'build-locally'
const DOCS_URL = 'https://github.com/GibranKhalil/AthenaEnv/blob/main/docs/BUILDING_ATHENA.md'

/** Always visible; collapsible (closed by default) when a build server is available. */
export function LocalBuildCommands({
  runtime,
  checked,
  collapsible,
}: {
  runtime: AthenaRuntime
  checked: readonly string[]
  collapsible: boolean
}) {
  const t = strings.local
  const commands = localBuildCommands(runtime, checked)

  const body = (
    <div className="grid grid-cols-1 gap-3 px-4 pb-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t.intro}</p>
        <CopyButton text={commands} label={t.copy} successMessage={t.copied} className="-mt-1 shrink-0" />
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-background/80 p-3 font-mono text-xs leading-6">
        <code>{commands}</code>
      </pre>
      <a
        href={DOCS_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 rounded text-xs text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t.docs}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </div>
  )

  const heading = (
    <span className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest">
      <Terminal className="size-4 text-primary" aria-hidden />
      {t.title}
    </span>
  )

  return (
    <section id={LOCAL_BUILD_ID} aria-label={t.title} className="scroll-mt-5 rounded-xl bg-card/60 ring-1 ring-foreground/10">
      {collapsible ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            {heading}
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          {body}
        </details>
      ) : (
        <>
          <h2 className="p-4">{heading}</h2>
          {body}
        </>
      )}
    </section>
  )
}
