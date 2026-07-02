import { AdminStats } from '../../api/types'
import { fmtHours } from '../../format'
import { activityColor, cardLabelStyle, dotStyle } from '../../theme'
import { MONTHS_SHORT } from '../../format'

interface Props {
  stats: AdminStats
}

export function StatsView({ stats }: Props) {
  const gaugePct = stats.employeeCount
    ? Math.round((stats.appUserCount / stats.employeeCount) * 100)
    : 0
  const maxMonth = Math.max(...stats.monthlyMinutes.map((m) => m.minutes), 1)
  const maxActivity = Math.max(...stats.popularActivities.map((a) => a.minutes), 1)
  const grandTotal = stats.popularActivities.reduce((s, a) => s + a.minutes, 0) || 1

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .35s ease' }}
    >
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Statistik
        </h1>
        <div style={{ color: '#7C6B77', fontSize: 14 }}>
          Träningsreturen i hela organisationen · senaste 12 månaderna
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
          gap: 14,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ ...cardLabelStyle, letterSpacing: '0.08em' }}>Aktiva användare</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>
            {stats.appUserCount}
          </div>
          <div style={{ fontSize: 13, color: '#7C6B77' }}>av {stats.employeeCount} anställda</div>
        </div>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 20,
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: `conic-gradient(#E0007A 0deg ${Math.round(gaugePct * 3.6)}deg, #F4E4EE ${Math.round(gaugePct * 3.6)}deg 360deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 66,
                height: 66,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 16,
                color: '#C4006C',
              }}
            >
              {gaugePct} %
            </div>
          </div>
          <div>
            <div style={{ ...cardLabelStyle, letterSpacing: '0.08em' }}>Mot mål</div>
            <div
              style={{
                fontSize: 13.5,
                color: '#5C4B57',
                fontWeight: 600,
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              Mål: {stats.goalPercent}&nbsp;% av alla anställda använder appen
            </div>
          </div>
        </div>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ ...cardLabelStyle, letterSpacing: '0.08em' }}>Registrerad träning i år</div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginTop: 6,
              color: '#00A5A0',
            }}
          >
            {Math.round(stats.trainedYearMinutes / 60)} h
          </div>
          <div style={{ fontSize: 13, color: '#7C6B77' }}>bland demo-användarna</div>
        </div>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ ...cardLabelStyle, letterSpacing: '0.08em' }}>Uttagen ledighet i år</div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginTop: 6,
              color: '#7A2E9D',
            }}
          >
            {fmtHours(stats.withdrawnYearHours)}
          </div>
          <div style={{ fontSize: 13, color: '#7C6B77' }}>attesterade uttag</div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
          gap: 14,
          alignItems: 'start',
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
          <div style={{ ...cardLabelStyle, marginBottom: 16 }}>Träningstid per månad</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 170 }}>
            {stats.monthlyMinutes.map((m, i) => (
              <div
                key={`${m.year}-${m.month}`}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div style={{ fontSize: 10.5, color: '#A18F9B', fontWeight: 700 }}>
                  {Math.round(m.minutes / 60)} h
                </div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 26,
                    height: `${Math.max(3, Math.round((m.minutes / maxMonth) * 100))}%`,
                    background: i === stats.monthlyMinutes.length - 1 ? '#E0007A' : '#F0A6CE',
                    borderRadius: '6px 6px 3px 3px',
                  }}
                />
                <div style={{ fontSize: 11, color: '#9A8694', fontWeight: 700 }}>
                  {MONTHS_SHORT[m.month - 1]}
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
          <div style={{ ...cardLabelStyle, marginBottom: 14 }}>Populäraste aktiviteter</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {stats.popularActivities.map((a) => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={dotStyle(activityColor(a.name))} />
                <div style={{ width: 100, fontWeight: 700, fontSize: 13.5, flexShrink: 0 }}>
                  {a.name}
                </div>
                <div
                  style={{
                    flex: 1,
                    background: '#F8EEF4',
                    borderRadius: 999,
                    height: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round((a.minutes / maxActivity) * 100)}%`,
                      height: '100%',
                      background: activityColor(a.name),
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 44,
                    textAlign: 'right',
                    fontWeight: 800,
                    fontSize: 13,
                    color: '#5C4B57',
                  }}
                >
                  {Math.round((a.minutes / grandTotal) * 100)} %
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
