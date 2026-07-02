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
  return { username, roles: extractRoles(payload) }
}

function extractRoles(payload: JWTPayload): Role[] {
  const realmAccess = payload.realm_access as { roles?: unknown } | undefined
  const raw = Array.isArray(realmAccess?.roles) ? realmAccess.roles : []
  return KNOWN_ROLES.filter((r) => raw.includes(r))
}
