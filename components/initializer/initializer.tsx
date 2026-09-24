'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { CircleAlert, FlaskConical, Loader2, RotateCcw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  BuildApiError,
  CatalogSchemaError,
  getBuild,
  isAbortError,
  isActive,
  loadCatalog,
  LOCAL_ARTIFACTS,
  pollBuild,
  PollTimeoutError,
  submitBuild,
  type LoadedCatalog,
} from '@/lib/athena/api'
import { includedBy, resolveModules } from '@/lib/athena/resolve'
import {
  isRuntime,
  normalizeChecked,
  PRESET_IDS,
  presetSelection,
  readUrlState,
  RUNTIMES,
  sameIds,
  selectionWarnings,
  writeUrlState,
  type PresetId,
} from '@/lib/athena/selection'
import type { AthenaBuildJob, AthenaCatalogModule, AthenaRuntime } from '@/lib/athena/types'
import { strings } from '@/lib/strings'
import { BuildPanel, type BuildKey, type BuildState } from './build-panel'
import { LocalBuildCommands } from './local-build-commands'
import { ModuleGrid } from './module-grid'
import { Presets } from './presets'
import { RuntimeSelector } from './runtime-selector'
import { SelectionSummary } from './selection-summary'
import { SiteHeader } from './site-header'
import { Warnings } from './warnings'

const RUNTIME_STORAGE_KEY = 'athena-initializer-runtime'

function readStoredRuntime(): AthenaRuntime | null {
  try {
    const value = localStorage.getItem(RUNTIME_STORAGE_KEY)
    return isRuntime(value) ? value : null
  } catch {
    return null
  }
}

function storeRuntime(runtime: AthenaRuntime) {
  try {
    localStorage.setItem(RUNTIME_STORAGE_KEY, runtime)
  } catch {
    // Storage unavailable: the runtime is still in the URL.
  }
}

// --- state -----------------------------------------------------------------

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; kind: 'schema' | 'unavailable'; detail: string }
  | { status: 'ready'; data: LoadedCatalog }

interface State {
  load: LoadState
  runtime: AthenaRuntime
  /** Ids the user checked (never required ones), sorted. */
  checked: string[]
  query: string
  category: string | null
  build: BuildState
}

type Action =
  | { type: 'loadStart' }
  | { type: 'loadOk'; data: LoadedCatalog; runtime: AthenaRuntime; checked: string[] }
  | { type: 'loadError'; kind: 'schema' | 'unavailable'; detail: string }
  | { type: 'setRuntime'; runtime: AthenaRuntime }
  | { type: 'toggle'; id: string }
  | { type: 'setChecked'; checked: string[] }
  | { type: 'setQuery'; query: string }
  | { type: 'setCategory'; category: string | null }
  | { type: 'buildSubmit'; key: BuildKey }
  | { type: 'buildLoading'; id: string }
  /** `adoptSelection`: take runtime and modules from the job (opening a ?build= link). */
  | { type: 'buildJob'; job: AthenaBuildJob; cached?: boolean; adoptSelection?: boolean }
  | { type: 'buildTimeout'; job: AthenaBuildJob }
  | { type: 'buildError'; title: string; message: string; key: BuildKey | null }

const initialState: State = {
  load: { status: 'loading' },
  runtime: 'quickjs',
  checked: [],
  query: '',
  category: null,
  build: { phase: 'idle' },
}

function catalogModules(state: State): AthenaCatalogModule[] {
  return state.load.status === 'ready' ? state.load.data.catalog.modules : []
}

function availableRuntimes(state: State): readonly AthenaRuntime[] {
  return state.load.status === 'ready' ? (state.load.data.server?.runtimes ?? RUNTIMES) : RUNTIMES
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loadStart':
      return { ...state, load: { status: 'loading' } }
    case 'loadOk':
      return { ...state, load: { status: 'ready', data: action.data }, runtime: action.runtime, checked: action.checked }
    case 'loadError':
      return { ...state, load: { status: 'error', kind: action.kind, detail: action.detail } }
    case 'setRuntime':
      return { ...state, runtime: action.runtime }
    case 'toggle': {
      const inclusion = resolveModules(catalogModules(state), state.checked).get(action.id)
      if (inclusion === 'required' || inclusion === 'dependency') return state
      const checked = state.checked.includes(action.id)
        ? state.checked.filter((id) => id !== action.id)
        : normalizeChecked(catalogModules(state), [...state.checked, action.id])
      return { ...state, checked }
    }
    case 'setChecked':
      return { ...state, checked: action.checked }
    case 'setQuery':
      return { ...state, query: action.query }
    case 'setCategory':
      return { ...state, category: action.category }
    case 'buildSubmit':
      return { ...state, build: { phase: 'submitting', key: action.key } }
    case 'buildLoading':
      return { ...state, build: { phase: 'loading', id: action.id } }
    case 'buildJob': {
      const { job } = action
      const prev = state.build
      const cached = action.cached ?? (prev.phase === 'job' && prev.job.id === job.id && prev.cached)
      const next: State = { ...state, build: { phase: 'job', job, cached } }
      if (action.adoptSelection) {
        if (availableRuntimes(state).includes(job.runtime)) next.runtime = job.runtime
        next.checked = normalizeChecked(catalogModules(state), job.requested)
      }
      return next
    }
    case 'buildTimeout':
      return { ...state, build: { phase: 'timeout', job: action.job } }
    case 'buildError':
      return { ...state, build: { phase: 'error', title: action.title, message: action.message, key: action.key } }
  }
}

function sameKey(a: BuildKey, b: BuildKey): boolean {
  return a.runtime === b.runtime && sameIds(a.modules, b.modules)
}

/** The selection a build state belongs to, if any. */
function buildKeyOf(build: BuildState, modules: readonly AthenaCatalogModule[]): BuildKey | null {
  switch (build.phase) {
    case 'submitting':
      return build.key
    case 'job':
    case 'timeout':
      return { runtime: build.job.runtime, modules: normalizeChecked(modules, build.job.requested) }
    case 'error':
      return build.key
    default:
      return null
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof BuildApiError) {
    if (error.serverMessage) return error.serverMessage
    if (error.status !== null) return strings.build.errorStatus(error.status)
  }
  return strings.build.errorGeneric
}

// --- page ------------------------------------------------------------------

export function Initializer() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [loadNonce, retryLoad] = useReducer((n: number) => n + 1, 0)
  const controllerRef = useRef<AbortController | null>(null)
  const submittingRef = useRef(false)

  const loaded = state.load.status === 'ready' ? state.load.data : null
  const modules = loaded?.catalog.modules ?? []
  const server = loaded?.server ?? null

  /** Follows a job until it finishes, fails, times out or is superseded. */
  const follow = useCallback(async (job: AthenaBuildJob, signal: AbortSignal) => {
    if (!isActive(job)) return
    try {
      await pollBuild(job, { signal, onUpdate: (next) => dispatch({ type: 'buildJob', job: next }) })
    } catch (error) {
      if (isAbortError(error)) return
      if (error instanceof PollTimeoutError) {
        dispatch({ type: 'buildTimeout', job: error.job })
        return
      }
      dispatch({ type: 'buildError', title: strings.build.errorTitle, message: errorMessage(error), key: null })
    }
  }, [])

  const startBuild = useCallback(
    async (key: BuildKey) => {
      if (submittingRef.current) return
      submittingRef.current = true
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      dispatch({ type: 'buildSubmit', key })
      let job: AthenaBuildJob
      try {
        job = await submitBuild({ modules: key.modules, runtime: key.runtime }, controller.signal)
      } catch (error) {
        if (!isAbortError(error)) {
          dispatch({ type: 'buildError', title: strings.build.errorTitle, message: errorMessage(error), key })
        }
        return
      } finally {
        submittingRef.current = false
      }
      dispatch({ type: 'buildJob', job, cached: job.status === 'done' })
      await follow(job, controller.signal)
    },
    [follow],
  )

  const openBuild = useCallback(
    async (id: string, adoptSelection: boolean) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      dispatch({ type: 'buildLoading', id })
      try {
        const job = await getBuild(id, controller.signal)
        dispatch({ type: 'buildJob', job, adoptSelection })
        await follow(job, controller.signal)
      } catch (error) {
        if (isAbortError(error)) return
        dispatch({ type: 'buildError', title: strings.build.loadErrorTitle, message: errorMessage(error), key: null })
      }
    },
    [follow],
  )

  // Load the catalog (again on retry), then restore the URL state.
  useEffect(() => {
    const controller = new AbortController()
    dispatch({ type: 'loadStart' })
    loadCatalog(controller.signal)
      .then((data) => {
        const url = readUrlState(window.location.search)
        const runtimes = data.server?.runtimes ?? RUNTIMES
        let runtime = url.runtime ?? readStoredRuntime() ?? 'quickjs'
        if (!runtimes.includes(runtime)) runtime = runtimes[0]
        const mods = data.catalog.modules
        const checked = url.modules ? normalizeChecked(mods, url.modules) : presetSelection(mods, 'defaults')
        dispatch({ type: 'loadOk', data, runtime, checked })

        if (url.build) {
          if (data.server) openBuild(url.build, url.modules === null && url.runtime === null)
          else dispatch({ type: 'buildError', title: strings.build.loadErrorTitle, message: strings.build.offlineJob, key: null })
        }
      })
      .catch((error) => {
        if (isAbortError(error)) return
        if (error instanceof CatalogSchemaError) {
          dispatch({ type: 'loadError', kind: 'schema', detail: String(error.found) })
        } else {
          dispatch({ type: 'loadError', kind: 'unavailable', detail: (error as Error).message })
        }
      })
    return () => controller.abort()
  }, [loadNonce, openBuild])

  // Stop polling when the page goes away.
  useEffect(() => () => controllerRef.current?.abort(), [])

  // --- derived state -------------------------------------------------------

  const inclusion = useMemo(() => resolveModules(modules, state.checked), [modules, state.checked])
  const effective = useMemo(() => [...inclusion.keys()].sort(), [inclusion])
  const includedByMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const [id, kind] of inclusion) if (kind === 'dependency') map.set(id, includedBy(modules, state.checked, id))
    return map
  }, [modules, state.checked, inclusion])
  const warnings = useMemo(() => selectionWarnings(inclusion), [inclusion])
  const activePreset = useMemo<PresetId | null>(
    () => PRESET_IDS.find((p) => sameIds(presetSelection(modules, p), state.checked)) ?? null,
    [modules, state.checked],
  )

  const currentKey: BuildKey = useMemo(
    () => ({ runtime: state.runtime, modules: state.checked }),
    [state.runtime, state.checked],
  )
  const buildKey = buildKeyOf(state.build, modules)
  const stale = buildKey !== null && !sameKey(buildKey, currentKey)
  const phase = state.build.phase
  const canBuild =
    server !== null && phase !== 'submitting' && phase !== 'loading' && !(phase === 'job' && !stale)

  // Mirror the selection (and the build shown for it) in the URL.
  const shownBuildId =
    state.build.phase === 'loading'
      ? state.build.id
      : (state.build.phase === 'job' || state.build.phase === 'timeout') && !stale
        ? state.build.job.id
        : null
  useEffect(() => {
    if (!loaded) return
    const search = writeUrlState({ runtime: state.runtime, checked: state.checked, build: shownBuildId })
    if (search !== window.location.search) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`)
    }
  }, [loaded, state.runtime, state.checked, shownBuildId])

  const onToggle = useCallback((id: string) => dispatch({ type: 'toggle', id }), [])
  const onRuntime = (runtime: AthenaRuntime) => {
    storeRuntime(runtime)
    dispatch({ type: 'setRuntime', runtime })
  }
  const onRetry = () => {
    if (state.build.phase === 'job') startBuild({ runtime: state.build.job.runtime, modules: state.build.job.requested })
  }

  // --- render --------------------------------------------------------------

  return (
    <TooltipProvider delay={300}>
      <main className="min-h-screen bg-background font-sans text-foreground">
        <SiteHeader catalog={loaded?.catalog ?? null} server={server} />

        {state.load.status === 'loading' && (
          <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-4 py-16 font-mono text-xs text-muted-foreground sm:px-5" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {strings.loading}
          </div>
        )}

        {state.load.status === 'error' && (
          <div className="mx-auto max-w-xl px-4 py-16 sm:px-5">
            <div role="alert" className="grid gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <CircleAlert className="size-4 text-destructive" aria-hidden />
                {state.load.kind === 'schema' ? strings.catalogError.schemaTitle : strings.catalogError.unavailableTitle}
              </h2>
              <p className="text-sm text-muted-foreground">
                {state.load.kind === 'schema'
                  ? strings.catalogError.schemaBody(state.load.detail)
                  : strings.catalogError.unavailableBody}
              </p>
              {state.load.kind === 'unavailable' && (
                <p className="break-words font-mono text-[11px] text-muted-foreground">
                  {strings.catalogError.details}: {state.load.detail}
                </p>
              )}
              <Button variant="outline" onClick={retryLoad} className="w-fit">
                <RotateCcw data-icon="inline-start" />
                {strings.catalogError.retry}
              </Button>
            </div>
          </div>
        )}

        {loaded && (
          <>
            {(!server || server.mock) && (
              <div className="mx-auto max-w-[1500px] px-4 pt-4 sm:px-5">
                <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {server?.mock ? <FlaskConical className="size-4 shrink-0 text-warning" aria-hidden /> : <WifiOff className="size-4 shrink-0" aria-hidden />}
                  {server?.mock ? strings.mockBanner : strings.offlineBanner}
                </p>
              </div>
            )}

            <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
              <section className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{strings.intro.tagline}</p>
                <ModuleGrid
                  modules={modules}
                  inclusion={inclusion}
                  includedByMap={includedByMap}
                  query={state.query}
                  category={state.category}
                  onQueryChange={(query) => dispatch({ type: 'setQuery', query })}
                  onCategoryChange={(category) => dispatch({ type: 'setCategory', category })}
                  onToggle={onToggle}
                />
              </section>

              <aside className="order-1 flex min-w-0 flex-col gap-5 lg:sticky lg:top-0 lg:order-2 lg:-mx-1 lg:-my-5 lg:max-h-screen lg:overflow-y-auto lg:px-1 lg:py-5">
                <Card className="border-primary/30 bg-card/70">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <CardTitle>
                      <h2 className="font-mono text-sm uppercase tracking-widest">{strings.config.title}</h2>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-5 pt-1">
                    <RuntimeSelector
                      runtimes={server?.runtimes ?? RUNTIMES}
                      artifacts={server?.artifacts ?? LOCAL_ARTIFACTS}
                      value={state.runtime}
                      onChange={onRuntime}
                    />
                    <Presets
                      active={activePreset}
                      onApply={(preset) => dispatch({ type: 'setChecked', checked: presetSelection(modules, preset) })}
                    />
                    <SelectionSummary inclusion={inclusion} total={modules.length} />
                    <Warnings warnings={warnings} runtime={state.runtime} />
                    <BuildPanel
                      server={server}
                      build={state.build}
                      stale={stale}
                      canBuild={canBuild}
                      effective={effective}
                      onBuild={() => startBuild(currentKey)}
                      onRetry={onRetry}
                    />
                  </CardContent>
                </Card>
                <LocalBuildCommands runtime={state.runtime} checked={state.checked} collapsible={server !== null} />
              </aside>
            </div>
          </>
        )}
      </main>
    </TooltipProvider>
  )
}
