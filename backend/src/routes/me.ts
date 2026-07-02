import Router from '@koa/router'
import { getAuth } from '../auth/middleware'
import { db } from '../db/knex'
import { logger } from '../logger'
import { getAccount, getAttesterFor, fetchWorkouts } from '../services/account'

export const meRouter = new Router({ prefix: '/api/me' })

const DEFAULT_TOP_ACTIVITIES = ['Gym', 'Power walk', 'Jogging', 'Simning', 'Cykling']

/**
 * @openapi GET /api/me — current user profile and roles.
 */
meRouter.get('/', async (ctx) => {
  const { user, roles } = getAuth(ctx)
  ctx.body = {
    id: user.id,
    name: user.name,
    department: user.department,
    title: user.title,
    roles,
  }
})

/**
 * @openapi GET /api/me/account — derived balance, ledger and weekly earnings.
 * Always computed from the events; there is no stored balance.
 */
meRouter.get('/account', async (ctx) => {
  const { user } = getAuth(ctx)
  ctx.body = await getAccount(user.id)
})

/**
 * @openapi GET /api/me/attester — who attests my leave requests right now
 * (manager, or their delegate while a delegation is active).
 */
meRouter.get('/attester', async (ctx) => {
  const { user } = getAuth(ctx)
  ctx.body = await getAttesterFor(user)
})

/**
 * @openapi GET /api/me/top-activities — the user's 5 most frequent activities
 * (defaults for users without history), used for the quick-pick chips.
 */
meRouter.get('/top-activities', async (ctx) => {
  const { user } = getAuth(ctx)
  try {
    const [workouts, activities] = await Promise.all([
      fetchWorkouts(user.id),
      db('activity_types').where({ active: true }).orderBy('sort_order').select('id', 'name'),
    ])
    const activeByName = new Map<string, { id: string; name: string }>(
      activities.map((a: { id: string; name: string }) => [a.name, a]),
    )
    const counts = new Map<string, number>()
    for (const w of workouts) {
      counts.set(w.activity_name, (counts.get(w.activity_name) ?? 0) + 1)
    }
    const top = [...counts.entries()]
      .filter(([name]) => activeByName.has(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => activeByName.get(name)!)
    ctx.body = top.length
      ? top
      : DEFAULT_TOP_ACTIVITIES.filter((n) => activeByName.has(n)).map((n) => activeByName.get(n)!)
  } catch (err) {
    logger.error({ err }, 'me.topActivities')
    throw err
  }
})
