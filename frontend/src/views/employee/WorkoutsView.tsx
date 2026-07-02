import { useState } from 'react'
import { api } from '../../api/client'
import { Account, ActivityType } from '../../api/types'
import { useToast } from '../../components/Toast'
import { fmtDate, fmtMinutes } from '../../format'
import { activityColor, dotStyle } from '../../theme'

interface Props {
  account: Account
  activities: ActivityType[]
  onChanged: () => void
}

export function WorkoutsView({ account, activities, onChanged }: Props) {
  const toast = useToast()
  const [editId, setEditId] = useState<string | null>(null)
  const [editMinutes, setEditMinutes] = useState('')
  const [editActivityId, setEditActivityId] = useState('')

  const activeActivities = activities.filter((a) => a.active)
  const activityIdByName = new Map(activities.map((a) => [a.name, a.id]))
  const newestFirst = [...account.workouts].reverse()
  const shown = newestFirst.slice(0, 30)

  const startEdit = (id: string, minutes: number, activity: string) => {
    setEditId(id)
    setEditMinutes(String(minutes))
    setEditActivityId(activityIdByName.get(activity) ?? activeActivities[0]?.id ?? '')
  }

  const saveEdit = async () => {
    const minutes = parseInt(editMinutes, 10)
    if (!(minutes > 0)) {
      toast('Ange antal minuter')
      return
    }
    try {
      await api.patch(`/api/me/workouts/${editId}`, {
        activityTypeId: editActivityId,
        minutes,
      })
      setEditId(null)
      toast('Passet uppdaterat')
      onChanged()
    } catch {
      toast('Något gick fel – försök igen')
    }
  }

  const deleteWorkout = async (id: string) => {
    try {
      await api.delete(`/api/me/workouts/${id}`)
      toast('Passet togs bort')
      onChanged()
    } catch {
      toast('Något gick fel – försök igen')
    }
  }

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        animation: 'fadeUp .35s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Mina träningstillfällen
        </h1>
        <div style={{ color: '#9A8694', fontSize: 14, fontWeight: 600 }}>
          {account.workouts.length} pass · {fmtMinutes(account.totalWorkoutMinutes)} totalt
        </div>
      </div>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #F2E3EC',
          borderRadius: 20,
          padding: '8px 22px',
        }}
      >
        {shown.map((w) => (
          <div key={w.id} style={{ borderTop: '1px solid #F8EEF4' }}>
            {editId !== w.id ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '12px 0',
                  flexWrap: 'wrap',
                }}
              >
                <div style={dotStyle(activityColor(w.activity))} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{w.activity}</div>
                  <div style={{ fontSize: 12.5, color: '#9A8694' }}>{fmtDate(w.date)}</div>
                </div>
                {w.capped && (
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: '#FFEBD6',
                      color: '#A05A00',
                      fontSize: 11.5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Veckotak nått
                  </span>
                )}
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: '#5C4B57',
                    width: 60,
                    textAlign: 'right',
                  }}
                >
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
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    onClick={() => startEdit(w.id, w.minutes, w.activity)}
                    className="hov-pink-soft"
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      background: 'none',
                      color: '#C4006C',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: 12.5,
                      padding: '5px 7px',
                      borderRadius: 8,
                    }}
                  >
                    Redigera
                  </button>
                  <button
                    onClick={() => deleteWorkout(w.id)}
                    className="hov-rose-danger"
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      background: 'none',
                      color: '#9A8694',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: 12.5,
                      padding: '5px 7px',
                      borderRadius: 8,
                    }}
                  >
                    Ta bort
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '12px 10px',
                  flexWrap: 'wrap',
                  background: '#FDF7FA',
                  margin: '0 -10px',
                  borderRadius: 12,
                }}
              >
                <select
                  value={editActivityId}
                  onChange={(e) => setEditActivityId(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    border: '1.5px solid #EBDCE5',
                    borderRadius: 11,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    background: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  {activeActivities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  style={{
                    width: 90,
                    padding: '9px 12px',
                    border: '1.5px solid #EBDCE5',
                    borderRadius: 11,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    background: '#ffffff',
                  }}
                />
                <span style={{ fontSize: 13, color: '#9A8694' }}>min · {fmtDate(w.date)}</span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={saveEdit}
                  className="hov-primary"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: '#E0007A',
                    color: '#ffffff',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '8px 15px',
                    borderRadius: 10,
                  }}
                >
                  Spara
                </button>
                <button
                  onClick={() => setEditId(null)}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: 'none',
                    color: '#7C6B77',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '8px 10px',
                  }}
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', color: '#A18F9B', fontSize: 13 }}>
        {newestFirst.length > 30 ? 'Visar de 30 senaste passen' : ''}
      </div>
    </div>
  )
}
