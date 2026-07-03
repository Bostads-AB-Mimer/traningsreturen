import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'
import { config } from '../config'
import { Role } from './types'

const KNOWN_ROLES: Role[] = ['employee', 'manager', 'admin']

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(config.oidc.jwksUri))
  return jwks
}

export interface VerifiedToken {
  username: string
  roles: Role[]
  /** Display name from token claims — used when auto-provisioning users. */
  displayName: string
  /** AD-synced attributes, present when the client maps them into the token. */
  title: string | null
  department: string | null
}

/** Validates the Keycloak-issued JWT (signature, issuer, expiry) on every call. */
export async function verifyAccessToken(token: string): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: config.oidc.issuer,
    ...(config.oidc.audience ? { audience: config.oidc.audience } : {}),
  })
  const username = payload.preferred_username
  if (typeof username !== 'string' || !username) {
    throw new Error('Token is missing preferred_username')
  }
  return {
    username,
    roles: extractRoles(payload, config.oidc.clientId),
    displayName: extractDisplayName(payload, username),
    title: extractClaim(payload, ['jobTitle', 'job_title', 'title']),
    department: extractClaim(payload, ['officeLocation', 'office_location', 'department']),
  }
}

/** First non-empty string claim among the given names (mapper naming varies). */
export function extractClaim(payload: JWTPayload, names: string[]): string | null {
  for (const name of names) {
    const value = payload[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/**
 * App roles can live either as realm roles (realm_access.roles) or — in a
 * shared realm like Mimer's — as client roles under
 * resource_access[clientId].roles. Both are honoured.
 */
export function extractRoles(payload: JWTPayload, clientId: string): Role[] {
  const realmAccess = payload.realm_access as { roles?: unknown } | undefined
  const resourceAccess = payload.resource_access as Record<string, { roles?: unknown }> | undefined
  const realmRoles = Array.isArray(realmAccess?.roles) ? realmAccess.roles : []
  const clientRoles = Array.isArray(resourceAccess?.[clientId]?.roles)
    ? (resourceAccess[clientId]!.roles as unknown[])
    : []
  const all = new Set([...realmRoles, ...clientRoles])
  return KNOWN_ROLES.filter((r) => all.has(r))
}

function extractDisplayName(payload: JWTPayload, fallback: string): string {
  if (typeof payload.name === 'string' && payload.name.trim()) return payload.name.trim()
  const given = typeof payload.given_name === 'string' ? payload.given_name.trim() : ''
  const family = typeof payload.family_name === 'string' ? payload.family_name.trim() : ''
  const combined = [given, family].filter(Boolean).join(' ')
  return combined || fallback
}
