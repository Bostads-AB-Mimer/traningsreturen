import { useEffect, useState } from 'react'
import {
  Account,
  ActivityType,
  AdminStats,
  AdminUser,
  AdminUserAccount,
  AttesterInfo,
  DelegationState,
  HandledLeave,
  Leave,
  PendingLeave,
  Team,
} from './api/types'
import { UiRole, useAuth } from './auth/AuthProvider'
import { useApi } from './hooks/useApi'
import { initials } from './format'
import { segmentStyle, tabStyle } from './theme'
import { HomeView } from './views/employee/HomeView'
import { RegisterView } from './views/employee/RegisterView'
import { WorkoutsView } from './views/employee/WorkoutsView'
import { LeaveView } from './views/employee/LeaveView'
import { BalanceView } from './views/employee/BalanceView'
import { TeamView } from './views/manager/TeamView'
import { AttestView } from './views/manager/AttestView'
import { DelegateView } from './views/manager/DelegateView'
import { StatsView } from './views/admin/StatsView'
import { UsersView } from './views/admin/UsersView'
import { UserDetailView } from './views/admin/UserDetailView'
import { ActivitiesView } from './views/admin/ActivitiesView'

const ROLE_LABELS: Record<UiRole, string> = {
  medarbetare: 'Medarbetare',
  chef: 'Chef',
  admin: 'Admin',
}

function Loading() {
  return <div style={{ color: '#9A8694', padding: 20, fontWeight: 600 }}>Laddar…</div>
}

function EmployeeSection({ tab, onNavigate }: { tab: string; onNavigate: (t: string) => void }) {
  const { me, config } = useAuth()
  const account = useApi<Account>('/api/me/account', [me.id])
  const leaves = useApi<Leave[]>('/api/me/leaves', [me.id])
  const attester = useApi<AttesterInfo>('/api/me/attester', [me.id])
  const activities = useApi<ActivityType[]>('/api/activity-types', [me.id])
  const topActivities = useApi<{ id: string; name: string }[]>('/api/me/top-activities', [me.id])

  const refetchAccount = () => {
    void account.refetch()
    void topActivities.refetch()
  }

  if (tab === 'hem') {
    if (!account.data || !leaves.data) return <Loading />
    return (
      <HomeView
        me={me}
        config={config}
        account={account.data}
        leaves={leaves.data}
        onNavigate={onNavigate}
      />
    )
  }
  if (tab === 'reg') {
    if (!activities.data || !topActivities.data) return <Loading />
    return (
      <RegisterView
        config={config}
        activities={activities.data}
        topActivities={topActivities.data}
        onRegistered={refetchAccount}
      />
    )
  }
  if (tab === 'pass') {
    if (!account.data || !activities.data) return <Loading />
    return (
      <WorkoutsView
        account={account.data}
        activities={activities.data}
        onChanged={refetchAccount}
      />
    )
  }
  if (tab === 'led') {
    if (!account.data || !leaves.data || !attester.data) return <Loading />
    return (
      <LeaveView
        account={account.data}
        leaves={leaves.data}
        attester={attester.data}
        onChanged={() => {
          void leaves.refetch()
          void account.refetch()
        }}
      />
    )
  }
  if (tab === 'saldo') {
    if (!account.data) return <Loading />
    return <BalanceView config={config} account={account.data} />
  }
  return null
}

function ManagerSection({
  tab,
  onPendingCount,
}: {
  tab: string
  onPendingCount: (n: number) => void
}) {
  const { me } = useAuth()
  const team = useApi<Team>('/api/team', [me.id])
  const pending = useApi<PendingLeave[]>('/api/attest/pending', [me.id])
  const handled = useApi<HandledLeave[]>('/api/attest/handled', [me.id])
  const delegation = useApi<DelegationState>('/api/delegation', [me.id])

  useEffect(() => {
    if (pending.data) onPendingCount(pending.data.length)
  }, [pending.data, onPendingCount])

  if (tab === 'team') {
    if (!team.data) return <Loading />
    return <TeamView team={team.data} />
  }
  if (tab === 'attest') {
    if (!pending.data || !handled.data) return <Loading />
    return (
      <AttestView
        pending={pending.data}
        handled={handled.data}
        delegation={delegation.data}
        onChanged={() => {
          void pending.refetch()
          void handled.refetch()
          void team.refetch()
        }}
      />
    )
  }
  if (tab === 'deleg') {
    if (!delegation.data) return <Loading />
    return <DelegateView delegation={delegation.data} onChanged={() => void delegation.refetch()} />
  }
  return null
}

function AdminSection({
  tab,
  openUserId,
  onOpenUser,
}: {
  tab: string
  openUserId: string | null
  onOpenUser: (id: string | null) => void
}) {
  const { me, config } = useAuth()
  const [search, setSearch] = useState('')
  const stats = useApi<AdminStats>('/api/admin/stats', [me.id])
  const users = useApi<AdminUser[]>(`/api/admin/users?query=${encodeURIComponent(search)}`, [me.id])
  const detail = useApi<AdminUserAccount>(
    openUserId ? `/api/admin/users/${openUserId}/account` : null,
    [me.id, openUserId],
  )
  const activities = useApi<ActivityType[]>('/api/activity-types', [me.id])

  if (tab === 'stat') {
    if (!stats.data) return <Loading />
    return <StatsView stats={stats.data} />
  }
  if (tab === 'anv') {
    if (openUserId) {
      if (!detail.data) return <Loading />
      return (
        <UserDetailView
          config={config}
          detail={detail.data}
          onBack={() => onOpenUser(null)}
          onChanged={() => void detail.refetch()}
        />
      )
    }
    if (!users.data) return <Loading />
    return (
      <UsersView
        users={users.data}
        search={search}
        onSearch={setSearch}
        onOpen={onOpenUser}
        onChanged={() => void users.refetch()}
      />
    )
  }
  if (tab === 'akt') {
    if (!activities.data) return <Loading />
    return (
      <ActivitiesView activities={activities.data} onChanged={() => void activities.refetch()} />
    )
  }
  return null
}

export function App() {
  const { config, me, availableRoles, role, setRole, logout } = useAuth()
  const [employeeTab, setEmployeeTab] = useState('hem')
  const [managerTab, setManagerTab] = useState('team')
  const [adminTab, setAdminTab] = useState('stat')
  const [openUserId, setOpenUserId] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const tabDefs: Record<UiRole, [string, string][]> = {
    medarbetare: [
      ['hem', 'Min sida'],
      ['reg', 'Registrera träning'],
      ['pass', 'Mina pass'],
      ['led', 'Ansök om ledighet'],
      ['saldo', 'Mitt saldo'],
    ],
    chef: [
      ['team', 'Mitt team'],
      ['attest', 'Attestera' + (pendingCount ? ` (${pendingCount})` : '')],
      ['deleg', 'Delegera attest'],
    ],
    admin: [
      ['stat', 'Statistik'],
      ['anv', 'Användare'],
      ['akt', 'Aktivitetstyper'],
    ],
  }
  const activeTab = { medarbetare: employeeTab, chef: managerTab, admin: adminTab }[role]
  const setActiveTab = (key: string) => {
    if (role === 'medarbetare') setEmployeeTab(key)
    if (role === 'chef') setManagerTab(key)
    if (role === 'admin') {
      setAdminTab(key)
      if (key === 'anv') setOpenUserId(null)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAF5F8',
        fontFamily: "'Outfit', sans-serif",
        color: '#241A21',
      }}
    >
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #F2E3EC',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 13,
                background: '#E0007A',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 19,
              }}
            >
              T
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 17,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15,
                }}
              >
                Träningsreturen
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#A18F9B',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}
              >
                Bostads AB Mimer
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {availableRoles.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                background: '#F6ECF2',
                borderRadius: 999,
                padding: 4,
              }}
            >
              {availableRoles.map((r) => (
                <button key={r} onClick={() => setRole(r)} style={segmentStyle(role === r)}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#7A2E9D',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {initials(me.name)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>{me.name}</div>
              <div style={{ fontSize: 12, color: '#9A8694', lineHeight: 1.2 }}>{me.title}</div>
            </div>
            {logout && (
              <button
                onClick={logout}
                className="hov-rose"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                  color: '#9A8694',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12.5,
                  padding: '7px 10px',
                  borderRadius: 9,
                }}
              >
                Logga ut
              </button>
            )}
          </div>
        </div>
      </header>

      <nav
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '14px 20px 0',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        {tabDefs[role].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={tabStyle(activeTab === key)}>
            {label}
          </button>
        ))}
      </nav>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 20px 60px' }}>
        {role === 'medarbetare' && (
          <EmployeeSection tab={employeeTab} onNavigate={setEmployeeTab} />
        )}
        {role === 'chef' && <ManagerSection tab={managerTab} onPendingCount={setPendingCount} />}
        {role === 'admin' && (
          <AdminSection tab={adminTab} openUserId={openUserId} onOpenUser={setOpenUserId} />
        )}
      </main>

      <footer
        style={{
          textAlign: 'center',
          padding: '0 20px 36px',
          color: '#C1AEBB',
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        {config.authMode === 'demo' ? 'Demomiljö · ' : ''}Träningsreturen för Bostads AB Mimer
      </footer>
    </div>
  )
}
