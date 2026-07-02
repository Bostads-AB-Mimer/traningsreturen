import { Middleware } from 'koa'
import { config } from '../config'
import { db } from '../db/knex'
import { logger } from '../logger'
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

export function authMiddleware(): Middleware {
  return async (ctx, next) => {
    let username: string
    let roles: Role[]

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
      } catch (err) {
        logger.warn({ err }, 'auth.verifyAccessToken')
        ctx.status = 401
        ctx.body = { error: 'invalid-token' }
        return
      }
    }

    const user = await findUserByUsername(username)
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
