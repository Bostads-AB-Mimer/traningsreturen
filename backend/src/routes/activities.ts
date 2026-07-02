import Router from '@koa/router'
import { db } from '../db/knex'
import { logger } from '../logger'

export const activitiesRouter = new Router({ prefix: '/api/activity-types' })

/**
 * @openapi GET /api/activity-types — all activity types with active flag
 * (employees only pick among active ones; admin sees and manages all).
 */
activitiesRouter.get('/', async (ctx) => {
  try {
    const rows = await db('activity_types').orderBy('sort_order').select('id', 'name', 'active')
    ctx.body = rows.map((r: { id: string; name: string; active: boolean }) => ({
      id: r.id,
      name: r.name,
      active: !!r.active,
    }))
  } catch (err) {
    logger.error({ err }, 'activities.list')
    throw err
  }
})
