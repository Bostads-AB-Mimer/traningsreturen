import { useState } from 'react'
import { api, ApiError } from '../../api/client'
import { Account, AttesterInfo, Leave } from '../../api/types'
import { useToast } from '../../components/Toast'
import { fmtDate, fmtHours, fmtMinutes } from '../../format'
import { leaveStatusChip } from '../../theme'

interface Props {
  account: Account
  leaves: Leave[]
  attester: AttesterInfo
  onChanged: () => void
}

export function LeaveView({ account, leaves, attester, onChanged }: Props) {
  const toast = useToast()
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('13:00')
  const [hours, setHours] = useState(2)
  const [submitting, setSubmitting] = useState(false)

  const after = account.balanceMinutes - hours * 60
  const attesterName = attester.delegated ? `${attester.name} (delegerad attest)` : attester.name

  const submit = async () => {
    if (!date) {
      toast('Välj datum för ledigheten')
      return
    }
    if (hours < 0.25) {
      toast('Minsta uttag är 0,25 h')
      return
    }
    if (after < 0) {
      toast('Saldot räcker inte för det uttaget')
      return
    }
    setSubmitting(true)
    try {
      const result = await api.post<{ leave: Leave; attester: AttesterInfo }>('/api/me/leaves', {
        date,
        startTime,
        hours,
      })
      setDate('')
      toast(`Ansökan skickad till ${result.attester.name} för attest`)
      onChanged()
    } catch (err) {
      if (err instanceof ApiError && err.body?.error === 'insufficient-balance') {
        toast('Saldot räcker inte för det uttaget')
      } else {
        toast('Något gick fel – försök igen')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .35s ease' }}
    >
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
        Ansök om ledighet
      </h1>
      {attester.delegated && attester.managerName && (
        <div
          style={{
            background: '#EFF3FE',
            border: '1px solid #C9D7F9',
            borderRadius: 14,
            padding: '13px 17px',
            fontSize: 13.5,
            color: '#2A4590',
            fontWeight: 600,
          }}
        >
          Just nu attesterar {attester.name} dina ansökningar. {attester.managerName} är tillbaka{' '}
          {attester.delegationUntil ? fmtDate(attester.delegationUntil) : ''}.
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 22,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#A18F9B',
                  marginBottom: 7,
                }}
              >
                Datum
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1.5px solid #EBDCE5',
                  borderRadius: 13,
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  fontWeight: 600,
                  background: '#ffffff',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#A18F9B',
                  marginBottom: 7,
                }}
              >
                Starttid
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1.5px solid #EBDCE5',
                  borderRadius: 13,
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  fontWeight: 600,
                  background: '#ffffff',
                }}
              />
            </div>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#A18F9B',
                marginBottom: 7,
              }}
            >
              Antal timmar
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setHours((h) => Math.max(0.25, h - 0.25))}
                className="hov-border-pink"
                style={{
                  border: '1.5px solid #EBDCE5',
                  cursor: 'pointer',
                  background: '#ffffff',
                  color: '#C4006C',
                  fontFamily: 'inherit',
                  fontWeight: 800,
                  fontSize: 20,
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  lineHeight: 1,
                }}
              >
                −
              </button>
              <div style={{ minWidth: 80, textAlign: 'center', fontSize: 22, fontWeight: 800 }}>
                {fmtHours(hours)}
              </div>
              <button
                onClick={() => setHours((h) => h + 0.25)}
                className="hov-border-pink"
                style={{
                  border: '1.5px solid #EBDCE5',
                  cursor: 'pointer',
                  background: '#ffffff',
                  color: '#C4006C',
                  fontFamily: 'inherit',
                  fontWeight: 800,
                  fontSize: 20,
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  lineHeight: 1,
                }}
              >
                +
              </button>
              <div style={{ fontSize: 12.5, color: '#9A8694', lineHeight: 1.35 }}>
                Minsta uttag är en kvart (0,25&nbsp;h)
              </div>
            </div>
          </div>
          <div
            style={{
              background: '#FDF7FA',
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#A18F9B',
                }}
              >
                Saldo idag
              </div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>
                {fmtMinutes(account.balanceMinutes)}
              </div>
            </div>
            <div style={{ color: '#C9B4C1', fontSize: 18, fontWeight: 700 }}>→</div>
            <div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#A18F9B',
                }}
              >
                Efter uttag
              </div>
              <div
                style={{ fontWeight: 800, fontSize: 17, color: after < 0 ? '#C22F45' : '#0B7B5D' }}
              >
                {(after < 0 ? '−' : '') + fmtMinutes(after)}
              </div>
            </div>
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="hov-primary"
            style={{
              border: 'none',
              cursor: 'pointer',
              background: '#E0007A',
              color: '#ffffff',
              fontFamily: 'inherit',
              fontWeight: 800,
              fontSize: 16,
              padding: '15px 20px',
              borderRadius: 15,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            Skicka ansökan
          </button>
          <div style={{ fontSize: 12.5, color: '#9A8694', textAlign: 'center' }}>
            Attesteras av <strong style={{ color: '#5C4B57' }}>{attesterName}</strong> innan tiden
            dras från ditt saldo.
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 22,
            padding: 24,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#A18F9B',
              marginBottom: 10,
            }}
          >
            Mina ansökningar
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {leaves.map((l) => {
              const chip = leaveStatusChip(l.status)
              const sub = l.comment ? `”${l.comment}” – ${l.attestedBy ?? ''}` : null
              return (
                <div key={l.id} style={{ padding: '12px 0', borderTop: '1px solid #F8EEF4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                        {fmtDate(l.date)} kl {l.startTime}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#9A8694' }}>
                        {fmtHours(l.hours)} · ansökt {fmtDate(l.appliedDate)}
                      </div>
                    </div>
                    <span style={chip.style}>{chip.label}</span>
                  </div>
                  {sub && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        color: '#7C6B77',
                        background: '#FDF7FA',
                        borderRadius: 10,
                        padding: '8px 11px',
                      }}
                    >
                      {sub}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
