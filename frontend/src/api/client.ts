/**
 * Small typed fetch wrapper. Auth is injected by the AuthProvider: in OIDC
 * mode a Keycloak bearer token, in demo mode the selected persona header.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; code?: string } | null,
  ) {
    super(body?.error ? `${status} ${body.error}` : `HTTP ${status}`)
  }
}

export type AuthHeaderProvider = () => Promise<Record<string, string>>

let authHeaderProvider: AuthHeaderProvider = async () => ({})

export function setAuthHeaderProvider(provider: AuthHeaderProvider) {
  authHeaderProvider = provider
}

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeaderProvider()) }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    let errorBody: { error?: string; code?: string } | null = null
    try {
      errorBody = await response.json()
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, errorBody)
  }
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
