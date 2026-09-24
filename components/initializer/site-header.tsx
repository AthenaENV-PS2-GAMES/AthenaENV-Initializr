import { ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme'
import type { ServerInfo } from '@/lib/athena/api'
import { formatDate, shortCommit } from '@/lib/athena/format'
import type { AthenaCatalog } from '@/lib/athena/types'
import { strings } from '@/lib/strings'
import { cn } from '@/lib/utils'

export const GITHUB_URL = 'https://github.com/GibranKhalil/AthenaEnv'

/** Catalog and server details; `catalog` is null while loading or on error. */
export function SiteHeader({ catalog, server }: { catalog: AthenaCatalog | null; server: ServerInfo | null }) {
  const generated = catalog ? formatDate(catalog.generatedAt) : null
  const t = strings.header

  return (
    <header className="border-b border-border/70 bg-card/70">
      <div className="h-0.5 bg-gradient-to-r from-ps2 via-ps2/40 to-transparent" aria-hidden />
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center border border-primary/50 bg-primary/10 p-1">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/229382275-C12ycPyLnS0kuYyrBoDJd3qBgc1a9S.png"
              alt={t.logoAlt}
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-mono text-lg font-bold tracking-tight">
              {t.name} <span className="text-primary">{t.product}</span>
            </h1>
            {catalog && (
              <p className="flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>{t.catalogVersion(catalog.version)}</span>
                {generated && <span>· {t.generatedAt(generated)}</span>}
              </p>
            )}
          </div>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          {catalog && <ServerStatus server={server} />}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t.githubLabel}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'font-mono text-xs')}
          >
            <ExternalLink data-icon="inline-start" />
            {t.github}
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}

function ServerStatus({ server }: { server: ServerInfo | null }) {
  const t = strings.header
  if (!server) {
    return (
      <span className="flex items-center gap-1.5 px-2 font-mono text-[11px] text-muted-foreground">
        <span className="size-2 rounded-full bg-muted-foreground/60" aria-hidden />
        {t.localMode}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 px-2 font-mono text-[11px] text-muted-foreground">
      <span className={cn('size-2 rounded-full', server.mock ? 'bg-warning' : 'bg-ps2')} aria-hidden />
      <span>{server.mock ? t.mockServer : t.serverOnline}</span>
      {server.commit && <span className="hidden sm:inline">· {t.commit(shortCommit(server.commit))}</span>}
    </span>
  )
}
