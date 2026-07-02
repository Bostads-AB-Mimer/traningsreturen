import { useState } from 'react'
import { api } from '../../api/client'
import { AdminUserAccount, AppConfig } from '../../api/types'
import { LedgerTable } from '../../components/LedgerTable'
import { useToast } from '../../components/Toast'
import { fmtDate, fmtMinutes, initials } from '../../format'
import { activityColor, cardLabelStyle, dotStyle } from '../../theme'

interface Props {
  config: AppConfig
  detail: AdminUserAccount
  onBack: () => void
  onChanged: () => void
}

export function UserDetailView({ config, detail, onBack, onChanged }: Props) {
  const toast = useToast()
  const [fixMinutes, setFixMinutes] = useState('')
  const [fixReason, setFixReason] = useState('')

  const applyFix = async () => {
    const minutes = parseInt(fixMinutes, 10)
    if (!minutes || !fixReason.trim()) {
      toast('Ange minuter (+/−) och orsak')
      return
    }
    try {
      await api.post(`/api/admin/users/${detail.user.id}/corrections`, {
        minutes,
        reason: fixReason.trim(),
      })
      setFixMinutes('')
      setFixReason('')
      toast('Korrigering sparad – loggad i saldohistoriken')
      onChanged()
    } catch {
      toast('Något gick fel – försök igen')
    }
  }

  const recentWorkouts = [...detail.account.workouts].reverse().slice(0, 8)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .35s ease' }}
    >
      <div>
        <button
          onClick={onBack}
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
            marginBottom: 6,
          }}
        >
          ‹ Alla användare
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: '#F0E6FA',
              color: '#7A2E9D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            {initials(detail.user.name)}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {detail.user.name}
            </h1>
            <div style={{ color: '#9A8694', fontSize: 13.5 }}>
              {detail.user.title} · {detail.user.department}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #F2E3EC',
                borderRadius: 13,
                padding: '9px 14px',
              }}
            >
              <span style={{ fontSize: 11, color: '#A18F9B', fontWeight: 800 }}>
                SALDO&nbsp;&nbsp;
              </span>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#C4006C' }}>
                {fmtMinutes(detail.account.balanceMinutes)}
              </span>
            </div>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #F2E3EC',
                borderRadius: 13,
                padding: '9px 14px',
              }}
            >
              <span style={{ fontSize: 11, color: '#A18F9B', fontWeight: 800 }}>
                TRÄNING TOTALT&nbsp;&nbsp;
              </span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>
                {fmtMinutes(detail.account.totalWorkoutMinutes)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          color: '#7C6B77',
          fontSize: 13.5,
          background: '#FDF7FA',
          borderRadius: 12,
          padding: '10px 14px',
        }}
      >
        Detta är exakt samma kontoutdrag som medarbetaren ser – använd det för att reda ut frågor om
        saldot.
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
            display: 'flex',
            flexDirection: 'column',
            gap: 13,
          }}
        >
          <div style={cardLabelStyle}>Lägg till korrigering</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="number"
              placeholder="Minuter, t.ex. −45 eller 30"
              value={fixMinutes}
              onChange={(e) => setFixMinutes(e.target.value)}
              style={{
                width: 200,
                padding: '11px 14px',
                border: '1.5px solid #EBDCE5',
                borderRadius: 12,
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                background: '#ffffff',
              }}
            />
          </div>
          <input
            type="text"
            placeholder="Orsak (obligatorisk, syns för medarbetaren)"
            value={fixReason}
            onChange={(e) => setFixReason(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              border: '1.5px solid #EBDCE5',
              borderRadius: 12,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 500,
              background: '#ffffff',
            }}
          />
          <button
            onClick={applyFix}
            className="hov-purple"
            style={{
              border: 'none',
              cursor: 'pointer',
              background: '#7A2E9D',
              color: '#ffffff',
              fontFamily: 'inherit',
              fontWeight: 800,
              fontSize: 14.5,
              padding: '12px 18px',
              borderRadius: 13,
            }}
          >
            Spara korrigering
          </button>
          <div style={{ fontSize: 12.5, color: '#9A8694', lineHeight: 1.45 }}>
            Korrigeringen loggas synligt i medarbetarens saldohistorik med ditt namn, datum och
            orsak.
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
          <div style={{ ...cardLabelStyle, marginBottom: 8 }}>Senaste träningspass</div>
          {recentWorkouts.map((w) => (
            <div
              key={w.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderTop: '1px solid #F8EEF4',
              }}
            >
              <div style={dotStyle(activityColor(w.activity))} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{w.activity}</div>
                <div style={{ fontSize: 12, color: '#9A8694' }}>
                  {fmtDate(w.date)} · {w.minutes} min
                </div>
              </div>
              <button
                onClick={() =>
                  setFixReason(`Avser pass ${fmtDate(w.date)} (${w.activity} ${w.minutes} min): `)
                }
                className="hov-purple-soft"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                  color: '#7A2E9D',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12.5,
                  padding: '5px 8px',
                  borderRadius: 8,
                }}
              >
                Rätta
              </button>
            </div>
          ))}
        </div>
      </div>

      <LedgerTable
        entries={detail.account.entries}
        expiryEnabled={config.features.expiryEnabled}
        showConceptBadge={false}
      />
    </div>
  )
}
