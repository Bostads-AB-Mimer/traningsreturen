import { IsoDate } from './dates'

export interface RulesConfig {
  /** Share of workout time returned as leave, in percent. Default 20. */
  returnSharePercent: number
  /** Max earned leave minutes per calendar week (Mon–Sun). Default 36. */
  weeklyCapMinutes: number
  /** How many days back a workout may be registered. Default 60. */
  maxBackdateDays: number
  /** Feature flag (KONCEPT): earned time expires after `expiryMonths`. */
  expiryEnabled: boolean
  /** Months until earned time expires. Default 12. */
  expiryMonths: number
  /** Window for the "expires soon" notice. Default 3 months. */
  expiryWarningMonths: number
}

export const DEFAULT_RULES_CONFIG: RulesConfig = {
  returnSharePercent: 20,
  weeklyCapMinutes: 36,
  maxBackdateDays: 60,
  expiryEnabled: false,
  expiryMonths: 12,
  expiryWarningMonths: 3,
}

export interface WorkoutInput {
  id: string
  date: IsoDate
  activity: string
  minutes: number
}

export interface ApprovedLeaveInput {
  id: string
  /** Date the leave is taken — the balance is affected on this date. */
  date: IsoDate
  startTime: string
  hours: number
  attestedBy: string
  /** True when the approval was made by a delegate rather than the manager. */
  attestedByDelegate: boolean
}

export interface CorrectionInput {
  id: string
  date: IsoDate
  minutes: number
  reason: string
  byName: string
}

export interface EarnedWorkout extends WorkoutInput {
  /** Uncapped earning: round(minutes * share). */
  rawEarnedMinutes: number
  /** Earning actually credited after the weekly cap. */
  earnedMinutes: number
  /** True when the weekly cap reduced (or zeroed) the earning. */
  capped: boolean
}

export type LedgerEntryType = 'earned' | 'withdrawal' | 'correction' | 'expiry'

export interface LedgerEntry {
  date: IsoDate
  type: LedgerEntryType
  /** Signed balance effect in minutes. */
  minutes: number
  /** Running balance after this entry, in minutes. */
  balance: number
  /** Expiry date for credited time (only when the expiry flag is on and minutes > 0). */
  expiresAt: IsoDate | null
  earned?: {
    activity: string
    workoutMinutes: number
    /** Minutes of potential earning lost to the weekly cap for this workout. */
    cappedLostMinutes: number
  }
  withdrawal?: {
    hours: number
    startTime: string
    attestedBy: string
    attestedByDelegate: boolean
  }
  correction?: {
    reason: string
    byName: string
  }
  expiry?: {
    /** Date the expired time was originally earned. */
    sourceDate: IsoDate
  }
}

export interface DerivedAccount {
  /** Current balance in minutes (sum of all ledger entries). */
  balanceMinutes: number
  /** Ledger entries in chronological order. */
  entries: LedgerEntry[]
  /** Earned minutes in the current calendar week (Mon–Sun). */
  currentWeekEarnedMinutes: number
  /** Earned minutes per week, keyed by the Monday of the week. */
  earnedByWeek: Record<IsoDate, number>
  /** Minutes expiring within the warning window (0 when the flag is off). */
  expiringSoonMinutes: number
  /** Earliest upcoming expiry date within the warning window. */
  firstExpiryDate: IsoDate | null
  /** All workouts annotated with their derived earnings, in date order. */
  workouts: EarnedWorkout[]
  /** Total registered workout minutes. */
  totalWorkoutMinutes: number
}

export type WorkoutDateError = 'future' | 'too_old' | 'invalid'
