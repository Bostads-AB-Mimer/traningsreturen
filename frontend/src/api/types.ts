/** API types mirroring the backend's OpenAPI schema (/api/openapi.json). */

export type Role = 'employee' | 'manager' | 'admin'

export interface AppConfig {
  rules: {
    returnSharePercent: number
    weeklyCapMinutes: number
    maxBackdateDays: number
    expiryMonths: number
    expiryWarningMonths: number
  }
  features: { expiryEnabled: boolean }
  authMode: 'oidc' | 'demo'
}

export interface Me {
  id: string
  name: string
  department: string
  title: string
  roles: Role[]
}

export type LedgerType = 'earned' | 'withdrawal' | 'correction' | 'expiry'

export interface LedgerEntry {
  date: string
  type: LedgerType
  minutes: number
  balance: number
  expiresAt: string | null
  earned?: { activity: string; workoutMinutes: number; cappedLostMinutes: number }
  withdrawal?: {
    hours: number
    startTime: string
    attestedBy: string
    attestedByDelegate: boolean
  }
  correction?: { reason: string; byName: string }
  expiry?: { sourceDate: string }
}

export interface EarnedWorkout {
  id: string
  date: string
  activity: string
  minutes: number
  rawEarnedMinutes: number
  earnedMinutes: number
  capped: boolean
}

export interface Account {
  balanceMinutes: number
  entries: LedgerEntry[]
  currentWeekEarnedMinutes: number
  earnedByWeek: Record<string, number>
  expiringSoonMinutes: number
  firstExpiryDate: string | null
  workouts: EarnedWorkout[]
  totalWorkoutMinutes: number
}

export interface ActivityType {
  id: string
  name: string
  active: boolean
}

export interface AttesterInfo {
  name: string
  delegated: boolean
  managerName: string | null
  delegationUntil: string | null
}

export type LeaveStatus = 'pending' | 'approved' | 'denied'

export interface Leave {
  id: string
  date: string
  startTime: string
  hours: number
  status: LeaveStatus
  comment: string | null
  attestedBy: string | null
  attestedByDelegate: boolean
  appliedDate: string
}

export interface BatchPreview {
  workoutCount: number
  totalMinutes: number
  earnedMinutes: number
  cappedLostMinutes: number
}

export interface RegisterResult {
  created: number
  creditedMinutes: number
  account: Account
}

export interface TeamMember {
  id: string
  name: string
  title: string
  balanceMinutes: number
  weekEarnedMinutes: number
  weeklyCapMinutes: number
  latestWorkout: { date: string; activity: string } | null
  hasPendingLeave: boolean
}

export interface Team {
  departmentSummary: string[]
  members: TeamMember[]
}

export interface PendingLeave extends Leave {
  user: { id: string; name: string; title: string }
  balanceMinutes: number
  balanceAfterMinutes: number
}

export interface HandledLeave extends Leave {
  user: { id: string; name: string; title: string }
}

export interface DelegationState {
  delegation: {
    delegate: { id: string; name: string; title: string }
    untilDate: string
  } | null
  options: { id: string; name: string; title: string }[]
}

export interface AdminStats {
  appUserCount: number
  employeeCount: number
  goalPercent: number
  trainedYearMinutes: number
  withdrawnYearHours: number
  monthlyMinutes: { year: number; month: number; minutes: number }[]
  popularActivities: { name: string; minutes: number }[]
}

export interface AdminUser {
  id: string
  name: string
  department: string
  title: string
  active: boolean
  balanceMinutes: number
  possibleDuplicate: boolean
  duplicateOfUserId: string | null
}

export interface AdminUserAccount {
  user: { id: string; name: string; department: string; title: string; active: boolean }
  account: Account
}

export interface WorkoutDraft {
  date: string
  activityTypeId: string
  minutes: number
}
