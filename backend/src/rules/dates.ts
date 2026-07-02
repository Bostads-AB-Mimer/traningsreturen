/**
 * Pure calendar-date helpers operating on `YYYY-MM-DD` strings.
 * All balance rules are calendar-day based (no times, no time zones),
 * so dates are kept as strings and only converted for arithmetic.
 */

export type IsoDate = string

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  const d = parseIsoDate(value)
  return toIsoDate(d) === value
}

export function parseIsoDate(value: IsoDate): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y as number, (m as number) - 1, d as number)
}

export function toIsoDate(d: Date): IsoDate {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

/** Monday of the ISO week the date falls in — the week cap window is Mon–Sun. */
export function mondayOf(date: IsoDate): IsoDate {
  const d = parseIsoDate(date)
  const daysSinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return toIsoDate(d)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(date)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = parseIsoDate(date)
  d.setMonth(d.getMonth() + months)
  return toIsoDate(d)
}
