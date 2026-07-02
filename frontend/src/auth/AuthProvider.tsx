import Keycloak from 'keycloak-js'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { api, setAuthHeaderProvider } from '../api/client'
import { AppConfig, Me } from '../api/types'

/** UI roles use the prototype's Swedish names. */
export type UiRole = 'medarbetare' | 'chef' | 'admin'

/** Demo personas — the role switcher swaps between these users. */
const DEMO_PERSONAS: Record<UiRole, string> = {
  medarbetare: 'sara.lindqvist',
  chef: 'anna.berg',
  admin: 'peter.ekstrom',
}

interface AuthState {
  config: AppConfig
  me: Me
  /** Roles the current login may act as. */
  availableRoles: UiRole[]
  role: UiRole
  setRole: (role: UiRole) => void
  logout: (() => void) | null
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

function uiRolesFromApiRoles(roles: Me['roles']): UiRole[] {
  const out: UiRole[] = []
  if (roles.includes('employee')) out.push('medarbetare')
  if (roles.includes('manager')) out.push('chef')
  if (roles.includes('admin')) out.push('admin')
  return out.length ? out : ['medarbetare']
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [role, setRoleState] = useState<UiRole>('medarbetare')
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Bootstrap: fetch public config, then authenticate.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await api.get<AppConfig>('/api/config')
        if (cancelled) return
        if (cfg.authMode === 'demo') {
          setAuthHeaderProvider(async () => ({
            'x-demo-username': DEMO_PERSONAS[(window as DemoWindow).__demoRole ?? 'medarbetare'],
          }))
          setConfig(cfg)
        } else {
          const kc = new Keycloak({
            url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
            realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'traningsreturen',
            clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'traningsreturen-app',
          })
          await kc.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false })
          if (cancelled) return
          setAuthHeaderProvider(async () => {
            await kc.updateToken(30).catch(() => kc.login())
            return { Authorization: `Bearer ${kc.token}` }
          })
          setKeycloak(kc)
          setConfig(cfg)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Load profile whenever auth (or the demo persona) changes.
  useEffect(() => {
    if (!config) return
    let cancelled = false
    api
      .get<Me>('/api/me')
      .then((profile) => {
        if (!cancelled) setMe(profile)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [config, role])

  const setRole = useCallback(
    (next: UiRole) => {
      ;(window as DemoWindow).__demoRole = next
      setRoleState(next)
      if (config?.authMode === 'demo') setMe(null) // persona switches → reload profile
    },
    [config],
  )

  const availableRoles = useMemo<UiRole[]>(() => {
    if (!config || !me) return []
    if (config.authMode === 'demo') return ['medarbetare', 'chef', 'admin']
    return uiRolesFromApiRoles(me.roles)
  }, [config, me])

  // In OIDC mode default to the "highest" view the user has.
  useEffect(() => {
    if (availableRoles.length && !availableRoles.includes(role)) {
      setRoleState(availableRoles[0] as UiRole)
    }
  }, [availableRoles, role])

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: "'Outfit', sans-serif", color: '#C22F45' }}>
        Kunde inte ansluta: {error}
      </div>
    )
  }
  if (!config || !me) {
    return (
      <div style={{ padding: 40, fontFamily: "'Outfit', sans-serif", color: '#9A8694' }}>
        Laddar…
      </div>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        config,
        me,
        availableRoles,
        role,
        setRole,
        logout: keycloak ? () => keycloak.logout() : null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

interface DemoWindow extends Window {
  __demoRole?: UiRole
}
