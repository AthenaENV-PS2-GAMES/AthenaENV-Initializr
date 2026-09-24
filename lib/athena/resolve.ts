import type { AthenaCatalogModule } from "./types"

/** Why a module is part of the effective build. Absent from the map = not included. */
export type ModuleInclusion = "required" | "selected" | "dependency"

type ModuleIndex = Map<string, AthenaCatalogModule>

function indexModules(modules: readonly AthenaCatalogModule[]): ModuleIndex {
  return new Map(modules.map((m) => [m.id, m]))
}

/** Depth-first walk of `dependencies.modules`; ids missing from the catalog are ignored. */
function visit(index: ModuleIndex, id: string, visited: Set<string>): void {
  if (visited.has(id)) return
  const mod = index.get(id)
  if (!mod) return
  visited.add(id)
  for (const dep of mod.dependencies.modules) visit(index, dep, visited)
}

/** Every module reachable from `id` through dependencies, `id` included. */
function closure(index: ModuleIndex, id: string): Set<string> {
  const visited = new Set<string>()
  visit(index, id, visited)
  return visited
}

/**
 * The effective module set, matching the build server: required modules, the
 * checked modules, and recursively their dependencies. Precedence when a module
 * qualifies twice: required > selected > dependency.
 */
export function resolveModules(
  modules: readonly AthenaCatalogModule[],
  checked: Iterable<string>,
): Map<string, ModuleInclusion> {
  const index = indexModules(modules)
  const result = new Map<string, ModuleInclusion>()

  const roots: string[] = []
  for (const m of modules) {
    if (m.required) {
      result.set(m.id, "required")
      roots.push(m.id)
    }
  }
  for (const id of checked) {
    if (!index.has(id)) continue
    if (!result.has(id)) result.set(id, "selected")
    roots.push(id)
  }

  const visited = new Set<string>()
  for (const id of roots) visit(index, id, visited)
  for (const id of visited) if (!result.has(id)) result.set(id, "dependency")

  return result
}

/**
 * The checked (or required) modules that pull `id` into the build, directly or
 * indirectly. Sorted; empty when nothing depends on it.
 */
export function includedBy(
  modules: readonly AthenaCatalogModule[],
  checked: Iterable<string>,
  id: string,
): string[] {
  const index = indexModules(modules)
  const roots = new Set<string>(modules.filter((m) => m.required).map((m) => m.id))
  for (const c of checked) if (index.has(c)) roots.add(c)
  roots.delete(id)

  return [...roots].filter((root) => closure(index, root).has(id)).sort()
}
