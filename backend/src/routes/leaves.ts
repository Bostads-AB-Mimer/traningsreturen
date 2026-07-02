import Router from '@koa/router'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getAuth } from '../auth/middleware'
import { writeAudit } from '../audit'
import { db } from '../db/knex'
import { logger } from '../logger'
import { validateLeaveHours } from '../rules/engine'
import { isIsoDate } from '../rules/dates'
import { asIsoDate, getAccount, getAttesterFor, LeaveRow, today } from '../services/account'

export const leavesRouter = new Router({ prefix: '/api/me/leaves' })

const applySchema = z.object({
  date: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  hours: z.number(),
})

export function serializeLeave(l: LeaveRow) {
  return {
    id: l.id,
    date: asIsoDate(l.date),
    startTime: l.start_time,
    hours: Number(l.hours),
    status: l.status,
    comment: l.comment,
    attestedBy: l.attested_by_name,
    attestedByDelegate: !!l.attested_by_delegate,
    appliedDate: asIsoDate(l.applied_date),
  }
}

/**
 * @openapi GET /api/me/leaves — my leave requests, newest application first.
 */
leavesRouter.get('/', async (ctx) => {
  const { user } = getAuth(ctx)
  try {
    const rows = await db<LeaveRow>('leave_requests')
      .where({ user_id: user.id })
      .orderBy([
        { column: 'applied_date', order: 'desc' },
        { column: 'created_at', order: 'desc' },
      ])
      .select('*')
    ctx.body = rows.map(serializeLeave)
  } catch (err) {
    logger.error({ err }, 'leaves.list')
    throw err
  }
})

/**
 * @openapi POST /api/me/leaves — apply for leave. Quarter-hour steps
 * (min 0.25 h); the balance is deducted only after approval.
 */
leavesRouter.post('/', async (ctx) => {
  const { user } = getAuth(ctx)
  const body = applySchema.parse(ctx.request.body)
  if (!isIsoDate(body.date)) {
    ctx.status = 400
    ctx.body = { error: 'invalid-date' }
    return
  }
  if (!validateLeaveHours(body.hours)) {
    ctx.status = 400
    ctx.body = { error: 'invalid-hours' }
    return
  }
  try {
    const account = await getAccount(user.id)
    if (account.balanceMinutes - body.hours * 60 < 0) {
      ctx.status = 409
      ctx.body = { error: 'insufficient-balance' }
      return
    }
    const id = randomUUID()
    await db.transaction(async (trx) => {
      await trx('leave_requests').insert({
        id,
        user_id: user.id,
        date: body.date,
        start_time: body.startTime,
        hours: body.hours,
        status: 'pending',
        applied_date: today(),
      })
      await writeAudit(trx, {
        actorUserId: user.id,
        actorName: user.name,
        action: 'leave.applied',
        entity: 'leave_request',
        entityId: id,
        details: { date: body.date, startTime: body.startTime, hours: body.hours },
      })
    })
    const attester = await getAttesterFor(user)
    const created = await db<LeaveRow>('leave_requests').where({ id }).first()
    ctx.status = 201
    ctx.body = { leave: serializeLeave(created!), attester }
  } catch (err) {
    logger.error({ err }, 'leaves.apply')
    throw err
  }
})
