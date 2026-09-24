'use client'

import { useMemo } from 'react'
import { Package, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ModuleInclusion } from '@/lib/athena/resolve'
import type { AthenaCatalogModule } from '@/lib/athena/types'
import { strings } from '@/lib/strings'
import { ModuleCard } from './module-card'

const CATEGORY_ORDER = ['Core', 'Graphics', 'Input', 'Storage', 'Math', 'System']

/** Known categories in a fixed order, then any new ones alphabetically. */
export function sortCategories(categories: Iterable<string>): string[] {
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c)
    return i === -1 ? CATEGORY_ORDER.length : i
  }
  return [...new Set(categories)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

function matches(m: AthenaCatalogModule, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
}

const NO_IDS: readonly string[] = []

export function ModuleGrid({
  modules,
  inclusion,
  includedByMap,
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onToggle,
}: {
  modules: readonly AthenaCatalogModule[]
  inclusion: ReadonlyMap<string, ModuleInclusion>
  includedByMap: ReadonlyMap<string, string[]>
  query: string
  /** null = all categories. */
  category: string | null
  onQueryChange: (query: string) => void
  onCategoryChange: (category: string | null) => void
  onToggle: (id: string) => void
}) {
  const t = strings.grid
  const categories = useMemo(() => sortCategories(modules.map((m) => m.category)), [modules])

  const groups = useMemo(() => {
    const visible = modules.filter((m) => (category === null || m.category === category) && matches(m, query.trim()))
    return categories
      .map((c) => ({
        category: c,
        modules: visible.filter((m) => m.category === c).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.modules.length > 0)
  }, [modules, categories, category, query])

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>
            <h2 className="font-mono text-sm uppercase tracking-widest">{t.title}</h2>
          </CardTitle>
          <Package className="text-primary" aria-hidden />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
            className="pl-9 font-mono text-xs"
          />
        </div>
        <div role="group" aria-label={t.categoriesLabel} className="flex flex-wrap gap-1">
          {[null, ...categories].map((c) => (
            <Button
              key={c ?? '*'}
              variant={category === c ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={category === c}
              onClick={() => onCategoryChange(c)}
              className="font-mono text-xs"
            >
              {c ?? t.allCategories}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 pt-1">
        {groups.length ? (
          groups.map((g) => (
            <section key={g.category} aria-label={g.category} className="grid gap-3">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{g.category}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {g.modules.map((m) => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    inclusion={inclusion.get(m.id)}
                    includedBy={includedByMap.get(m.id) ?? NO_IDS}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center font-mono text-xs text-muted-foreground">
            {t.empty}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onQueryChange('')
                onCategoryChange(null)
              }}
            >
              {t.clearFilters}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
