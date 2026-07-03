export type Role = 'employee' | 'manager' | 'admin'

export interface UserRow {
  id: string
  keycloak_username: string | null
  keycloak_id: string | null
  name: string
  department: string
  title: string
  active: boolean
  is_manager: boolean
  manager_id: string | null
  merged_into_user_id: string | null
}

export interface AuthContext {
  user: UserRow
  roles: Role[]
}
