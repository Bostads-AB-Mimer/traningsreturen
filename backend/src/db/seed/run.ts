/**
 * Seeds the database with the Swedish demo data from the prototype.
 * Destructive: clears all business tables first. Demo/dev environments only.
 */

import { db } from '../knex'
import { logger } from '../../logger'
import { toIsoDate } from '../../rules/dates'
import {
  DEMO_ACTIVITIES,
  DEMO_CORRECTIONS,
  DEMO_LEAVES,
  DEMO_USERS,
  generateDemoWorkouts,
} from './demo-data'

async function main() {
  const today = toIsoDate(new Date())
  const activityIdByName = new Map(DEMO_ACTIVITIES.map((a) => [a.name, a.id]))

  await db.transaction(async (trx) => {
    await trx('audit_log').del()
    await trx('delegations').del()
    await trx('corrections').del()
    await trx('leave_requests').del()
    await trx('workouts').del()
    await trx('activity_types').del()
    await trx('users').update({ manager_id: null, merged_into_user_id: null })
    await trx('users').del()

    await trx('users').insert(
      DEMO_USERS.map((u) => ({
        id: u.id,
        keycloak_username: u.keycloakUsername,
        name: u.name,
        department: u.department,
        title: u.title,
        active: u.active,
        is_manager: u.isManager ?? false,
        manager_id: null, // set after all rows exist (self-referencing FK)
      })),
    )
    for (const u of DEMO_USERS) {
      if (u.managerId) {
        await trx('users').where({ id: u.id }).update({ manager_id: u.managerId })
      }
    }

    await trx('activity_types').insert(
      DEMO_ACTIVITIES.map((a, i) => ({
        id: a.id,
        name: a.name,
        active: a.active,
        sort_order: i,
      })),
    )

    for (const user of DEMO_USERS) {
      const workouts = generateDemoWorkouts(user, today)
      if (!workouts.length) continue
      const rows = workouts.map((w) => {
        const activityTypeId = activityIdByName.get(w.activity)
        if (!activityTypeId) throw new Error(`Unknown demo activity: ${w.activity}`)
        return {
          id: w.id,
          user_id: w.userId,
          date: w.date,
          activity_type_id: activityTypeId,
          minutes: w.minutes,
        }
      })
      await trx.batchInsert('workouts', rows, 100)
    }

    await trx('leave_requests').insert(
      DEMO_LEAVES.map((l) => ({
        id: l.id,
        user_id: l.userId,
        date: l.date,
        start_time: l.startTime,
        hours: l.hours,
        status: l.status,
        comment: l.comment,
        attested_by_user_id: l.attestedByUserId,
        attested_by_name: l.attestedByName,
        attested_by_delegate: false,
        attested_at: l.status === 'pending' ? null : trx.fn.now(),
        applied_date: l.appliedDate,
      })),
    )

    await trx('corrections').insert(
      DEMO_CORRECTIONS.map((c) => ({
        id: c.id,
        user_id: c.userId,
        date: c.date,
        minutes: c.minutes,
        reason: c.reason,
        by_user_id: c.byUserId,
        by_name: c.byName,
      })),
    )
  })

  logger.info('Demo data seeded')
  await db.destroy()
}

main().catch((err) => {
  logger.error({ err }, 'db.seed')
  process.exitCode = 1
  return db.destroy()
})
