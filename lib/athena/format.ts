import { strings } from "@/lib/strings"

export function shortCommit(commit: string): string {
  return commit.slice(0, 8)
}

/** "42 s" or "1 min 5 s"; negative spans (clock skew) count as zero. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes ? strings.duration.minutes(minutes, seconds) : strings.duration.seconds(seconds)
}

export function durationBetween(from: string, to: string): number | null {
  const a = Date.parse(from)
  const b = Date.parse(to)
  return Number.isNaN(a) || Number.isNaN(b) ? null : b - a
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

export function formatDate(iso: string): string | null {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? null : dateFormat.format(time)
}
