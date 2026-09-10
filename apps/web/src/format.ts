/* Dates, rendered for whoever is reading rather than for whoever wrote the row.
 *
 * `undefined` as the locale throughout, on purpose — that is what asks the
 * browser for the user's own, rather than pinning everyone to one this code
 * happened to pick. Timestamps arrive as ISO 8601 strings, never as Date; see
 * the note on that in packages/shared/user.ts. */

/** An absolute date, optionally with the time. */
export function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
  }).format(date)
}

const DIVISIONS: { limit: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, unit: 'second' },
  { limit: 60, unit: 'minute' },
  { limit: 24, unit: 'hour' },
  { limit: 7, unit: 'day' },
  { limit: 4.35, unit: 'week' },
  { limit: 12, unit: 'month' },
  { limit: Infinity, unit: 'year' },
]

/** "3 days ago". What a list wants, because in a list the useful question is
 *  how recently something moved rather than on exactly which afternoon. */
export function formatRelative(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  let delta = (date.getTime() - Date.now()) / 1000

  for (const { limit, unit } of DIVISIONS) {
    if (Math.abs(delta) < limit) return formatter.format(Math.round(delta), unit)
    delta /= limit
  }
  return formatDate(iso)
}
