import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../../api/client'
import {
  ActivityType,
  AppConfig,
  BatchPreview,
  RegisterResult,
  WorkoutDraft,
} from '../../api/types'
import { useToast } from '../../components/Toast'
import {
  addDaysIso,
  fmtDateShort,
  fmtMinutes,
  mondayOfIso,
  MONTHS_SHORT,
  parseIsoDate,
  todayIso,
} from '../../format'
import { calendarCellStyle, pickChipStyle } from '../../theme'

const FUTURE_DATE_MESSAGE = 'Det går inte att registrera pass med framtida datum.'
const TOO_OLD_MESSAGE =
  'Pass kan registreras högst 60 dagar bakåt i tiden – äldre pass kan tyvärr inte rapporteras.'

interface RegisterRow {
  key: number
  activityTypeId: string
  minutes: string
  dates: string[]
  moreOpen: boolean
  calOpen: boolean
}

interface Props {
  config: AppConfig
  activities: ActivityType[]
  topActivities: { id: string; name: string }[]
  onRegistered: () => void
}

let rowKeySeq = 0

export function RegisterView({ config, activities, topActivities, onRegistered }: Props) {
  const toast = useToast()
  const activeActivities = activities.filter((a) => a.active)
  const defaultActivityId = topActivities[0]?.id ?? activeActivities[0]?.id ?? ''

  const blankRow = (): RegisterRow => ({
    key: ++rowKeySeq,
    activityTypeId: defaultActivityId,
    minutes: '',
    dates: [],
    moreOpen: false,
    calOpen: false,
  })

  const [rows, setRows] = useState<RegisterRow[]>(() => [blankRow()])
  const [preview, setPreview] = useState<BatchPreview | null>(null)
  const [saving, setSaving] = useState(false)

  const today = todayIso()
  const minDate = addDaysIso(today, -config.rules.maxBackdateDays)
  const yesterday = addDaysIso(today, -1)

  const updateRow = (key: number, patch: Partial<RegisterRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const toggleRowDate = (key: number, date: string) => {
    setRows((rs) =>
      rs.map((r) =>
        r.key === key
          ? {
              ...r,
              dates: r.dates.includes(date)
                ? r.dates.filter((d) => d !== date)
                : [...r.dates, date].sort(),
            }
          : r,
      ),
    )
  }

  const batch = useMemo<WorkoutDraft[]>(() => {
    const drafts: WorkoutDraft[] = []
    for (const row of rows) {
      const minutes = parseInt(row.minutes, 10)
      if (!(minutes > 0)) continue
      for (const date of row.dates) {
        if (date < minDate || date > today) continue
        drafts.push({ date, activityTypeId: row.activityTypeId, minutes })
      }
    }
    return drafts
  }, [rows, minDate, today])

  // Live summary of the batch before saving — computed by the rules engine
  // in the backend so week caps already used are accounted for.
  const previewSeq = useRef(0)
  useEffect(() => {
    if (!batch.length) {
      setPreview(null)
      return
    }
    const seq = ++previewSeq.current
    const timer = setTimeout(() => {
      api
        .post<BatchPreview>('/api/me/workouts/preview', { workouts: batch })
        .then((result) => {
          if (seq === previewSeq.current) setPreview(result)
        })
        .catch(() => {
          if (seq === previewSeq.current) setPreview(null)
        })
    }, 250)
    return () => clearTimeout(timer)
  }, [batch])

  const save = async () => {
    const filled = rows.filter((r) => r.minutes.trim() !== '')
    if (!filled.length) {
      toast('Fyll i minst ett pass')
      return
    }
    for (const row of filled) {
      const minutes = parseInt(row.minutes, 10)
      if (!(minutes > 0)) {
        toast('Ange antal minuter för alla pass')
        return
      }
      if (!row.dates.length) {
        toast('Välj minst en dag för varje pass')
        return
      }
      for (const date of row.dates) {
        if (date > today) {
          toast(FUTURE_DATE_MESSAGE)
          return
        }
        if (date < minDate) {
          toast(TOO_OLD_MESSAGE)
          return
        }
      }
    }
    setSaving(true)
    try {
      const result = await api.post<RegisterResult>('/api/me/workouts', { workouts: batch })
      setRows([blankRow()])
      setPreview(null)
      const lead =
        result.created === 1 ? 'Passet registrerat! ' : `${result.created} pass registrerade! `
      toast(
        lead +
          (result.creditedMinutes > 0
            ? `+${result.creditedMinutes} min till ditt saldo`
            : 'Veckotaket var fullt – passen loggas utan ny ledighet'),
      )
      onRegistered()
    } catch (err) {
      if (err instanceof ApiError && err.body?.error === 'invalid-date') {
        toast(err.body.code === 'future' ? FUTURE_DATE_MESSAGE : TOO_OLD_MESSAGE)
      } else {
        toast('Något gick fel – försök igen')
      }
    } finally {
      setSaving(false)
    }
  }

  const calendarWeeks = useMemo(() => {
    const weeks: { label: string; days: string[] }[] = []
    let weekStart = mondayOfIso(minDate)
    let prevMonth = -1
    while (weekStart <= today) {
      const month = parseIsoDate(weekStart).getMonth()
      weeks.push({
        label: month !== prevMonth ? (MONTHS_SHORT[month] as string) : '',
        days: Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
      })
      prevMonth = month
      weekStart = addDaysIso(weekStart, 7)
    }
    return weeks
  }, [minDate, today])

  const activityNameById = new Map(activeActivities.map((a) => [a.id, a.name]))

  return (
    <div
      style={{
        maxWidth: 640,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        animation: 'fadeUp .35s ease',
      }}
    >
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Registrera träning
        </h1>
        <div style={{ color: '#7C6B77', fontSize: 14, lineHeight: 1.45 }}>
          Endast pulshöjande aktivitet räknas – du får tillbaka 20&nbsp;% av tiden som ledighet.
          Snabbvalen visar dina fem vanligaste aktiviteter och uppdateras automatiskt. Varje pass
          kan gälla flera dagar – t.ex. tre joggingpass samma vecka.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, index) => {
          const inTop = topActivities.some((t) => t.id === row.activityTypeId)
          return (
            <div
              key={row.key}
              style={{
                background: '#ffffff',
                border: '1px solid #F2E3EC',
                borderRadius: 18,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#A18F9B',
                  }}
                >
                  Pass {index + 1}
                </div>
                {rows.length > 1 && (
                  <button
                    onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                    className="hov-rose-danger"
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
                    Ta bort
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {topActivities.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => updateRow(row.key, { activityTypeId: t.id, moreOpen: false })}
                    style={pickChipStyle(row.activityTypeId === t.id)}
                  >
                    {t.name}
                  </button>
                ))}
                <button
                  onClick={() => updateRow(row.key, { moreOpen: !row.moreOpen })}
                  style={pickChipStyle(!inTop)}
                >
                  {inTop
                    ? 'Fler aktiviteter…'
                    : (activityNameById.get(row.activityTypeId) ?? 'Fler aktiviteter…')}
                </button>
              </div>

              {row.moreOpen && (
                <select
                  value={row.activityTypeId}
                  onChange={(e) => updateRow(row.key, { activityTypeId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    border: '1.5px solid #EBDCE5',
                    borderRadius: 12,
                    fontFamily: 'inherit',
                    fontSize: 14.5,
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
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {[30, 45, 60, 90].map((v) => (
                  <button
                    key={v}
                    onClick={() => updateRow(row.key, { minutes: String(v) })}
                    style={pickChipStyle(row.minutes === String(v))}
                  >
                    {v} min
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  placeholder="min"
                  value={row.minutes}
                  onChange={(e) => updateRow(row.key, { minutes: e.target.value })}
                  style={{
                    width: 92,
                    padding: '9px 12px',
                    border: '1.5px solid #EBDCE5',
                    borderRadius: 11,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#A18F9B',
                    marginBottom: 7,
                  }}
                >
                  Välj dag/dagar
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    [today, 'Idag'],
                    [yesterday, 'Igår'],
                  ].map(([date, label]) => (
                    <button
                      key={date}
                      onClick={() => toggleRowDate(row.key, date as string)}
                      style={pickChipStyle(row.dates.includes(date as string))}
                    >
                      {label}
                    </button>
                  ))}
                  {row.dates
                    .filter((d) => d !== today && d !== yesterday)
                    .map((date) => (
                      <span
                        key={date}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          background: '#FBDFEE',
                          color: '#B4005F',
                          borderRadius: 999,
                          padding: '7px 13px',
                          fontSize: 13,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtDateShort(date)}
                        <button
                          onClick={() => toggleRowDate(row.key, date)}
                          style={{
                            border: 'none',
                            cursor: 'pointer',
                            background: 'none',
                            color: '#B4005F',
                            fontFamily: 'inherit',
                            fontWeight: 800,
                            fontSize: 14,
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  <button
                    onClick={() => updateRow(row.key, { calOpen: !row.calOpen })}
                    className="hov-pink-soft"
                    style={{
                      border: '1.5px dashed #E3B9D2',
                      cursor: 'pointer',
                      background: 'none',
                      color: '#C4006C',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: 13,
                      padding: '7px 13px',
                      borderRadius: 999,
                    }}
                  >
                    {row.calOpen ? 'Stäng kalendern' : 'Fler dagar…'}
                  </button>
                </div>
                <div style={{ marginTop: 7, fontSize: 12.5, color: '#A18F9B' }}>
                  * Har du kört samma träning flera dagar? Välj flera datum, så registreras ett pass
                  per dag.
                </div>
                {row.calOpen && (
                  <div
                    style={{
                      marginTop: 10,
                      border: '1px solid #F2E3EC',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <div style={{ width: 30, flexShrink: 0 }} />
                      {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((d, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: '#A18F9B',
                          }}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {calendarWeeks.map((week, wi) => (
                        <div key={wi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div
                            style={{
                              width: 30,
                              flexShrink: 0,
                              fontSize: 10.5,
                              color: '#A18F9B',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                            }}
                          >
                            {week.label}
                          </div>
                          {week.days.map((date) => {
                            const disabled = date < minDate || date > today
                            const selected = row.dates.includes(date)
                            return (
                              <button
                                key={date}
                                onClick={() =>
                                  disabled
                                    ? toast(date > today ? FUTURE_DATE_MESSAGE : TOO_OLD_MESSAGE)
                                    : toggleRowDate(row.key, date)
                                }
                                style={calendarCellStyle(selected, disabled, date === today)}
                              >
                                {parseIsoDate(date).getDate()}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12.5, color: '#A18F9B' }}>
                      Klicka för att välja eller ta bort dagar. Upp till 60 dagar bakåt – inga
                      framtida datum.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => setRows((rs) => [...rs, blankRow()])}
        className="hov-pink-soft"
        style={{
          border: '1.5px dashed #E3B9D2',
          cursor: 'pointer',
          background: 'none',
          color: '#C4006C',
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: 14,
          padding: 13,
          borderRadius: 15,
        }}
      >
        + Lägg till pass
      </button>

      {preview && preview.workoutCount > 0 && (
        <div
          style={{
            background: '#F4FBF8',
            border: '1px solid #CBEBDD',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#6E9384',
                }}
              >
                Pass
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#0B5C46' }}>
                {preview.workoutCount} pass
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#6E9384',
                }}
              >
                Träningstid
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#0B5C46' }}>
                {fmtMinutes(preview.totalMinutes)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#6E9384',
                }}
              >
                Ledighet
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#0B7B5D' }}>
                +{preview.earnedMinutes} min
              </div>
            </div>
          </div>
          {preview.cappedLostMinutes > 0 && (
            <div
              style={{
                background: '#FFEBD6',
                color: '#A05A00',
                borderRadius: 11,
                padding: '10px 13px',
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {preview.cappedLostMinutes} min ger ingen intjäning – veckotaket på{' '}
              {config.rules.weeklyCapMinutes} min är redan fullt för berörd vecka. Passen loggas
              ändå.
            </div>
          )}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
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
          letterSpacing: '0.01em',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {batch.length > 1 ? `Spara ${batch.length} pass` : 'Spara pass'}
      </button>
      <div style={{ textAlign: 'center', color: '#A18F9B', fontSize: 13 }}>
        Pass kan registreras upp till 60 dagar bakåt i tiden – inte framåt.
      </div>
    </div>
  )
}
