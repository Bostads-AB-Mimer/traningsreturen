import { useState } from 'react'
import { api, ApiError } from '../../api/client'
import { ActivityType } from '../../api/types'
import { useToast } from '../../components/Toast'
import { activityColor, chipStyle, dotStyle } from '../../theme'

interface Props {
  activities: ActivityType[]
  onChanged: () => void
}

export function ActivitiesView({ activities, onChanged }: Props) {
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const add = async () => {
    const name = newName.trim()
    if (!name) {
      toast('Skriv ett namn på aktiviteten')
      return
    }
    try {
      await api.post('/api/admin/activity-types', { name })
      setNewName('')
      toast('Aktivitet tillagd')
      onChanged()
    } catch (err) {
      toast(
        err instanceof ApiError && err.body?.error === 'duplicate-name'
          ? 'Aktiviteten finns redan'
          : 'Något gick fel – försök igen',
      )
    }
  }

  const saveRename = async () => {
    const name = renameValue.trim()
    if (!name || !renameId) return
    try {
      await api.patch(`/api/admin/activity-types/${renameId}`, { name })
      setRenameId(null)
      toast('Aktiviteten döptes om')
      onChanged()
    } catch {
      toast('Något gick fel – försök igen')
    }
  }

  const toggle = async (activity: ActivityType) => {
    try {
      await api.patch(`/api/admin/activity-types/${activity.id}`, { active: !activity.active })
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
          Aktivitetstyper
        </h1>
        <div style={{ color: '#7C6B77', fontSize: 14 }}>
          Aktiviteterna som visas i rullistan när medarbetare registrerar träning.
        </div>
      </div>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #F2E3EC',
          borderRadius: 20,
          padding: 20,
          display: 'flex',
          gap: 10,
        }}
      >
        <input
          type="text"
          placeholder="Ny aktivitet, t.ex. Skidåkning"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{
            flex: 1,
            padding: '11px 14px',
            border: '1.5px solid #EBDCE5',
            borderRadius: 12,
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            background: '#ffffff',
          }}
        />
        <button
          onClick={add}
          className="hov-primary"
          style={{
            border: 'none',
            cursor: 'pointer',
            background: '#E0007A',
            color: '#ffffff',
            fontFamily: 'inherit',
            fontWeight: 800,
            fontSize: 14,
            padding: '11px 18px',
            borderRadius: 12,
            whiteSpace: 'nowrap',
          }}
        >
          Lägg till
        </button>
      </div>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #F2E3EC',
          borderRadius: 20,
          padding: '8px 20px',
        }}
      >
        {activities.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 0',
              borderTop: '1px solid #F8EEF4',
              flexWrap: 'wrap',
            }}
          >
            <div style={dotStyle(activityColor(a.name))} />
            {renameId !== a.id ? (
              <div style={{ flex: 1, minWidth: 120, fontWeight: 700, fontSize: 14.5 }}>
                {a.name}
              </div>
            ) : (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: '8px 12px',
                  border: '1.5px solid #EBDCE5',
                  borderRadius: 10,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  background: '#ffffff',
                }}
              />
            )}
            <span
              style={a.active ? chipStyle('#E0F5EC', '#0B7B5D') : chipStyle('#F1EBEF', '#8A7484')}
            >
              {a.active ? 'Aktiv' : 'Inaktiv'}
            </span>
            {renameId !== a.id ? (
              <button
                onClick={() => {
                  setRenameId(a.id)
                  setRenameValue(a.name)
                }}
                className="hov-pink-soft"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                  color: '#C4006C',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12.5,
                  padding: '6px 8px',
                  borderRadius: 8,
                }}
              >
                Byt namn
              </button>
            ) : (
              <button
                onClick={saveRename}
                className="hov-primary"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: '#E0007A',
                  color: '#ffffff',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 12.5,
                  padding: '7px 13px',
                  borderRadius: 9,
                }}
              >
                Spara
              </button>
            )}
            <button
              onClick={() => toggle(a)}
              className="hov-rose"
              style={{
                border: 'none',
                cursor: 'pointer',
                background: 'none',
                color: '#9A8694',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12.5,
                padding: '6px 8px',
                borderRadius: 8,
              }}
            >
              {a.active ? 'Inaktivera' : 'Aktivera'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
