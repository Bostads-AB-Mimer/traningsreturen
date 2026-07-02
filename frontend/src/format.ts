/** Swedish date/time formatting — identical output to the prototype. */

export const MONTHS_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
]
export const MONTHS_FULL = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
]
export const DAYS_SHORT = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör']
export const DAYS_FULL = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y as number, (m as number) - 1, d as number)
}

export function toIsoDate(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function addDaysIso(date: string, days: number): string {
  const d = parseIsoDate(date)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

export function mondayOfIso(date: string): string {
  const d = parseIsoDate(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toIsoDate(d)
}

/** "12 okt 2026" */
export function fmtDate(iso: string): string {
  const d = parseIsoDate(iso)
  return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear()
}

/** "ons 12 okt" */
export function fmtDateShort(iso: string): string {
  const d = parseIsoDate(iso)
  return DAYS_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()]
}

/** "onsdag 1 juli 2026" */
export function fmtTodayLong(): string {
  const d = new Date()
  return (
    DAYS_FULL[d.getDay()] +
    ' ' +
    d.getDate() +
    ' ' +
    MONTHS_FULL[d.getMonth()] +
    ' ' +
    d.getFullYear()
  )
}

/** Minutes → "2 h 15 min" / "45 min" / "3 h". */
export function fmtMinutes(minutes: number): string {
  const abs = Math.abs(Math.round(minutes))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h > 0 && m > 0) return h + ' h ' + m + ' min'
  if (h > 0) return h + ' h'
  return m + ' min'
}

/** Signed minutes: "+12 min" / "−1 h 30 min" (true minus sign). */
export function fmtSignedMinutes(minutes: number): string {
  return (minutes >= 0 ? '+' : '−') + fmtMinutes(minutes)
}

/** Hours with Swedish decimal comma: "1,5 h". */
export function fmtHours(hours: number): string {
  return String(hours).replace('.', ',') + ' h'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
