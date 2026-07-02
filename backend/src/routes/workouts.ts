import Router from '@koa/router'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getAuth } from '../auth/middleware'
import { writeAudit } from '../audit'
import { config } from '../config'
import { db } from '../db/knex'
import { logger } from '../logger'
import { previewBatch, validateWorkoutDate, validateWorkoutMinutes } from '../rules/engine'
import { fetchWorkouts, getAccount, today, workoutInputs } from '../services/account'

export const workoutsRouter = new Router({ prefix: '/api/me/workouts' })

const workoutInputSchema = z.object({
  date: z.string(),
  activityTypeId: z.string().min(1),
  minutes: z.number().int(),
})

const batchSchema = z.object({
  workouts: z.array(workoutInputSchema).min(1).max(100),
})

const editSchema = z.object({
  activityTypeId: z.string().min(1),
  minutes: z.number().int(),
})

interface BatchValidationError {
  error: string
  code?: string
  date?: string
}

/** Validates a batch and resolves activity names; returns an error or the enriched rows. */
async function prepareBatch(raw: z.infer<typeof batchSchema>['workouts']): Promise<
  | {
      ok: true
      rows: { date: string; activityTypeId: string; activity: string; minutes: number }[]
    }
  | { ok: false; status: number; body: BatchValidationError }
> {
  const activityIds = [...new Set(raw.map((w) => w.activityTypeId))]
  const activities = await db('activity_types')
    .whereIn('id', activityIds)
    .andWhere({ active: true })
    .select('id', 'name')
  const nameById = new Map<string, string>(
    activities.map((a: { id: string; name: string }) => [a.id, a.name]),
  )
  const t = today()
  for (const w of raw) {
    const dateError = validateWorkoutDate(w.date, config.rules, t)
    if (dateError) {
      return {
        ok: false,
        status: 400,
        body: { error: 'invalid-date', code: dateError, date: w.date },
      }
    }
    if (!validateWorkoutMinutes(w.minutes)) {
      return { ok: false, status: 400, body: { error: 'invalid-minutes' } }
    }
    if (!nameById.has(w.activityTypeId)) {
      return { ok: false, status: 400, body: { error: 'unknown-activity' } }
    }
  }
  return {
    ok: true,
    rows: raw.map((w) => ({
      date: w.date,
      activityTypeId: w.activityTypeId,
      activity: nameById.get(w.activityTypeId)!,
      minutes: w.minutes,
    })),
  }
}

/**
 * @openapi POST /api/me/workouts/preview — summary of a batch before saving:
 * count, total time, credited leave and minutes lost to the weekly cap.
 */
workoutsRouter.post('/preview', async (ctx) => {
  const { user } = getAuth(ctx)
  const body = batchSchema.parse(ctx.request.body)
  const prepared = await prepareBatch(body.workouts)
  if (!prepared.ok) {
    ctx.status = prepared.status
    ctx.body = prepared.body
    return
  }
  const existing = workoutInputs(await fetchWorkouts(user.id))
  ctx.body = previewBatch(
    existing,
    prepared.rows.map((w, i) => ({
      id: `preview-${i}`,
      date: w.date,
      activity: w.activity,
      minutes: w.minutes,
    })),
    config.rules,
  )
})

/**
 * @openapi POST /api/me/workouts — register a batch of workouts (one row per
 * workout and day). Earnings are derived, never stored.
 */
workoutsRouter.post('/', async (ctx) => {
  const { user } = getAuth(ctx)
  const body = batchSchema.parse(ctx.request.body)
  const prepared = await prepareBatch(body.workouts)
  if (!prepared.ok) {
    ctx.status = prepared.status
    ctx.body = prepared.body
    return
  }
  try {
    const balanceBefore = (await getAccount(user.id)).balanceMinutes
    await db.transaction(async (trx) => {
      for (const w of prepared.rows) {
        const id = randomUUID()
        await trx('workouts').insert({
          id,
          user_id: user.id,
          date: w.date,
          activity_type_id: w.activityTypeId,
          minutes: w.minutes,
        })
        await writeAudit(trx, {
          actorUserId: user.id,
          actorName: user.name,
          action: 'workout.registered',
          entity: 'workout',
          entityId: id,
          details: { date: w.date, activity: w.activity, minutes: w.minutes },
        })
      }
    })
    const account = await getAccount(user.id)
    ctx.status = 201
    ctx.body = {
      created: prepared.rows.length,
      creditedMinutes: account.balanceMinutes - balanceBefore,
      account,
    }
  } catch (err) {
    logger.error({ err }, 'workouts.registerBatch')
    throw err
  }
})

/**
 * @openapi PATCH /api/me/workouts/:id — edit activity/minutes of an own workout.
 */
workoutsRouter.patch('/:id', async (ctx) => {
  const { user } = getAuth(ctx)
  const body = editSchema.parse(ctx.request.body)
  if (!validateWorkoutMinutes(body.minutes)) {
    ctx.status = 400
    ctx.body = { error: 'invalid-minutes' }
    return
  }
  try {
    const workout = await db('workouts').where({ id: ctx.params.id, user_id: user.id }).first()
    if (!workout) {
      ctx.status = 404
      ctx.body = { error: 'not-found' }
      return
    }
    const activity = await db('activity_types')
      .where({ id: body.activityTypeId, active: true })
      .first()
    if (!activity) {
      ctx.status = 400
      ctx.body = { error: 'unknown-activity' }
      return
    }
    await db.transaction(async (trx) => {
      await trx('workouts').where({ id: workout.id }).update({
        activity_type_id: body.activityTypeId,
        minutes: body.minutes,
        updated_at: trx.fn.now(),
      })
      await writeAudit(trx, {
        actorUserId: user.id,
        actorName: user.name,
        action: 'workout.updated',
        entity: 'workout',
        entityId: workout.id,
        details: {
          before: { activityTypeId: workout.activity_type_id, minutes: workout.minutes },
          after: { activityTypeId: body.activityTypeId, minutes: body.minutes },
        },
      })
    })
    ctx.body = { account: await getAccount(user.id) }
  } catch (err) {
    logger.error({ err }, 'workouts.update')
    throw err
  }
})

/**
 * @openapi DELETE /api/me/workouts/:id — remove an own workout.
 */
workoutsRouter.delete('/:id', async (ctx) => {
  const { user } = getAuth(ctx)
  try {
    const workout = await db('workouts').where({ id: ctx.params.id, user_id: user.id }).first()
    if (!workout) {
      ctx.status = 404
      ctx.body = { error: 'not-found' }
      return
    }
    await db.transaction(async (trx) => {
      await trx('workouts').where({ id: workout.id }).del()
      await writeAudit(trx, {
        actorUserId: user.id,
        actorName: user.name,
        action: 'workout.deleted',
        entity: 'workout',
        entityId: workout.id,
        details: { date: workout.date, minutes: workout.minutes },
      })
    })
    ctx.body = { account: await getAccount(user.id) }
  } catch (err) {
    logger.error({ err }, 'workouts.delete')
    throw err
  }
})
