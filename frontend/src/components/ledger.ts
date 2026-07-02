import { CSSProperties } from 'react'
import { LedgerEntry } from '../api/types'
import { fmtDate, fmtHours } from '../format'

/** Event text exactly as in the prototype's ledger. */
export function ledgerLabel(entry: LedgerEntry): string {
  switch (entry.type) {
    case 'earned':
      return `${entry.earned?.activity} · ${entry.earned?.workoutMinutes} min`
    case 'withdrawal':
      return `Ledighet ${fmtHours(entry.withdrawal?.hours ?? 0)} kl ${entry.withdrawal?.startTime}`
    case 'correction':
      return `Korrigering: ${entry.correction?.reason}`
    case 'expiry':
      return `Tid intjänad ${fmtDate(entry.expiry?.sourceDate ?? entry.date)} förföll (äldre än 12 mån)`
  }
}

export function ledgerSub(entry: LedgerEntry): string | null {
  switch (entry.type) {
    case 'earned':
      return entry.earned && entry.earned.cappedLostMinutes > 0
        ? `Veckotaket nått – ${entry.earned.cappedLostMinutes} min gav ingen ledighet`
        : null
    case 'withdrawal':
      return `Attesterad av ${entry.withdrawal?.attestedBy}`
    case 'correction':
      return `Av ${entry.correction?.byName}`
    case 'expiry':
      return null
  }
}

export function ledgerAmountStyle(entry: LedgerEntry): CSSProperties {
  return {
    fontWeight: 800,
    fontSize: 14,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    color: entry.minutes >= 0 ? '#0B7B5D' : entry.type === 'expiry' ? '#A05A00' : '#B4005F',
  }
}
