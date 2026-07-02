import Router from '@koa/router'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getAuth, requireRole } from '../auth/middleware'
import { writeAudit } from '../audit'
import { db } from '../db/knex'
import { logger } from '../logger'
import { UserRow } from '../auth/types'
import { asIsoDate, getAccount, today } from '../services/account'

export const adminRouter = new Router({ prefix: '/api/admin' })

adminRouter.use(requireRole('admin'))

/** Strips diacritics and case so "Sandström" matches "Sandstrom". */
function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * @openapi GET /api/admin/stats — organisation-wide statistics for the
 * last 12 months, computed from the events.
 */
adminRouter.get('/stats', async (ctx) => {
  try {
    const users = await db<UserRow>('users').whereNull('merged_into_user_id').select('*')
    const activeUsers = users.filter((u) => u.active)
    const t = today()
    const currentYear = t.slice(0, 4)

    const workouts: { user_id: string; date: Date | string; minutes: number; name: string }[] =
      await db('workouts')
        .join('activity_types', 'activity_types.id', 'workouts.activity_type_id')
        .whereIn(
          'workouts.user_id',
          activeUsers.map((u) => u.id),
        )
        .select('workouts.user_id', 'workouts.date', 'workouts.minutes', 'activity_types.name')

    // Users with at least one workout the last 12 months count as active app users.
    const twelveMonthsAgo = `${Number(currentYear) - 1}${t.slice(4)}`
    const usersWithRecentWorkout = new Set(
      workouts.filter((w) => asIsoDate(w.date) >= twelveMonthsAgo).map((w) => w.user_id),
    )

    const months: { year: number; month: number; minutes: number }[] = []
    const [year, month] = [Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1]
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - i, 1)
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1, minutes: 0 })
    }
    const monthKey = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) })
    for (const w of workouts) {
      const { y, m } = monthKey(asIsoDate(w.date))
      const bucket = months.find((mo) => mo.year === y && mo.month === m)
      if (bucket) bucket.minutes += w.minutes
    }

    const byActivity = new Map<string, number>()
    for (const w of workouts) {
      byActivity.set(w.name, (byActivity.get(w.name) ?? 0) + w.minutes)
    }
    const popularActivities = [...byActivity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, minutes]) => ({ name, minutes }))

    const trainedYearMinutes = workouts
      .filter((w) => asIsoDate(w.date).startsWith(currentYear))
      .reduce((s, w) => s + w.minutes, 0)

    const withdrawnRows: { hours: number | string }[] = await db('leave_requests')
      .where({ status: 'approved' })
      .whereRaw('YEAR([date]) = ?', [Number(currentYear)])
      .select('hours')
    const withdrawnYearHours = withdrawnRows.reduce((s, r) => s + Number(r.hours), 0)

    ctx.body = {
      appUserCount: usersWithRecentWorkout.size,
      employeeCount: users.length,
      goalPercent: 70,
      trainedYearMinutes,
      withdrawnYearHours,
      monthlyMinutes: months,
      popularActivities,
    }
  } catch (err) {
    logger.error({ err }, 'admin.stats')
    throw err
  }
})

/**
 * @openapi GET /api/admin/users — search users; flags possible duplicates
 * (same name ignoring diacritics/case).
 */
adminRouter.get('/users', async (ctx) => {
  const query = String(ctx.query.query ?? '').toLowerCase()
  try {
    const users = await db<UserRow>('users')
      .whereNull('merged_into_user_id')
      .orderBy('name')
      .select('*')
    const byNormalizedName = new Map<string, UserRow[]>()
    for (const u of users) {
      const key = normalizeName(u.name)
      byNormalizedName.set(key, [...(byNormalizedName.get(key) ?? []), u])
    }
    const filtered = users.filter(
      (u) =>
        !query ||
        u.name.toLowerCase().includes(query) ||
        u.department.toLowerCase().includes(query) ||
        u.title.toLowerCase().includes(query),
    )
    ctx.body = await Promise.all(
      filtered.map(async (u) => {
        const account = await getAccount(u.id)
        const dupGroup = byNormalizedName.get(normalizeName(u.name)) ?? []
        // Merge is offered on the non-primary account(s). The primary is the
        // most "connected" account: linked login first, then manager relation.
        const primary = [...dupGroup].sort(
          (a, b) =>
            Number(!!b.keycloak_username) - Number(!!a.keycloak_username) ||
            Number(!!b.manager_id) - Number(!!a.manager_id) ||
            a.id.localeCompare(b.id),
        )[0]
        const duplicateOf = primary && primary.id !== u.id ? primary : undefined
        return {
          id: u.id,
          name: u.name,
          department: u.department,
          title: u.title,
          active: u.active,
          balanceMinutes: account.balanceMinutes,
          possibleDuplicate: dupGroup.length > 1,
          duplicateOfUserId: duplicateOf?.id ?? null,
        }
      }),
    )
  } catch (err) {
    logger.error({ err }, 'admin.users')
    throw err
  }
})

/**
 * @openapi GET /api/admin/users/:id/account — a user's full derived ledger,
 * exactly what the employee sees.
 */
adminRouter.get('/users/:id/account', async (ctx) => {
  try {
    const user = await db<UserRow>('users').where({ id: ctx.params.id }).first()
    if (!user) {
      ctx.status = 404
      ctx.body = { error: 'not-found' }
      return
    }
    ctx.body = {
      user: {
        id: user.id,
        name: user.name,
        department: user.department,
        title: user.title,
        active: user.active,
      },
      account: await getAccount(user.id),
    }
  } catch (err) {
    logger.error({ err }, 'admin.userAccount')
    throw err
  }
})

const correctionSchema = z.object({
  minutes: z
    .number()
    .int()
    .refine((m) => m !== 0, 'minutes must not be zero'),
  reason: z.string().trim().min(1).max(500),
})

/**
 * @openapi POST /api/admin/users/:id/corrections — balance correction, logged
 * visibly in the employee's ledger with who/when/why.
 */
adminRouter.post('/users/:id/corrections', async (ctx) => {
  const { user: admin } = getAuth(ctx)
  const body = correctionSchema.parse(ctx.request.body)
  try {
    const user = await db<UserRow>('users').where({ id: ctx.params.id }).first()
    if (!user) {
      ctx.status = 404
      ctx.body = { error: 'not-found' }
      return
    }
    const id = randomUUID()
    await db.transaction(async (trx) => {
      await trx('corrections').insert({
        id,
        user_id: user.id,
        date: today(),
        minutes: body.minutes,
        reason: body.reason,
        by_user_id: admin.id,
        by_name: admin.name,
      })
      await writeAudit(trx, {
        actorUserId: admin.id,
        actorName: admin.name,
        action: 'correction.created',
        entity: 'correction',
        entityId: id,
        details: { employeeId: user.id, minutes: body.minutes, reason: body.reason },
      })
    })
    ctx.status = 201
    ctx.body = { account: await getAccount(user.id) }
  } catch (err) {
    logger.error({ err }, 'admin.createCorrection')
    throw err
  }
})

const mergeSchema = z.object({
  duplicateUserId: z.string().min(1),
})

/**
 * @openapi POST /api/admin/users/:id/merge — merge a duplicate account into
 * this one. All history (workouts, leaves, corrections) moves to the
 * surviving account; the duplicate is deactivated and marked as merged.
 */
adminRouter.post('/users/:id/merge', async (ctx) => {
  const { user: admin } = getAuth(ctx)
  const body = mergeSchema.parse(ctx.request.body)
  try {
    const target = await db<UserRow>('users').where({ id: ctx.params.id }).first()
    const duplicate = await db<UserRow>('users').where({ id: body.duplicateUserId }).first()
    if (!target || !duplicate || target.id === duplicate.id || duplicate.merged_into_user_id) {
      ctx.status = 400
      ctx.body = { error: 'invalid-merge' }
      return
    }
    await db.transaction(async (trx) => {
      await trx('workouts').where({ user_id: duplicate.id }).update({ user_id: target.id })
      await trx('leave_requests').where({ user_id: duplicate.id }).update({ user_id: target.id })
      await trx('corrections').where({ user_id: duplicate.id }).update({ user_id: target.id })
      await trx('users').where({ id: duplicate.id }).update({
        active: false,
        merged_into_user_id: target.id,
        updated_at: trx.fn.now(),
      })
      await writeAudit(trx, {
        actorUserId: admin.id,
        actorName: admin.name,
        action: 'user.merged',
        entity: 'user',
        entityId: duplicate.id,
        details: { mergedInto: target.id, targetName: target.name },
      })
    })
    ctx.body = { mergedIntoName: target.name }
  } catch (err) {
    logger.error({ err }, 'admin.merge')
    throw err
  }
})

const activeSchema = z.object({ active: z.boolean() })

/**
 * @openapi POST /api/admin/users/:id/active — activate or deactivate a user.
 */
adminRouter.post('/users/:id/active', async (ctx) => {
  const { user: admin } = getAuth(ctx)
  const body = activeSchema.parse(ctx.request.body)
  try {
    const user = await db<UserRow>('users').where({ id: ctx.params.id }).first()
    if (!user) {
      ctx.status = 404
      ctx.body = { error: 'not-found' }
      return
    }
    await db.transaction(async (trx) => {
      await trx('users')
        .where({ id: user.id })
        .update({ active: body.active, updated_at: trx.fn.now() })
      await writeAudit(trx, {
        actorUserId: admin.id,
        actorName: admin.name,
        action: body.active ? 'user.activated' : 'user.deactivated',
        entity: 'user',
        entityId: user.id,
        details: { name: user.name },
      })
    })
    ctx.body = { ok: true }
  } catch (err) {
    logger.error({ err }, 'admin.toggleActive')
    throw err
  }
})

const createActivitySchema = z.object({ name: z.string().trim().min(1).max(100) })
const updateActivitySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional(),
})

/**
 * @openapi POST /api/admin/activity-types — add a new activity type.
 */
adminRouter.post('/activity-types', async (ctx) => {
  const { user: admin } = getAuth(ctx)
  const body = createActivitySchema.parse(ctx.request.body)
  try {
    const existing = await db('activity_types').where({ name: body.name }).first()
    if (existing) {
      ctx.status = 409
      ctx.body = { error: 'duplicate-name' }
      return
    }
    const maxSort = await db('activity_types').max<{ max: number }>('sort_order as max').first()
    const id = randomUUID()
    await db.transaction(async (trx) => {
      await trx('activity_types').insert({
        id,
        name: body.name,
        active: true,
        sort_order: (maxSort?.max ?? 0) + 1,
      })
      await writeAudit(trx, {
        actorUserId: admin.id,
        actorName: admin.name,
        action: 'activity.created',
        entity: 'activity_type',
        entityId: id,
        details: { name: body.name },
      })
    })
    ctx.status = 201
    ctx.body = { id, name: body.name, active: true }
  } catch (err) {
    logger.error({ err }, 'admin.createActivity')
    throw err
  }
})

/**
 * @openapi PATCH /api/admin/activity-types/:id — rename or (de)activate.
 */
adminRouter.patch('/activity-types/:id', async (ctx) => {
  const { user: admin } = getAuth(ctx)
  const body = updateActivitySchema.parse(ctx.request.body)
  try {
    const activity = await db('activity_types').where({ id: ctx.params.id }).first()
    if (!activity) {
      ctx.status = 404
      ctx.body = { error: 'not-found' }
      return
    }
    await db.transaction(async (trx) => {
      await trx('activity_types')
        .where({ id: activity.id })
        .update({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        })
      await writeAudit(trx, {
        actorUserId: admin.id,
        actorName: admin.name,
        action: 'activity.updated',
        entity: 'activity_type',
        entityId: activity.id,
        details: { before: { name: activity.name, active: activity.active }, after: body },
      })
    })
    ctx.body = { ok: true }
  } catch (err) {
    logger.error({ err }, 'admin.updateActivity')
    throw err
  }
})
