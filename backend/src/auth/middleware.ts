import { Middleware } from 'koa'
import { randomUUID } from 'node:crypto'
import { config } from '../config'
import { db } from '../db/knex'
import { logger } from '../logger'
import { writeAudit } from '../audit'
import { verifyAccessToken } from './jwt'
import { AuthContext, Role, UserRow } from './types'

/**
 * Demo-mode role mapping: in real deployments roles always come from the
 * Keycloak token; in demo mode the frontend role switcher picks a persona.
 */
const DEMO_ROLES: Record<string, Role[]> = {
  'sara.lindqvist': ['employee'],
  'anna.berg': ['employee', 'manager'],
  'peter.ekstrom': ['employee', 'admin'],
}

async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  return db<UserRow>('users').where({ keycloak_username: username }).first()
}

interface AdProfile {
  displayName: string
  keycloakId: string
  title: string | null
  department: string | null
  /** The manager's Keycloak user id (AD-synced `managerId` attribute). */
  managerKeycloakId: string | null
}

/**
 * Resolves the AD-synced manager (a Keycloak user id) to an app user id.
 * Returns null when the manager hasn't logged in / been provisioned yet —
 * the relation self-heals on a later login. Marks the manager as such so
 * they show up as a delegation option.
 */
async function resolveManagerId(profile: AdProfile, selfId: string): Promise<string | null> {
  if (!profile.managerKeycloakId || profile.managerKeycloakId === profile.keycloakId) return null
  try {
    const manager = await db<UserRow>('users')
      .where({ keycloak_id: profile.managerKeycloakId })
      .first()
    if (!manager || manager.id === selfId) return null
    if (!manager.is_manager) {
      await db('users')
        .where({ id: manager.id })
        .update({ is_manager: true, updated_at: db.fn.now() })
    }
    return manager.id
  } catch (err) {
    logger.error({ err }, 'auth.resolveManagerId')
    throw err
  }
}

/**
 * Creates an app user on first login (JIT provisioning) when
 * AUTO_PROVISION_USERS is on. Name, title and department come from the
 * AD-synced token claims; the manager relation is set by an admin afterwards.
 */
async function provisionUser(username: string, profile: AdProfile): Promise<UserRow | undefined> {
  try {
    const id = randomUUID()
    const managerId = await resolveManagerId(profile, id)
    await db.transaction(async (trx) => {
      await trx('users').insert({
        id,
        keycloak_username: username,
        keycloak_id: profile.keycloakId || null,
        name: profile.displayName,
        department: profile.department ?? '',
        title: profile.title ?? '',
        active: true,
        is_manager: false,
        manager_id: managerId,
      })
      await writeAudit(trx, {
        actorUserId: id,
        actorName: profile.displayName,
        action: 'user.provisioned',
        entity: 'user',
        entityId: id,
        details: { username, title: profile.title, department: profile.department },
      })
    })
    logger.info({ username }, 'auth.provisionUser')
    return db<UserRow>('users').where({ id }).first()
  } catch (err) {
    logger.error({ err }, 'auth.provisionUser')
    throw err
  }
}

/**
 * Keeps name/title/department/manager in sync with AD on every login — the
 * token is the source of truth; empty claims never overwrite data.
 */
async function syncUserProfile(user: UserRow, profile: AdProfile): Promise<UserRow> {
  const patch: Partial<
    Pick<UserRow, 'name' | 'title' | 'department' | 'keycloak_id' | 'manager_id'>
  > = {}
  if (profile.displayName && profile.displayName !== user.name) patch.name = profile.displayName
  if (profile.title && profile.title !== user.title) patch.title = profile.title
  if (profile.department && profile.department !== user.department) {
    patch.department = profile.department
  }
  if (profile.keycloakId && profile.keycloakId !== user.keycloak_id) {
    patch.keycloak_id = profile.keycloakId
  }
  const managerId = await resolveManagerId(profile, user.id)
  if (managerId && managerId !== user.manager_id) patch.manager_id = managerId
  if (Object.keys(patch).length === 0) return user
  try {
    await db('users')
      .where({ id: user.id })
      .update({ ...patch, updated_at: db.fn.now() })
    logger.info({ userId: user.id, patch }, 'auth.syncUserProfile')
    return { ...user, ...patch }
  } catch (err) {
    logger.error({ err }, 'auth.syncUserProfile')
    throw err
  }
}

export function authMiddleware(): Middleware {
  return async (ctx, next) => {
    let username: string
    let roles: Role[]
    let adProfile: AdProfile | null = null

    if (config.authMode === 'demo') {
      const header = ctx.get('x-demo-username') || 'sara.lindqvist'
      username = header
      roles = DEMO_ROLES[header] ?? ['employee']
    } else {
      const authHeader = ctx.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        ctx.status = 401
        ctx.body = { error: 'missing-token' }
        return
      }
      try {
        const verified = await verifyAccessToken(authHeader.slice('Bearer '.length))
        username = verified.username
        roles = verified.roles
        adProfile = {
          displayName: verified.displayName,
          keycloakId: verified.keycloakId,
          title: verified.title,
          department: verified.department,
          managerKeycloakId: verified.managerKeycloakId,
        }
      } catch (err) {
        logger.warn({ err }, 'auth.verifyAccessToken')
        ctx.status = 401
        ctx.body = { error: 'invalid-token' }
        return
      }
    }

    let user = await findUserByUsername(username)
    if (!user && adProfile && config.autoProvisionUsers) {
      user = await provisionUser(username, {
        ...adProfile,
        displayName: adProfile.displayName || username,
      })
    } else if (user && adProfile) {
      user = await syncUserProfile(user, adProfile)
    }
    if (!user || !user.active) {
      ctx.status = 403
      ctx.body = { error: 'unknown-user' }
      return
    }
    const auth: AuthContext = { user, roles }
    ctx.state.auth = auth
    await next()
  }
}

export function requireRole(role: Role): Middleware {
  return async (ctx, next) => {
    const auth = ctx.state.auth as AuthContext | undefined
    if (!auth || !auth.roles.includes(role)) {
      ctx.status = 403
      ctx.body = { error: 'forbidden' }
      return
    }
    await next()
  }
}

export function getAuth(ctx: { state: { auth?: AuthContext } }): AuthContext {
  const auth = ctx.state.auth
  if (!auth) throw new Error('authMiddleware must run before this route')
  return auth
}
