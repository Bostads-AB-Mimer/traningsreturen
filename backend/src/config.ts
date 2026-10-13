import dotenv from 'dotenv'
import { DEFAULT_RULES_CONFIG, RulesConfig } from './rules/types'

dotenv.config()

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  const parsed = parseInt(raw, 10)
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${name} must be an integer`)
  return parsed
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return raw === 'true' || raw === '1'
}

export interface AppConfig {
  port: number
  /** 'oidc' validates Keycloak JWTs; 'demo' trusts the x-demo-username header (demo environments only). */
  authMode: 'oidc' | 'demo'
  oidc: {
    issuer: string
    jwksUri: string
    audience: string | null
    /** Client id used to read app-specific roles from resource_access. */
    clientId: string
  }
  /** Create app users automatically on first login (name from token claims). */
  autoProvisionUsers: boolean
  db: {
    host: string
    port: number
    user: string
    password: string
    database: string
    /** TLS to SQL Server; central servers may require it. */
    encrypt: boolean
    trustServerCertificate: boolean
  }
  rules: RulesConfig
  corsOrigin: string
}

export function loadConfig(): AppConfig {
  const authMode = optional('AUTH_MODE', 'oidc')
  if (authMode !== 'oidc' && authMode !== 'demo') {
    throw new Error(`AUTH_MODE must be 'oidc' or 'demo', got '${authMode}'`)
  }
  const issuer =
    authMode === 'oidc'
      ? required('OIDC_ISSUER')
      : optional('OIDC_ISSUER', 'http://localhost:8080/realms/traningsreturen')
  return {
    port: optionalInt('PORT', 4000),
    authMode,
    oidc: {
      issuer,
      jwksUri: optional('OIDC_JWKS_URI', `${issuer}/protocol/openid-connect/certs`),
      audience: process.env.OIDC_AUDIENCE ?? null,
      clientId: optional('OIDC_CLIENT_ID', 'traningsreturen-app'),
    },
    autoProvisionUsers: optionalBool('AUTO_PROVISION_USERS', false),
    db: {
      host: optional('DB_HOST', 'localhost'),
      port: optionalInt('DB_PORT', 1433),
      user: optional('DB_USER', 'sa'),
      password: required('DB_PASSWORD'),
      database: optional('DB_NAME', 'traningsreturen'),
      encrypt: optionalBool('DB_ENCRYPT', false),
      trustServerCertificate: optionalBool('DB_TRUST_SERVER_CERT', true),
    },
    rules: {
      returnSharePercent: optionalInt(
        'RULES_RETURN_SHARE_PERCENT',
        DEFAULT_RULES_CONFIG.returnSharePercent,
      ),
      weeklyCapMinutes: optionalInt(
        'RULES_WEEKLY_CAP_MINUTES',
        DEFAULT_RULES_CONFIG.weeklyCapMinutes,
      ),
      maxBackdateDays: optionalInt('RULES_MAX_BACKDATE_DAYS', DEFAULT_RULES_CONFIG.maxBackdateDays),
      expiryEnabled: optionalBool('FEATURE_EXPIRY', DEFAULT_RULES_CONFIG.expiryEnabled),
      expiryMonths: optionalInt('RULES_EXPIRY_MONTHS', DEFAULT_RULES_CONFIG.expiryMonths),
      expiryWarningMonths: optionalInt(
        'RULES_EXPIRY_WARNING_MONTHS',
        DEFAULT_RULES_CONFIG.expiryWarningMonths,
      ),
    },
    corsOrigin: optional('CORS_ORIGIN', 'http://localhost:8081'),
  }
}

export const config = loadConfig()
