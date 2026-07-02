import { Knex } from 'knex'
import { db } from '../db/knex'
import { config } from '../config'
import { logger } from '../logger'
import { deriveAccount } from '../rules/engine'
import { toIsoDate } from '../rules/dates'
import { DerivedAccount, WorkoutInput } from '../rules/types'
import { UserRow } from '../auth/types'

export interface WorkoutRow {
  id: string
  user_id: string
  date: Date | string
  activity_type_id: string
  activity_name: string
  minutes: number
}

export interface LeaveRow {
  id: string
  user_id: string
  date: Date | string
  start_time: string
  hours: number | string
  status: 'pending' | 'approved' | 'denied'
  comment: string | null
  attested_by_user_id: string | null
  attested_by_name: string | null
  attested_by_delegate: boolean
  applied_date: Date | string
}

export function today(): string {
  return toIsoDate(new Date())
}

/** SQL Server returns DATE columns as JS Dates; normalize to `YYYY-MM-DD`. */
export function asIsoDate(value: Date | string): string {
  return value instanceof Date ? toIsoDate(value) : value.slice(0, 10)
}

export async function fetchWorkouts(userId: string, trx: Knex = db): Promise<WorkoutRow[]> {
  try {
    return await trx('workouts')
      .join('activity_types', 'activity_types.id', 'workouts.activity_type_id')
      .where('workouts.user_id', userId)
      .select<WorkoutRow[]>('workouts.*', 'activity_types.name as activity_name')
  } catch (err) {
    logger.error({ err }, 'account.fetchWorkouts')
    throw err
  }
}

export async function fetchLeaves(userId: string, trx: Knex = db): Promise<LeaveRow[]> {
  try {
    return await trx<LeaveRow>('leave_requests').where({ user_id: userId }).select('*')
  } catch (err) {
    logger.error({ err }, 'account.fetchLeaves')
    throw err
  }
}

export function workoutInputs(rows: WorkoutRow[]): WorkoutInput[] {
  return rows.map((w) => ({
    id: w.id,
    date: asIsoDate(w.date),
    activity: w.activity_name,
    minutes: w.minutes,
  }))
}

/**
 * Derives the account (balance, ledger, weekly earnings, expiry info) for a
 * user straight from the events — nothing is read from a stored balance.
 */
export async function getAccount(userId: string, trx: Knex = db): Promise<DerivedAccount> {
  try {
    const [workouts, leaves, corrections] = await Promise.all([
      fetchWorkouts(userId, trx),
      fetchLeaves(userId, trx),
      trx('corrections').where({ user_id: userId }).select('*'),
    ])
    return deriveAccount(
      {
        workouts: workoutInputs(workouts),
        approvedLeaves: leaves
          .filter((l) => l.status === 'approved')
          .map((l) => ({
            id: l.id,
            date: asIsoDate(l.date),
            startTime: l.start_time,
            hours: Number(l.hours),
            attestedBy: l.attested_by_name ?? '',
            attestedByDelegate: !!l.attested_by_delegate,
          })),
        corrections: corrections.map(
          (c: {
            id: string
            date: Date | string
            minutes: number
            reason: string
            by_name: string
          }) => ({
            id: c.id,
            date: asIsoDate(c.date),
            minutes: c.minutes,
            reason: c.reason,
            byName: c.by_name,
          }),
        ),
      },
      config.rules,
      today(),
    )
  } catch (err) {
    logger.error({ err }, 'account.getAccount')
    throw err
  }
}

export interface AttesterInfo {
  /** Name shown to the employee ("attesteras av …"). */
  name: string
  /** True when a delegation is currently active for the employee's manager. */
  delegated: boolean
  managerName: string | null
  delegationUntil: string | null
}

/** Resolves who currently attests for an employee: manager, or active delegate. */
export async function getAttesterFor(user: UserRow, trx: Knex = db): Promise<AttesterInfo> {
  try {
    if (!user.manager_id) {
      return { name: '', delegated: false, managerName: null, delegationUntil: null }
    }
    const manager = await trx<UserRow>('users').where({ id: user.manager_id }).first()
    if (!manager) {
      return { name: '', delegated: false, managerName: null, delegationUntil: null }
    }
    const delegation = await trx('delegations')
      .where({ manager_user_id: manager.id, active: true })
      .andWhere('until_date', '>=', today())
      .first()
    if (delegation) {
      const delegate = await trx<UserRow>('users')
        .where({ id: delegation.delegate_user_id })
        .first()
      if (delegate) {
        return {
          name: delegate.name,
          delegated: true,
          managerName: manager.name,
          delegationUntil: asIsoDate(delegation.until_date),
        }
      }
    }
    return {
      name: manager.name,
      delegated: false,
      managerName: manager.name,
      delegationUntil: null,
    }
  } catch (err) {
    logger.error({ err }, 'account.getAttesterFor')
    throw err
  }
}

/**
 * Manager user-ids whose teams the given user may attest right now:
 * their own team plus any active delegations pointing at them.
 */
export async function getAttestScope(managerUserId: string, trx: Knex = db): Promise<string[]> {
  try {
    const delegatedFrom = await trx('delegations')
      .where({ delegate_user_id: managerUserId, active: true })
      .andWhere('until_date', '>=', today())
      .pluck('manager_user_id')
    return [managerUserId, ...delegatedFrom]
  } catch (err) {
    logger.error({ err }, 'account.getAttestScope')
    throw err
  }
}
