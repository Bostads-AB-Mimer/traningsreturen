import { LedgerEntry } from '../api/types'
import { fmtDate, fmtMinutes, fmtSignedMinutes } from '../format'
import { ledgerTypeChip } from '../theme'
import { ledgerAmountStyle, ledgerLabel, ledgerSub } from './ledger'

const GRID = '104px minmax(250px,1fr) 104px 128px 96px'

interface Props {
  entries: LedgerEntry[]
  expiryEnabled: boolean
  /** Shows the KONCEPT chip next to the expiry column (employee view only). */
  showConceptBadge: boolean
}

/** The statement table: every row shows how the balance was affected. */
export function LedgerTable({ entries, expiryEnabled, showConceptBadge }: Props) {
  const newestFirst = [...entries].reverse()
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #F2E3EC',
        borderRadius: 20,
        padding: '6px 18px',
        overflowX: 'auto',
      }}
    >
      <div style={{ minWidth: 760 }}>
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
          <div>Datum</div>
          <div>Händelse</div>
          <div style={{ textAlign: 'right' }}>Tid</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Förfaller
            {showConceptBadge && expiryEnabled && (
              <span
                style={{
                  display: 'inline-flex',
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: '#FFE4C2',
                  color: '#8F5300',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                }}
              >
                KONCEPT
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>Saldo</div>
        </div>
        {newestFirst.map((entry, i) => {
          const chip = ledgerTypeChip(entry.type)
          const sub = ledgerSub(entry)
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                gap: 12,
                alignItems: 'center',
                padding: '11px 4px',
                borderTop: '1px solid #F8EEF4',
              }}
            >
              <div style={{ fontSize: 13, color: '#7C6B77', fontWeight: 600 }}>
                {fmtDate(entry.date)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <span style={chip.style}>{chip.label}</span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: '#3A2D36',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ledgerLabel(entry)}
                  </div>
                  {sub && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#A18F9B',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sub}
                    </div>
                  )}
                </div>
              </div>
              <div style={ledgerAmountStyle(entry)}>{fmtSignedMinutes(entry.minutes)}</div>
              <div style={{ fontSize: 12.5, color: '#A18F9B', fontWeight: 600 }}>
                {entry.expiresAt && expiryEnabled ? fmtDate(entry.expiresAt) : '–'}
              </div>
              <div
                style={{ fontSize: 13.5, fontWeight: 800, textAlign: 'right', color: '#3A2D36' }}
              >
                {fmtMinutes(entry.balance)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
