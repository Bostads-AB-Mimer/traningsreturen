import { Knex } from 'knex'
import { logger } from './logger'

export interface AuditEvent {
  actorUserId: string | null
  actorName: string
  action: string
  entity: string
  entityId: string | null
  details?: Record<string, unknown>
}

/**
 * Writes one row to the audit log. Every balance-affecting event and every
 * admin action goes through here. Pass the transaction so the audit row
 * commits atomically with the change it describes.
 */
export async function writeAudit(trx: Knex | Knex.Transaction, event: AuditEvent): Promise<void> {
  try {
    await trx('audit_log').insert({
      actor_user_id: event.actorUserId,
      actor_name: event.actorName,
      action: event.action,
      entity: event.entity,
      entity_id: event.entityId,
      details: event.details ? JSON.stringify(event.details) : null,
    })
  } catch (err) {
    logger.error({ err }, 'audit.writeAudit')
    throw err
  }
}
