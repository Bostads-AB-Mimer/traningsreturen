/**
 * Träningsreturen rules engine.
 *
 * Pure module: no I/O, no clock — `today` is always a parameter. The balance
 * and the ledger are always derived from the events (workouts, approved
 * withdrawals, corrections and — behind the expiry feature flag — expiries).
 * Nothing here is ever persisted.
 */

import { addDays, addMonths, IsoDate, isIsoDate, mondayOf, parseIsoDate } from './dates'
import {
  ApprovedLeaveInput,
  CorrectionInput,
  DerivedAccount,
  EarnedWorkout,
  LedgerEntry,
  RulesConfig,
  WorkoutDateError,
  WorkoutInput,
} from './types'

/** Uncapped earning for a single workout: share of the time, rounded to whole minutes. */
export function rawEarning(minutes: number, config: RulesConfig): number {
  return Math.round(minutes * (config.returnSharePercent / 100))
}

/**
 * Allocates earnings per workout in date order against the weekly cap
 * (Mon–Sun). A workout past the cap is still logged but earns 0.
 */
export function allocateEarnings(
  workouts: WorkoutInput[],
  config: RulesConfig,
): { workouts: EarnedWorkout[]; earnedByWeek: Record<IsoDate, number> } {
  const sorted = [...workouts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const earnedByWeek: Record<IsoDate, number> = {}
  const result = sorted.map((w) => {
    const week = mondayOf(w.date)
    const raw = rawEarning(w.minutes, config)
    const used = earnedByWeek[week] ?? 0
    const earned = Math.max(0, Math.min(raw, config.weeklyCapMinutes - used))
    earnedByWeek[week] = used + earned
    return { ...w, rawEarnedMinutes: raw, earnedMinutes: earned, capped: earned < raw }
  })
  return { workouts: result, earnedByWeek }
}

/** FIFO bucket of not-yet-consumed earned time, used for expiry tracking. */
interface Bucket {
  sourceDate: IsoDate
  remaining: number
  expiresAt: IsoDate
}

/**
 * Derives the full account state from the events. Withdrawals and negative
 * corrections consume the oldest earned time first (FIFO); when the expiry
 * flag is on, time older than `expiryMonths` expires as its own ledger rows.
 */
export function deriveAccount(
  input: {
    workouts: WorkoutInput[]
    approvedLeaves: ApprovedLeaveInput[]
    corrections: CorrectionInput[]
  },
  config: RulesConfig,
  today: IsoDate,
): DerivedAccount {
  const { workouts, earnedByWeek } = allocateEarnings(input.workouts, config)

  const entries: LedgerEntry[] = []
  for (const w of workouts) {
    entries.push({
      date: w.date,
      type: 'earned',
      minutes: w.earnedMinutes,
      balance: 0,
      expiresAt: null,
      earned: {
        activity: w.activity,
        workoutMinutes: w.minutes,
        cappedLostMinutes: w.rawEarnedMinutes - w.earnedMinutes,
      },
    })
  }
  for (const l of input.approvedLeaves) {
    entries.push({
      date: l.date,
      type: 'withdrawal',
      minutes: -Math.round(l.hours * 60),
      balance: 0,
      expiresAt: null,
      withdrawal: {
        hours: l.hours,
        startTime: l.startTime,
        attestedBy: l.attestedBy,
        attestedByDelegate: l.attestedByDelegate,
      },
    })
  }
  for (const c of input.corrections) {
    entries.push({
      date: c.date,
      type: 'correction',
      minutes: c.minutes,
      balance: 0,
      expiresAt: null,
      correction: { reason: c.reason, byName: c.byName },
    })
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const buckets: Bucket[] = []
  const rows: LedgerEntry[] = []

  const expireUpTo = (limit: IsoDate) => {
    if (!config.expiryEnabled) return
    for (const b of buckets) {
      if (b.remaining > 0 && b.expiresAt <= limit) {
        rows.push({
          date: b.expiresAt,
          type: 'expiry',
          minutes: -b.remaining,
          balance: 0,
          expiresAt: null,
          expiry: { sourceDate: b.sourceDate },
        })
        b.remaining = 0
      }
    }
  }

  for (const e of entries) {
    expireUpTo(e.date)
    if (e.minutes > 0) {
      buckets.push({
        sourceDate: e.date,
        remaining: e.minutes,
        expiresAt: addMonths(e.date, config.expiryMonths),
      })
    } else {
      // Withdrawals and negative corrections consume the oldest time first.
      let needed = -e.minutes
      for (const b of buckets) {
        if (needed <= 0) break
        if (b.remaining <= 0) continue
        const take = Math.min(b.remaining, needed)
        b.remaining -= take
        needed -= take
      }
    }
    rows.push({
      ...e,
      expiresAt:
        config.expiryEnabled && e.minutes > 0 ? addMonths(e.date, config.expiryMonths) : null,
    })
  }
  expireUpTo(today)

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let balance = 0
  for (const r of rows) {
    balance += r.minutes
    r.balance = balance
  }

  const warningLimit = addMonths(today, config.expiryWarningMonths)
  let expiringSoonMinutes = 0
  let firstExpiryDate: IsoDate | null = null
  if (config.expiryEnabled) {
    for (const b of buckets) {
      if (b.remaining > 0 && b.expiresAt <= warningLimit) {
        expiringSoonMinutes += b.remaining
        if (!firstExpiryDate || b.expiresAt < firstExpiryDate) firstExpiryDate = b.expiresAt
      }
    }
  }

  return {
    balanceMinutes: balance,
    entries: rows,
    currentWeekEarnedMinutes: earnedByWeek[mondayOf(today)] ?? 0,
    earnedByWeek,
    expiringSoonMinutes,
    firstExpiryDate,
    workouts,
    totalWorkoutMinutes: workouts.reduce((sum, w) => sum + w.minutes, 0),
  }
}

/**
 * Validates a workout date: max `maxBackdateDays` back, never in the future.
 * Returns null when the date is valid.
 */
export function validateWorkoutDate(
  date: string,
  config: RulesConfig,
  today: IsoDate,
): WorkoutDateError | null {
  if (!isIsoDate(date)) return 'invalid'
  if (date > today) return 'future'
  if (date < addDays(today, -config.maxBackdateDays)) return 'too_old'
  return null
}

/** Withdrawals are made in quarter-hour steps, minimum 0.25 h. */
export function validateLeaveHours(hours: number): boolean {
  if (!Number.isFinite(hours) || hours < 0.25) return false
  return Math.round(hours * 4) === hours * 4
}

/**
 * Preview of a registration batch before saving: how much the new workouts
 * would earn given existing workouts (weekly caps are shared with them),
 * and how many potential minutes the cap swallows.
 */
export function previewBatch(
  existingWorkouts: WorkoutInput[],
  newWorkouts: WorkoutInput[],
  config: RulesConfig,
): {
  workoutCount: number
  totalMinutes: number
  earnedMinutes: number
  cappedLostMinutes: number
} {
  const before = allocateEarnings(existingWorkouts, config)
  const after = allocateEarnings([...existingWorkouts, ...newWorkouts], config)
  const sum = (ws: EarnedWorkout[]) => ws.reduce((s, w) => s + w.earnedMinutes, 0)
  const earned = sum(after.workouts) - sum(before.workouts)
  const raw = newWorkouts.reduce((s, w) => s + rawEarning(w.minutes, config), 0)
  return {
    workoutCount: newWorkouts.length,
    totalMinutes: newWorkouts.reduce((s, w) => s + w.minutes, 0),
    earnedMinutes: earned,
    cappedLostMinutes: raw - earned,
  }
}

/** Guards against nonsense workouts; whole positive minutes only. */
export function validateWorkoutMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 24 * 60
}

/** Re-exported so API consumers can compute the week window like the engine does. */
export { mondayOf, parseIsoDate }
