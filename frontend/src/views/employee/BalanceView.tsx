import { Account, AppConfig } from '../../api/types'
import { LedgerTable } from '../../components/LedgerTable'
import { fmtMinutes } from '../../format'

interface Props {
  config: AppConfig
  account: Account
}

export function BalanceView({ config, account }: Props) {
  const currentYear = String(new Date().getFullYear())
  let earnedYear = 0
  let usedYear = 0
  for (const entry of account.entries) {
    if (entry.date.startsWith(currentYear)) {
      if (entry.minutes > 0) earnedYear += entry.minutes
      if (entry.type === 'withdrawal') usedYear += -entry.minutes
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .35s ease' }}
    >
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Mitt saldo – historik
        </h1>
        <div style={{ color: '#7C6B77', fontSize: 14, maxWidth: 640, lineHeight: 1.45 }}>
          Varje rad visar hur ditt saldo har påverkats – som ett kontoutdrag.
          {config.features.expiryEnabled &&
            ' Intjänad tid gäller i 12 månader och äldst tid används först.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 14,
            padding: '10px 16px',
          }}
        >
          <span style={{ fontSize: 12, color: '#A18F9B', fontWeight: 700 }}>SALDO&nbsp;&nbsp;</span>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#C4006C' }}>
            {fmtMinutes(account.balanceMinutes)}
          </span>
        </div>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 14,
            padding: '10px 16px',
          }}
        >
          <span style={{ fontSize: 12, color: '#A18F9B', fontWeight: 700 }}>
            INTJÄNAT I ÅR&nbsp;&nbsp;
          </span>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#0B7B5D' }}>
            +{fmtMinutes(earnedYear)}
          </span>
        </div>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #F2E3EC',
            borderRadius: 14,
            padding: '10px 16px',
          }}
        >
          <span style={{ fontSize: 12, color: '#A18F9B', fontWeight: 700 }}>
            UTTAGET I ÅR&nbsp;&nbsp;
          </span>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#B4005F' }}>
            −{fmtMinutes(usedYear)}
          </span>
        </div>
      </div>
      <LedgerTable
        entries={account.entries}
        expiryEnabled={config.features.expiryEnabled}
        showConceptBadge
      />
    </div>
  )
}
