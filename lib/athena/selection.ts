import type { AthenaCatalogModule, AthenaRuntime } from "./types"

export const RUNTIMES: readonly AthenaRuntime[] = ["quickjs", "native"]

export function isRuntime(value: unknown): value is AthenaRuntime {
  return value === "quickjs" || value === "native"
}

export type PresetId = "defaults" | "minimal" | "all" | "usbGame"

export const PRESET_IDS: readonly PresetId[] = ["defaults", "minimal", "all", "usbGame"]

const USB_GAME = ["screen", "draw", "font", "image", "gamepad", "usbmass", "timer"]

/**
 * The checked ids a preset produces. Required modules are never "checked":
 * they are always in the build and cannot be toggled.
 */
export function presetSelection(modules: readonly AthenaCatalogModule[], preset: PresetId): string[] {
  const optional = modules.filter((m) => !m.required)
  switch (preset) {
    case "defaults":
      return normalizeChecked(modules, optional.filter((m) => m.default).map((m) => m.id))
    case "minimal":
      return []
    case "all":
      return normalizeChecked(modules, optional.map((m) => m.id))
    case "usbGame":
      return normalizeChecked(modules, USB_GAME)
  }
}

/** Drops unknown and required ids, dedupes and sorts. */
export function normalizeChecked(modules: readonly AthenaCatalogModule[], ids: Iterable<string>): string[] {
  const optional = new Set(modules.filter((m) => !m.required).map((m) => m.id))
  return [...new Set(ids)].filter((id) => optional.has(id)).sort()
}

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((id, i) => id === sb[i])
}

export const BOOT_DEVICE_MODULES = ["memcard", "usbmass", "cdrom"]

export interface SelectionWarnings {
  noBootDevice: boolean
  erl: boolean
}

export function selectionWarnings(effective: ReadonlySet<string> | ReadonlyMap<string, unknown>): SelectionWarnings {
  return {
    noBootDevice: !BOOT_DEVICE_MODULES.some((id) => effective.has(id)),
    erl: effective.has("erl"),
  }
}

/** `--modules=` argument for tools/modules.js: the checked ids, or `system` when none. */
export function modulesArgument(checked: readonly string[]): string {
  return checked.length ? [...checked].sort().join(",") : "system"
}

export function localBuildCommands(runtime: AthenaRuntime, checked: readonly string[]): string {
  const configure = `node tools/modules.js configure --modules=${modulesArgument(checked)}`
  return runtime === "native" ? `${configure}\nmake sdk RUNTIME=native` : `${configure}\nmake`
}

// --- URL state -------------------------------------------------------------

const BUILD_ID = /^[0-9a-f]{64}$/

export interface UrlState {
  runtime: AthenaRuntime | null
  /** null when the parameter is absent (use the defaults); [] when present but empty. */
  modules: string[] | null
  build: string | null
}

export function readUrlState(search: string): UrlState {
  const params = new URLSearchParams(search)
  const runtime = params.get("runtime")
  const modules = params.get("modules")
  const build = params.get("build")?.toLowerCase() ?? null
  return {
    runtime: isRuntime(runtime) ? runtime : null,
    modules: modules === null ? null : modules.split(",").map((s) => s.trim()).filter(Boolean),
    build: build && BUILD_ID.test(build) ? build : null,
  }
}

export function writeUrlState(state: { runtime: AthenaRuntime; checked: readonly string[]; build?: string | null }): string {
  const params = new URLSearchParams()
  params.set("runtime", state.runtime)
  params.set("modules", [...state.checked].sort().join(","))
  if (state.build) params.set("build", state.build)
  // Keep the commas readable in shared links.
  return `?${params.toString().replace(/%2C/g, ",")}`
}
