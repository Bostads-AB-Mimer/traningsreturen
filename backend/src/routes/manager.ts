import Router from '@koa/router'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getAuth, requireRole } from '../auth/middleware'
import { writeAudit } from '../audit'
import { config } from '../config'
import { db } from '../db/knex'
import { logger } from '../logger'
import { isIsoDate } from '../rules/dates'
import { UserRow } from '../auth/types'
import { asIsoDate, getAccount, getAttestScope, LeaveRow, today } from '../services/account'
import { serializeLeave } from './leaves'

export const managerRouter = new Router({ prefix: '/api' })

managerRouter.use(requireRole('manager'))

/**
 * @openapi GET /api/team — the manager's direct reports with balance,
 * weekly earnings and latest workout.
 */
managerRouter.get('/team', async (ctx) => {
  const { user } = getAuth(ctx)
  try {
    const members = await db<UserRow>('users')
      .where({ manager_id: user.id, active: true })
      .whereNull('merged_into_user_id')
      .orderBy('name')
      .select('*')
    const pendingUserIds = new Set(
      await db('leave_requests')
        .where({ status: 'pending' })
        .whereIn(
          'user_id',
          members.map((m) => m.id),
        )
        .pluck('user_id'),
    )
    const rows = await Promise.all(
      members.map(async (m) => {
        const account = await getAccount(m.id)
        const latest = account.workouts[account.workouts.length - 1]
        return {
          id: m.id,
          name: m.name,
          title: m.title,
          balanceMinutes: account.balanceMinutes,
          weekEarnedMinutes: account.currentWeekEarnedMinutes,
          weeklyCapMinutes: config.rules.weeklyCapMinutes,
          latestWorkout: latest ? { date: latest.date, activity: latest.activity } : null,
          hasPendingLeave: pendingUserIds.has(m.id),
        }
      }),
    )
    ctx.body = { departmentSummary: summarizeDepartments(members), members: rows }
  } catch (err) {
    logger.error({ err }, 'manager.team')
    throw err
  }
})

function summarizeDepartments(members: UserRow[]): string[] {
  return [...new Set(members.map((m) => m.department))]
}

async function leavesInScope(
  managerUserId: string,
  statuses: string[],
): Promise<(LeaveRow & { user_name: string; user_title: string })[]> {
  const scope = await getAttestScope(managerUserId)
  return db('leave_requests')
    .join('users', 'users.id', 'leave_requests.user_id')
    .whereIn('users.manager_id', scope)
    .whereIn('leave_requests.status', statuses)
    .select<(LeaveRow & { user_name: string; user_title: string })[]>(
      'leave_requests.*',
      'users.name as user_name',
      'users.title as user_title',
    )
}

/**
 * @openapi GET /api/attest/pending — pending leave requests for teams the
 * user attests (own team + active delegations to them).
 */
managerRouter.get('/attest/pending', async (ctx) => {
  const { user } = getAuth(ctx)
  try {
    const rows = await leavesInScope(user.id, ['pending'])
    rows.sort((a, b) => (asIsoDate(a.applied_date) < asIsoDate(b.applied_date) ? -1 : 1))
    ctx.body = await Promise.all(
      rows.map(async (l) => {
        const account = await getAccount(l.user_id)
        return {
          ...serializeLeave(l),
          user: { id: l.user_id, name: l.user_name, title: l.user_title },
          balanceMinutes: account.balanceMinutes,
          balanceAfterMinutes: account.balanceMinutes - Number(l.hours) * 60,
        }
      }),
    )
  } catch (err) {
    logger.error({ err }, 'manager.attestPending')
    throw err
  }
})

/**
 * @openapi GET /api/attest/handled — recently handled requests in scope.
 */
managerRouter.get('/attest/handled', async (ctx) => {
  const { user } = getAuth(ctx)
  try {
    const rows = await leavesInScope(user.id, ['approved', 'denied'])
    rows.sort((a, b) => (asIsoDate(a.date) < asIsoDate(b.date) ? 1 : -1))
    ctx.body = rows.slice(0, 5).map((l) => ({
      ...serializeLeave(l),
      user: { id: l.user_id, name: l.user_name, title: l.user_title },
    }))
  } catch (err) {
    logger.error({ err }, 'manager.attestHandled')
    throw err
  }
})

const attestSchema = z.object({
  approve: z.boolean(),
  comment: z.string().max(500).optional(),
})

/**
 * @openapi POST /api/attest/:leaveId — approve or deny a pending request.
 * Only after approval is the time deducted (via the derived ledger); denial
 * never affects the balance. Signed with the approver's (or delegate's) name.
 */
managerRouter.post('/attest/:leaveId', async (ctx) => {
  const { user } = getAuth(ctx)
  const body = attestSchema.parse(ctx.request.body)
  try {
    const leave = await db<LeaveRow>('leave_requests')
      .where({ id: ctx.params.leaveId, status: 'pending' })
      .first()
    if (!leave) {
      ctx.status = 404
      ctx.body = { error: 'not-found' }
      return
    }
    const employee = await db<UserRow>('users').where({ id: leave.user_id }).first()
    const scope = await getAttestScope(user.id)
    if (!employee?.manager_id || !scope.includes(employee.manager_id)) {
      ctx.status = 403
      ctx.body = { error: 'forbidden' }
      return
    }
    if (body.approve) {
      const account = await getAccount(leave.user_id)
      if (account.balanceMinutes - Number(leave.hours) * 60 < 0) {
        ctx.status = 409
        ctx.body = { error: 'insufficient-balance' }
        return
      }
    }
    const attestedByDelegate = employee.manager_id !== user.id
    await db.transaction(async (trx) => {
      await trx('leave_requests')
        .where({ id: leave.id })
        .update({
          status: body.approve ? 'approved' : 'denied',
          comment: body.comment?.trim() ? body.comment.trim() : leave.comment,
          attested_by_user_id: user.id,
          attested_by_name: attestedByDelegate ? `${user.name} (delegerad attest)` : user.name,
          attested_by_delegate: attestedByDelegate,
          attested_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
      await writeAudit(trx, {
        actorUserId: user.id,
        actorName: user.name,
        action: body.approve ? 'leave.approved' : 'leave.denied',
        entity: 'leave_request',
        entityId: leave.id,
        details: {
          employeeId: leave.user_id,
          date: asIsoDate(leave.date),
          hours: Number(leave.hours),
          attestedByDelegate,
          comment: body.comment ?? null,
        },
      })
    })
    const updated = await db<LeaveRow>('leave_requests').where({ id: leave.id }).first()
    ctx.body = serializeLeave(updated!)
  } catch (err) {
    logger.error({ err }, 'manager.attest')
    throw err
  }
})

/**
 * @openapi GET /api/delegation — my current delegation and possible delegates.
 */
managerRouter.get('/delegation', async (ctx) => {
  const { user } = getAuth(ctx)
  try {
    const delegation = await db('delegations')
      .where({ manager_user_id: user.id, active: true })
      .andWhere('until_date', '>=', today())
      .first()
    const delegate = delegation
      ? await db<UserRow>('users').where({ id: delegation.delegate_user_id }).first()
      : null
    const options = await db<UserRow>('users')
      .where({ is_manager: true, active: true })
      .whereNot('id', user.id)
      .orderBy('name')
      .select('*')
    ctx.body = {
      delegation:
        delegation && delegate
          ? {
              delegate: { id: delegate.id, name: delegate.name, title: delegate.title },
              untilDate: asIsoDate(delegation.until_date),
            }
          : null,
      options: options.map((o) => ({ id: o.id, name: o.name, title: o.title })),
    }
  } catch (err) {
    logger.error({ err }, 'manager.getDelegation')
    throw err
  }
})

const delegationSchema = z.object({
  active: z.boolean(),
  delegateUserId: z.string().optional(),
  untilDate: z.string().optional(),
})

/**
 * @openapi PUT /api/delegation — activate or end delegation of attestation.
 */
managerRouter.put('/delegation', async (ctx) => {
  const { user } = getAuth(ctx)
  const body = delegationSchema.parse(ctx.request.body)
  try {
    if (body.active) {
      if (!body.delegateUserId || !body.untilDate || !isIsoDate(body.untilDate)) {
        ctx.status = 400
        ctx.body = { error: 'invalid-delegation' }
        return
      }
      if (body.delegateUserId === user.id) {
        ctx.status = 400
        ctx.body = { error: 'cannot-delegate-to-self' }
        return
      }
      const delegate = await db<UserRow>('users')
        .where({ id: body.delegateUserId, active: true })
        .first()
      if (!delegate) {
        ctx.status = 400
        ctx.body = { error: 'unknown-delegate' }
        return
      }
      await db.transaction(async (trx) => {
        await trx('delegations')
          .where({ manager_user_id: user.id })
          .update({ active: false, updated_at: trx.fn.now() })
        await trx('delegations').insert({
          id: randomUUID(),
          manager_user_id: user.id,
          delegate_user_id: delegate.id,
          until_date: body.untilDate,
          active: true,
        })
        await writeAudit(trx, {
          actorUserId: user.id,
          actorName: user.name,
          action: 'delegation.activated',
          entity: 'delegation',
          entityId: user.id,
          details: { delegate: delegate.name, untilDate: body.untilDate },
        })
      })
    } else {
      await db.transaction(async (trx) => {
        await trx('delegations')
          .where({ manager_user_id: user.id, active: true })
          .update({ active: false, updated_at: trx.fn.now() })
        await writeAudit(trx, {
          actorUserId: user.id,
          actorName: user.name,
          action: 'delegation.ended',
          entity: 'delegation',
          entityId: user.id,
        })
      })
    }
    ctx.body = { ok: true }
  } catch (err) {
    logger.error({ err }, 'manager.putDelegation')
    throw err
  }
})
