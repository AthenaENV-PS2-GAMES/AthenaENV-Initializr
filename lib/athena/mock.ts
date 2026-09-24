/**
 * Simulated build server for development and the v0 preview. Loaded only when
 * isMockEnabled() is true (see api.ts); never used silently in production.
 * A new build goes queued → building → done over about 6 seconds.
 */
import type {
  AthenaBuildJob,
  AthenaBuildRequest,
  AthenaCatalog,
  AthenaRuntime,
  AthenaServerCatalog,
} from "./types"
import { BuildApiError } from "./api"
import { resolveModules } from "./resolve"
import { isRuntime } from "./selection"

const QUEUED_MS = 1_500
const BUILD_MS = 6_000
const LATENCY_MS = 250
const MOCK_COMMIT = "0000000mock00000000000000000000000000000"

export interface MockBackend {
  catalog: AthenaServerCatalog
  submitBuild(body: AthenaBuildRequest, signal?: AbortSignal): Promise<AthenaBuildJob>
  getBuild(id: string, signal?: AbortSignal): Promise<AthenaBuildJob>
  artifactUrl(path: string): string
}

/** Deterministic 64-hex id (stand-in for the server's sha256; no secure context needed). */
function hashId(input: string): string {
  let out = ""
  for (let seed = 0; seed < 8; seed++) {
    let h = 0x811c9dc5 ^ (seed * 0x9e3779b1)
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    out += (h >>> 0).toString(16).padStart(8, "0")
  }
  return out
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true },
    )
  })
}

export function createMockBackend(source: AthenaCatalog, artifacts: Record<AthenaRuntime, string[]>): MockBackend {
  const catalog: AthenaServerCatalog = {
    ...source,
    commit: MOCK_COMMIT,
    runtimes: ["quickjs", "native"],
    artifacts,
  }
  const known = new Set(catalog.modules.map((m) => m.id))
  const jobs = new Map<string, { job: AthenaBuildJob; started: number }>()
  const blobUrls = new Map<string, string>()

  /** Derives the job's state from the time since it was submitted. */
  function snapshot(id: string): AthenaBuildJob {
    const entry = jobs.get(id)!
    const elapsed = Date.now() - entry.started
    const { job } = entry
    if (job.status === "done") return job
    if (elapsed >= BUILD_MS) {
      job.status = "done"
      job.position = 0
      job.finished = new Date(entry.started + BUILD_MS).toISOString()
      job.artifacts = artifacts[job.runtime].map((name) => ({ name, url: `/api/builds/${id}/${name}` }))
    } else if (elapsed >= QUEUED_MS) {
      job.status = "building"
      job.position = 0
    }
    return { ...job, artifacts: [...job.artifacts] }
  }

  return {
    catalog,

    async submitBuild(body, signal) {
      await delay(LATENCY_MS, signal)
      const runtime = body.runtime ?? "quickjs"
      if (!isRuntime(runtime)) throw new BuildApiError("HTTP 400", 400, `Unknown runtime: ${String(runtime)}`)
      const unknown = body.modules.filter((id) => !known.has(id))
      if (unknown.length) throw new BuildApiError("HTTP 400", 400, `Unknown module(s): ${unknown.join(", ")}`)

      const resolved = [...resolveModules(catalog.modules, body.modules).keys()].sort()
      const id = hashId(`${MOCK_COMMIT}|${runtime}|${resolved.join(",")}`)
      if (!jobs.has(id)) {
        const started = Date.now()
        jobs.set(id, {
          started,
          job: {
            schemaVersion: 1,
            id,
            status: "queued",
            position: 1,
            runtime,
            modules: resolved,
            requested: [...body.modules],
            commit: MOCK_COMMIT,
            created: new Date(started).toISOString(),
            finished: null,
            error: null,
            artifacts: [],
            log: `/api/builds/${id}/build.log`,
          },
        })
      }
      return snapshot(id)
    },

    async getBuild(id, signal) {
      await delay(LATENCY_MS, signal)
      if (!jobs.has(id)) throw new BuildApiError("HTTP 404", 404, "Unknown build (mock builds do not survive a reload)")
      return snapshot(id)
    },

    // Blob URLs (not data: URLs) so "View build log" can open in a new tab.
    artifactUrl(path) {
      let url = blobUrls.get(path)
      if (!url) {
        const text = `Mock AthenaEnv artifact: ${path}\n\nThis file was produced by the simulated build server (ATHENA_MOCK). It is not a real build.\n`
        url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
        blobUrls.set(path, url)
      }
      return url
    },
  }
}
