import { Account, AppConfig, Leave, Me } from '../../api/types'
import { fmtDate, fmtDateShort, fmtMinutes, fmtSignedMinutes, fmtTodayLong } from '../../format'
import { activityColor, cardLabelStyle, dotStyle, leaveStatusChip } from '../../theme'
import { ledgerAmountStyle, ledgerLabel } from '../../components/ledger'

interface Props {
  me: Me
  config: AppConfig
  account: Account
  leaves: Leave[]
  onNavigate: (tab: string) => void
}

export function HomeView({ me, config, account, leaves, onNavigate }: Props) {
  const cap = config.rules.weeklyCapMinutes
  const weekPct = Math.min(100, Math.round((account.currentWeekEarnedMinutes / cap) * 100))
  const minutesPerHour = Math.round(60 * (config.rules.returnSharePercent / 100))
  const firstName = me.name.split(' ')[0]
  const showExpiryCard = config.features.expiryEnabled && account.expiringSoonMinutes > 0
  const recentWorkouts = [...account.workouts].reverse().slice(0, 4)
  const recentLeaves = leaves.slice(0, 3)
  const miniLog = [...account.entries].reverse().slice(0, 6)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeUp .35s ease' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Hej {firstName}!
        </h1>
        <div style={{ color: '#9A8694', fontSize: 14, fontWeight: 500 }}>{fmtTodayLong()}</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))',
          gap: 16,
        }}
      >
        <div
          style={{
            background: '#E0007A',
            borderRadius: 22,
            padding: 24,
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: '0 14px 30px rgba(224,0,122,0.22)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            Tillgänglig ledighet
          </div>
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {fmtMinutes(account.balanceMinutes)}
          </div>
          <div style={{ fontSize: 13.5, opacity: 0.92 }}>
            Totalt registrerad träning: {fmtMinutes(account.totalWorkoutMinutes)}
          </div>
          <div>
            <button
              onClick={() => onNavigate('led')}
              className="hov-white-veil"
              style={{
                marginTop: 6,
                border: 'none',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.18)',
                color: '#ffffff',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13.5,
                padding: '9px 16px',
                borderRadius: 999,
              }}
            >
              Ansök om ledighet →
            </button>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 22,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={cardLabelStyle}>Intjänat denna vecka</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {account.currentWeekEarnedMinutes}{' '}
            <span style={{ fontSize: 15, fontWeight: 600, color: '#9A8694' }}>av {cap} min</span>
          </div>
          <div style={{ background: '#F6ECF2', borderRadius: 999, height: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: `${weekPct}%`,
                height: '100%',
                background: '#00A5A0',
                borderRadius: 999,
                transition: 'width .3s',
              }}
            />
          </div>
          <div style={{ fontSize: 13, color: '#7C6B77' }}>
            1 h pulshöjande träning = {minutesPerHour} min ledighet
          </div>
          <div>
            <button
              onClick={() => onNavigate('reg')}
              className="hov-underline"
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'none',
                color: '#C4006C',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13.5,
                padding: '4px 0',
              }}
            >
              Registrera pass →
            </button>
          </div>
        </div>

        {showExpiryCard && (
          <div
            style={{
              background: '#FFF8EE',
              border: '1.5px dashed #E0A75E',
              borderRadius: 22,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#FFE4C2',
                  color: '#8F5300',
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '0.09em',
                }}
              >
                KONCEPT
              </span>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: '#B07B3A',
                }}
              >
                Tid som förfaller
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, color: '#6E4A12' }}>
              {fmtMinutes(account.expiringSoonMinutes)} förfaller inom 3 månader
            </div>
            <div style={{ fontSize: 13, color: '#8F6E3E', lineHeight: 1.45 }}>
              Intjänad tid gäller i 12 månader – äldst tid används först när du tar ut ledighet.
              Första förfall: {account.firstExpiryDate ? fmtDate(account.firstExpiryDate) : '–'}.
            </div>
            <div>
              <button
                onClick={() => onNavigate('saldo')}
                className="hov-underline"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                  color: '#A05A00',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 13.5,
                  padding: '4px 0',
                }}
              >
                Se förfallodatum i Mitt saldo →
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
          gap: 16,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 20,
            padding: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={cardLabelStyle}>Senaste pass</div>
            <button
              onClick={() => onNavigate('pass')}
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'none',
                color: '#C4006C',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12.5,
              }}
            >
              Visa alla
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentWorkouts.map((w) => (
              <div
                key={w.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderTop: '1px solid #F8EEF4',
                }}
              >
                <div style={dotStyle(activityColor(w.activity))} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{w.activity}</div>
                  <div style={{ fontSize: 12.5, color: '#9A8694' }}>{fmtDateShort(w.date)}</div>
                </div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: '#5C4B57' }}>
                  {w.minutes} min
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 12.5,
                    color: '#0B7B5D',
                    background: '#E0F5EC',
                    padding: '3px 9px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  +{w.earnedMinutes} min
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 20,
            padding: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={cardLabelStyle}>Senaste ansökningar</div>
            <button
              onClick={() => onNavigate('led')}
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'none',
                color: '#C4006C',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12.5,
              }}
            >
              Ansök
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentLeaves.map((l) => {
              const chip = leaveStatusChip(l.status)
              return (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 0',
                    borderTop: '1px solid #F8EEF4',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {fmtDate(l.date)} kl {l.startTime}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#9A8694' }}>
                      {String(l.hours).replace('.', ',')} h
                    </div>
                  </div>
                  <span style={chip.style}>{chip.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 20,
            padding: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={cardLabelStyle}>Aktivitetslogg</div>
            <button
              onClick={() => onNavigate('saldo')}
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'none',
                color: '#C4006C',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12.5,
              }}
            >
              Hela historiken
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {miniLog.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 0',
                  borderTop: '1px solid #F8EEF4',
                }}
              >
                <div style={{ fontSize: 12, color: '#9A8694', width: 74, flexShrink: 0 }}>
                  {fmtDate(entry.date)}
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#4A3B45',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ledgerLabel(entry)}
                </div>
                <div style={ledgerAmountStyle(entry)}>{fmtSignedMinutes(entry.minutes)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
