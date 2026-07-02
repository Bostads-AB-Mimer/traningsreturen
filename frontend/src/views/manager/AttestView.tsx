import { useState } from 'react'
import { api, ApiError } from '../../api/client'
import { DelegationState, HandledLeave, PendingLeave } from '../../api/types'
import { useToast } from '../../components/Toast'
import { fmtDate, fmtHours, fmtMinutes, initials } from '../../format'
import { leaveStatusChip } from '../../theme'

interface Props {
  pending: PendingLeave[]
  handled: HandledLeave[]
  delegation: DelegationState | null
  onChanged: () => void
}

export function AttestView({ pending, handled, delegation, onChanged }: Props) {
  const toast = useToast()
  const [comments, setComments] = useState<Record<string, string>>({})

  const attest = async (id: string, approve: boolean) => {
    try {
      await api.post(`/api/attest/${id}`, { approve, comment: comments[id] || undefined })
      toast(approve ? 'Ansökan godkänd – tiden dras från saldot' : 'Ansökan avslagen')
      onChanged()
    } catch (err) {
      if (err instanceof ApiError && err.body?.error === 'insufficient-balance') {
        toast('Saldot räcker inte för det uttaget')
      } else {
        toast('Något gick fel – försök igen')
      }
    }
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        animation: 'fadeUp .35s ease',
      }}
    >
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Attestera ledighet
        </h1>
        <div style={{ color: '#7C6B77', fontSize: 14 }}>
          {pending.length ? `${pending.length} ansökningar väntar på attest` : 'Allt är attesterat'}
        </div>
      </div>
      {delegation?.delegation && (
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
          {delegation.delegation.delegate.name} attesterar ditt teams ansökningar t.o.m.{' '}
          {fmtDate(delegation.delegation.untilDate)}. Medarbetarna ser detta när de ansöker.
        </div>
      )}
      {pending.length === 0 && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 20,
            padding: 36,
            textAlign: 'center',
            color: '#9A8694',
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          Inga väntande ansökningar just nu. Bra jobbat!
        </div>
      )}
      {pending.map((p) => (
        <div
          key={p.id}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#F0E6FA',
                color: '#7A2E9D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {initials(p.user.name)}
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontWeight: 800, fontSize: 15.5 }}>{p.user.name}</div>
              <div style={{ fontSize: 12.5, color: '#9A8694' }}>
                {p.user.title} · ansökte {fmtDate(p.appliedDate)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#C4006C' }}>
                {fmtHours(p.hours)}
              </div>
              <div style={{ fontSize: 12.5, color: '#7C6B77' }}>
                {fmtDate(p.date)} kl {p.startTime}
              </div>
            </div>
          </div>
          <div
            style={{
              background: '#FDF7FA',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 13,
              color: '#5C4B57',
              fontWeight: 600,
            }}
          >
            Saldo: {fmtMinutes(p.balanceMinutes)}
            {'  →  '}
            {fmtMinutes(p.balanceAfterMinutes)} efter uttag
          </div>
          <input
            type="text"
            placeholder="Kommentar (valfritt)"
            value={comments[p.id] ?? ''}
            onChange={(e) => setComments((c) => ({ ...c, [p.id]: e.target.value }))}
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
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button
              onClick={() => attest(p.id, true)}
              className="hov-green"
              style={{
                flex: 1,
                minWidth: 130,
                border: 'none',
                cursor: 'pointer',
                background: '#0B9E76',
                color: '#ffffff',
                fontFamily: 'inherit',
                fontWeight: 800,
                fontSize: 14.5,
                padding: '12px 18px',
                borderRadius: 13,
              }}
            >
              Godkänn
            </button>
            <button
              onClick={() => attest(p.id, false)}
              className="hov-red-soft"
              style={{
                flex: 1,
                minWidth: 130,
                border: '1.5px solid #F3C1C8',
                cursor: 'pointer',
                background: '#ffffff',
                color: '#C22F45',
                fontFamily: 'inherit',
                fontWeight: 800,
                fontSize: 14.5,
                padding: '12px 18px',
                borderRadius: 13,
              }}
            >
              Avslå
            </button>
          </div>
        </div>
      ))}
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
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#A18F9B',
            marginBottom: 8,
          }}
        >
          Hanterade nyligen
        </div>
        {handled.map((h) => {
          const chip = leaveStatusChip(h.status)
          return (
            <div
              key={h.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderTop: '1px solid #F8EEF4',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{h.user.name}</div>
                <div style={{ fontSize: 12.5, color: '#9A8694' }}>
                  {fmtDate(h.date)} · {fmtHours(h.hours)}
                </div>
              </div>
              <span style={chip.style}>{chip.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
