import { api } from '../../api/client'
import { AdminUser } from '../../api/types'
import { useToast } from '../../components/Toast'
import { fmtMinutes, initials } from '../../format'
import { chipStyle } from '../../theme'

interface Props {
  users: AdminUser[]
  search: string
  onSearch: (value: string) => void
  onOpen: (userId: string) => void
  onChanged: () => void
}

const GRID = 'minmax(220px,1.4fr) 110px 110px minmax(240px,1fr)'

export function UsersView({ users, search, onSearch, onOpen, onChanged }: Props) {
  const toast = useToast()

  const merge = async (user: AdminUser) => {
    if (!user.duplicateOfUserId) return
    const target = users.find((u) => u.id === user.duplicateOfUserId)
    try {
      const result = await api.post<{ mergedIntoName: string }>(
        `/api/admin/users/${user.duplicateOfUserId}/merge`,
        { duplicateUserId: user.id },
      )
      toast(`Konton sammanslagna – all historik flyttad till ${result.mergedIntoName}`)
      onChanged()
    } catch {
      toast(target ? 'Något gick fel – försök igen' : 'Något gick fel – försök igen')
    }
  }

  const toggleActive = async (user: AdminUser) => {
    try {
      await api.post(`/api/admin/users/${user.id}/active`, { active: !user.active })
      toast(user.active ? `${user.name} inaktiverades` : `${user.name} aktiverades`)
      onChanged()
    } catch {
      toast('Något gick fel – försök igen')
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .35s ease' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1
            style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Användare
          </h1>
          <div style={{ color: '#7C6B77', fontSize: 14 }}>
            Sök, öppna historik, slå ihop dubbletter och inaktivera konton
          </div>
        </div>
        <input
          type="text"
          placeholder="Sök namn eller avdelning…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            width: 260,
            maxWidth: '100%',
            padding: '12px 15px',
            border: '1.5px solid #EBDCE5',
            borderRadius: 13,
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            background: '#ffffff',
          }}
        />
      </div>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #F2E3EC',
          borderRadius: 20,
          padding: '6px 20px',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: 760 }}>
          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                gap: 12,
                alignItems: 'center',
                padding: '12px 4px',
                borderTop: '1px solid #F8EEF4',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: '#F0E6FA',
                    color: '#7A2E9D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 12.5,
                    flexShrink: 0,
                  }}
                >
                  {initials(u.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                    {u.possibleDuplicate && (
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: '#FFF3DC',
                          color: '#96690A',
                          fontSize: 10.5,
                          fontWeight: 800,
                        }}
                      >
                        Möjlig dubblett
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#9A8694' }}>
                    {u.title} · {u.department}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: '#C4006C' }}>
                {fmtMinutes(u.balanceMinutes)}
              </div>
              <div>
                <span
                  style={
                    u.active ? chipStyle('#E0F5EC', '#0B7B5D') : chipStyle('#F1EBEF', '#8A7484')
                  }
                >
                  {u.active ? 'Aktiv' : 'Inaktiverad'}
                </span>
              </div>
              <div
                style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}
              >
                <button
                  onClick={() => onOpen(u.id)}
                  className="hov-pink-strong"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: '#FBDFEE',
                    color: '#B4005F',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 12.5,
                    padding: '7px 12px',
                    borderRadius: 9,
                  }}
                >
                  Historik
                </button>
                {u.duplicateOfUserId && (
                  <button
                    onClick={() => merge(u)}
                    className="hov-amber-soft"
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      background: '#FFF3DC',
                      color: '#96690A',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: 12.5,
                      padding: '7px 12px',
                      borderRadius: 9,
                    }}
                  >
                    Slå ihop
                  </button>
                )}
                <button
                  onClick={() => toggleActive(u)}
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
                  {u.active ? 'Inaktivera' : 'Aktivera'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
