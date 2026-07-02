import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { DelegationState } from '../../api/types'
import { useToast } from '../../components/Toast'
import { addDaysIso, fmtDate, todayIso } from '../../format'

interface Props {
  delegation: DelegationState
  onChanged: () => void
}

export function DelegateView({ delegation, onChanged }: Props) {
  const toast = useToast()
  const active = delegation.delegation !== null
  const [delegateId, setDelegateId] = useState('')
  const [untilDate, setUntilDate] = useState('')

  useEffect(() => {
    setDelegateId(delegation.delegation?.delegate.id ?? delegation.options[0]?.id ?? '')
    setUntilDate(delegation.delegation?.untilDate ?? addDaysIso(todayIso(), 21))
  }, [delegation])

  const toggle = async () => {
    const selected = delegation.options.find((o) => o.id === delegateId)
    try {
      if (active) {
        await api.put('/api/delegation', { active: false })
        toast('Delegeringen avslutad – du attesterar själv igen')
      } else {
        if (!selected || !untilDate) {
          toast('Välj delegat och slutdatum')
          return
        }
        await api.put('/api/delegation', {
          active: true,
          delegateUserId: delegateId,
          untilDate,
        })
        toast(`Attest delegerad till ${selected.name}`)
      }
      onChanged()
    } catch {
      toast('Något gick fel – försök igen')
    }
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        animation: 'fadeUp .35s ease',
      }}
    >
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Delegera attest
        </h1>
        <div style={{ color: '#7C6B77', fontSize: 14, lineHeight: 1.45 }}>
          Vid semester eller sjukdom kan du låta en annan chef attestera ditt teams ansökningar.
          Medarbetarna ser tydligt vem som attesterar just nu.
        </div>
      </div>
      {active && delegation.delegation && (
        <div
          style={{
            background: '#EFF3FE',
            border: '1px solid #C9D7F9',
            borderRadius: 16,
            padding: '16px 18px',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14.5, color: '#2A4590' }}>Delegering aktiv</div>
          <div style={{ fontSize: 13.5, color: '#41599E', marginTop: 3, lineHeight: 1.45 }}>
            {delegation.delegation.delegate.name} attesterar ditt teams ansökningar t.o.m.{' '}
            {fmtDate(delegation.delegation.untilDate)}. Medarbetarna ser detta när de ansöker.
          </div>
        </div>
      )}
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
            Delegera till
          </label>
          <select
            value={delegateId}
            onChange={(e) => setDelegateId(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1.5px solid #EBDCE5',
              borderRadius: 13,
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 600,
              background: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {delegation.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} – {o.title}
              </option>
            ))}
          </select>
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
            Till och med
          </label>
          <input
            type="date"
            value={untilDate}
            onChange={(e) => setUntilDate(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1.5px solid #EBDCE5',
              borderRadius: 13,
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 600,
              background: '#ffffff',
            }}
          />
        </div>
        <button
          onClick={toggle}
          style={{
            border: 'none',
            cursor: 'pointer',
            background: active ? '#F1EBEF' : '#E0007A',
            color: active ? '#5C4B57' : '#ffffff',
            fontFamily: 'inherit',
            fontWeight: 800,
            fontSize: 15,
            padding: '14px 20px',
            borderRadius: 14,
          }}
        >
          {active ? 'Avsluta delegering' : 'Aktivera delegering'}
        </button>
      </div>
    </div>
  )
}
