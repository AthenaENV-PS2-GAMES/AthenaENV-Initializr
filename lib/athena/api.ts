import type {
  AthenaBuildJob,
  AthenaBuildRequest,
  AthenaCatalog,
  AthenaCatalogModule,
  AthenaRuntime,
  AthenaServerCatalog,
} from "./types"
import { isRuntime } from "./selection"
import type { MockBackend } from "./mock"

// Next.js inlines NEXT_PUBLIC_* only when referenced literally.
const BUILD_API = (process.env.NEXT_PUBLIC_ATHENA_BUILD_API ?? "").trim().replace(/\/+$/, "")
const CATALOG_URL =
  (process.env.NEXT_PUBLIC_ATHENA_CATALOG_URL ?? "").trim() || "https://athenaenv-ps2-games.github.io/AthenaEnv/catalog.json"
const MOCK_FLAG = process.env.NEXT_PUBLIC_ATHENA_MOCK

export const SERVER_CATALOG_TIMEOUT_MS = 5_000
const STATIC_CATALOG_TIMEOUT_MS = 15_000
const REQUEST_TIMEOUT_MS = 30_000
export const POLL_INTERVAL_MS = 3_000
export const POLL_TIMEOUT_MS = 15 * 60_000
/** Consecutive network failures tolerated while polling before giving up. */
const POLL_MAX_FAILURES = 3

/** What each runtime produces, for local mode where the server cannot tell us. */
export const LOCAL_ARTIFACTS: Record<AthenaRuntime, string[]> = {
  quickjs: ["athena.elf", "athena.d.ts"],
  native: ["athena-sdk.tar.gz"],
}

/** The simulated backend: only with NEXT_PUBLIC_ATHENA_MOCK=1 or inside the v0 preview. */
export function isMockEnabled(): boolean {
  if (MOCK_FLAG === "1") return true
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  return host.endsWith(".vusercontent.net") || /(^|\.)v0\.(dev|app)$/.test(host)
}

// --- errors ----------------------------------------------------------------

/** HTTP error or network failure talking to the build server. */
export class BuildApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or null for a network error or timeout. */
    readonly status: number | null,
    /** `AthenaApiError.error` from the response body, when there was one. */
    readonly serverMessage: string | null,
  ) {
    super(message)
    this.name = "BuildApiError"
  }
}

/** catalog.json has a schemaVersion this page does not understand. */
export class CatalogSchemaError extends Error {
  constructor(readonly found: unknown) {
    super(`Unsupported catalog schemaVersion: ${String(found)}`)
    this.name = "CatalogSchemaError"
  }
}

/** Neither the build server nor the static catalog could be loaded. */
export class CatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CatalogUnavailableError"
  }
}

export class PollTimeoutError extends Error {
  constructor(readonly job: AthenaBuildJob) {
    super("Gave up waiting for the build")
    this.name = "PollTimeoutError"
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

// --- fetch helpers ---------------------------------------------------------

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError")
}

/** fetch with a timeout that is reported as a network error, not an abort. */
async function request(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  if (signal?.aborted) throw abortError()
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (signal?.aborted) throw abortError()
    const message = timedOut ? `Request timed out after ${timeoutMs / 1000} s` : (error as Error).message
    throw new BuildApiError(message, null, null)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function apiErrorFrom(response: Response, body: unknown): BuildApiError {
  const serverMessage =
    body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : null
  return new BuildApiError(`HTTP ${response.status}`, response.status, serverMessage)
}

// --- validation ------------------------------------------------------------

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []

/** Guards against malformed entries so one bad module cannot break the page. */
function sanitizeModules(value: unknown): AthenaCatalogModule[] | null {
  if (!Array.isArray(value)) return null
  return value
    .filter((m): m is AthenaCatalogModule => !!m && typeof m === "object" && typeof m.id === "string")
    .map((m) => ({
      ...m,
      name: typeof m.name === "string" ? m.name : m.id,
      description: typeof m.description === "string" ? m.description : "",
      category: typeof m.category === "string" && m.category ? m.category : "Other",
      version: typeof m.version === "string" ? m.version : "",
      required: m.required === true,
      default: m.default === true,
      dependencies: {
        modules: asStrings(m.dependencies?.modules),
        iop: asStrings(m.dependencies?.iop),
        ee_libs: asStrings(m.dependencies?.ee_libs),
      },
      global_alias: typeof m.global_alias === "string" ? m.global_alias : null,
      api: { native: m.api?.native === true, quickjs: m.api?.quickjs === true },
    }))
}

function sanitizeCatalog(body: unknown): AthenaCatalog | null {
  if (!body || typeof body !== "object") return null
  const raw = body as Partial<AthenaCatalog>
  const modules = sanitizeModules(raw.modules)
  if (!modules) return null
  return {
    schemaVersion: 1,
    name: typeof raw.name === "string" ? raw.name : "",
    version: typeof raw.version === "string" ? raw.version : "",
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
    modules,
  }
}

function sanitizeJob(body: unknown): AthenaBuildJob {
  const job = body as Partial<AthenaBuildJob> | null
  if (!job || typeof job !== "object" || typeof job.id !== "string" || typeof job.status !== "string") {
    throw new BuildApiError("Malformed build response", null, null)
  }
  if (job.schemaVersion !== 1) {
    throw new BuildApiError(`Unsupported build schemaVersion: ${String(job.schemaVersion)}`, null, null)
  }
  return {
    ...(job as AthenaBuildJob),
    modules: asStrings(job.modules),
    requested: asStrings(job.requested),
    artifacts: Array.isArray(job.artifacts)
      ? job.artifacts.filter((a) => a && typeof a.name === "string" && typeof a.url === "string")
      : [],
    log: typeof job.log === "string" ? job.log : "",
    position: typeof job.position === "number" ? job.position : 0,
    error: typeof job.error === "string" ? job.error : null,
    finished: typeof job.finished === "string" ? job.finished : null,
  }
}

// --- catalog ---------------------------------------------------------------

export interface ServerInfo {
  commit: string
  runtimes: AthenaRuntime[]
  artifacts: Record<AthenaRuntime, string[]>
  /** True when the simulated backend stands in for a build server. */
  mock: boolean
}

export interface LoadedCatalog {
  catalog: AthenaCatalog
  /** null = local mode (no build server). */
  server: ServerInfo | null
  /** Where the modules came from. */
  source: "server" | "static" | "fixture"
}

let mockBackend: MockBackend | null = null

async function loadServerCatalog(signal?: AbortSignal): Promise<{ catalog: AthenaCatalog; server: ServerInfo } | null> {
  if (!BUILD_API) return null
  try {
    const response = await request(`${BUILD_API}/api/catalog`, {}, SERVER_CATALOG_TIMEOUT_MS, signal)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = (await readJson(response)) as Partial<AthenaServerCatalog> | null
    if (body?.schemaVersion !== 1) {
      console.warn(
        `[athena] Build server catalog has schemaVersion ${String(body?.schemaVersion)}; only 1 is supported. Using local mode.`,
      )
      return null
    }
    const catalog = sanitizeCatalog(body)
    const runtimes = asStrings(body.runtimes).filter(isRuntime)
    if (!catalog || !runtimes.length) throw new Error("Malformed /api/catalog response")
    const artifacts = {
      quickjs: asStrings(body.artifacts?.quickjs),
      native: asStrings(body.artifacts?.native),
    }
    return {
      catalog,
      server: { commit: typeof body.commit === "string" ? body.commit : "", runtimes, artifacts, mock: false },
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    console.warn(`[athena] Build server unavailable at ${BUILD_API}: ${(error as Error).message}. Using local mode.`)
    return null
  }
}

async function loadStaticCatalog(signal?: AbortSignal): Promise<AthenaCatalog> {
  let body: unknown
  try {
    const response = await request(CATALOG_URL, {}, STATIC_CATALOG_TIMEOUT_MS, signal)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    body = await readJson(response)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new CatalogUnavailableError(`${CATALOG_URL}: ${(error as Error).message}`)
  }
  const version = (body as { schemaVersion?: unknown } | null)?.schemaVersion
  if (version !== 1) throw new CatalogSchemaError(version)
  const catalog = sanitizeCatalog(body)
  if (!catalog) throw new CatalogUnavailableError(`${CATALOG_URL}: malformed catalog`)
  return catalog
}

/**
 * The build server's catalog when it is reachable (the only source of modules
 * then), otherwise the static catalog.json in local mode. In mock mode the
 * bundled fixture replaces an unreachable catalog.json and a simulated build
 * server replaces an unreachable real one.
 */
export async function loadCatalog(signal?: AbortSignal): Promise<LoadedCatalog> {
  mockBackend = null
  const fromServer = await loadServerCatalog(signal)
  if (fromServer) return { ...fromServer, source: "server" }

  const mock = isMockEnabled()
  let catalog: AthenaCatalog
  let source: LoadedCatalog["source"] = "static"
  try {
    catalog = await loadStaticCatalog(signal)
  } catch (error) {
    if (!mock || !(error instanceof CatalogUnavailableError)) throw error
    console.warn(`[athena] ${error.message}. Using the bundled fixture (mock mode).`)
    catalog = (await import("@/fixtures/catalog.json")).default as AthenaCatalog
    source = "fixture"
  }

  if (!mock) return { catalog, server: null, source }

  const { createMockBackend } = await import("./mock")
  mockBackend = createMockBackend(catalog, LOCAL_ARTIFACTS)
  const info = mockBackend.catalog
  return {
    catalog,
    server: { commit: info.commit, runtimes: info.runtimes, artifacts: info.artifacts, mock: true },
    source,
  }
}

// --- builds ----------------------------------------------------------------

/** POST /api/builds. 202 = queued/building (or joined an identical job), 200 = cached. */
export async function submitBuild(body: AthenaBuildRequest, signal?: AbortSignal): Promise<AthenaBuildJob> {
  if (mockBackend) return mockBackend.submitBuild(body, signal)
  if (!BUILD_API) throw new BuildApiError("No build server configured", null, null)
  const response = await request(
    `${BUILD_API}/api/builds`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    REQUEST_TIMEOUT_MS,
    signal,
  )
  const json = await readJson(response)
  if (response.status !== 200 && response.status !== 202) throw apiErrorFrom(response, json)
  return sanitizeJob(json)
}

/** GET /api/builds/{id}. */
export async function getBuild(id: string, signal?: AbortSignal): Promise<AthenaBuildJob> {
  if (mockBackend) return mockBackend.getBuild(id, signal)
  if (!BUILD_API) throw new BuildApiError("No build server configured", null, null)
  const response = await request(
    `${BUILD_API}/api/builds/${encodeURIComponent(id)}`,
    {},
    REQUEST_TIMEOUT_MS,
    signal,
  )
  const json = await readJson(response)
  if (!response.ok) throw apiErrorFrom(response, json)
  return sanitizeJob(json)
}

export function isActive(job: AthenaBuildJob): boolean {
  return job.status === "queued" || job.status === "building"
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

export interface PollOptions {
  signal?: AbortSignal
  /** Called with every job fetched, including the final one. */
  onUpdate?: (job: AthenaBuildJob) => void
  intervalMs?: number
  timeoutMs?: number
}

/**
 * Polls GET /api/builds/{id} every 3 s while the job is queued or building and
 * resolves with the finished ("done" or "failed") job. Rejects with an
 * AbortError when `signal` aborts, PollTimeoutError after `timeoutMs`, or the
 * last BuildApiError after repeated failures (404 fails immediately).
 */
export async function pollBuild(job: AthenaBuildJob, options: PollOptions = {}): Promise<AthenaBuildJob> {
  const { signal, onUpdate, intervalMs = POLL_INTERVAL_MS, timeoutMs = POLL_TIMEOUT_MS } = options
  const deadline = Date.now() + timeoutMs
  let current = job
  let failures = 0
  while (isActive(current)) {
    if (Date.now() >= deadline) throw new PollTimeoutError(current)
    await sleep(intervalMs, signal)
    try {
      current = await getBuild(current.id, signal)
      failures = 0
      onUpdate?.(current)
    } catch (error) {
      if (isAbortError(error)) throw error
      const status = error instanceof BuildApiError ? error.status : null
      if ((status !== null && status < 500) || ++failures >= POLL_MAX_FAILURES) throw error
    }
  }
  return current
}

/** Absolute URL of a server-relative path (`artifacts[].url`, `log`). */
export function artifactUrl(path: string): string {
  if (mockBackend) return mockBackend.artifactUrl(path)
  if (/^https?:\/\//i.test(path)) return path
  return `${BUILD_API}${path.startsWith("/") ? "" : "/"}${path}`
}
