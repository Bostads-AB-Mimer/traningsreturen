import { Team } from '../../api/types'
import { fmtDate, fmtMinutes, initials } from '../../format'

interface Props {
  team: Team
}

const GRID = 'minmax(190px,1.3fr) 110px minmax(150px,1fr) minmax(140px,1fr) 130px'

export function TeamView({ team }: Props) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .35s ease' }}
    >
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Mitt team
        </h1>
        <div style={{ color: '#7C6B77', fontSize: 14 }}>
          {team.members.length} medarbetare · {team.departmentSummary.join(' och ')}
        </div>
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
        <div style={{ minWidth: 700 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              gap: 12,
              padding: '13px 4px',
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#A18F9B',
            }}
          >
            <div>Medarbetare</div>
            <div>Saldo</div>
            <div>Denna vecka</div>
            <div>Senaste pass</div>
            <div></div>
          </div>
          {team.members.map((m) => {
            const pct = Math.min(100, Math.round((m.weekEarnedMinutes / m.weeklyCapMinutes) * 100))
            return (
              <div
                key={m.id}
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
                    {initials(m.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#9A8694' }}>{m.title}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#C4006C' }}>
                  {fmtMinutes(m.balanceMinutes)}
                </div>
                <div>
                  <div
                    style={{ fontSize: 12.5, fontWeight: 700, color: '#5C4B57', marginBottom: 4 }}
                  >
                    {m.weekEarnedMinutes} av {m.weeklyCapMinutes} min
                  </div>
                  <div
                    style={{
                      background: '#F6ECF2',
                      borderRadius: 999,
                      height: 6,
                      overflow: 'hidden',
                      maxWidth: 120,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: '#00A5A0',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: '#7C6B77' }}>
                  {m.latestWorkout
                    ? `${fmtDate(m.latestWorkout.date)} · ${m.latestWorkout.activity}`
                    : '–'}
                </div>
                <div>
                  {m.hasPendingLeave && (
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: '#FFF3DC',
                        color: '#96690A',
                        fontSize: 11.5,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Ansökan väntar
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
