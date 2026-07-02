import { CSSProperties } from 'react'

/** Activity colours from the prototype; unknown activities fall back to grey. */
export const ACTIVITY_COLORS: Record<string, string> = {
  Gym: '#E0007A',
  Jogging: '#2D5FE0',
  'Power walk': '#00A5A0',
  Cykling: '#7A2E9D',
  Simning: '#0E86C7',
  Padel: '#E07C00',
  Gruppträning: '#C13FA8',
  Skidåkning: '#5E6AD2',
}

export function activityColor(name: string): string {
  return ACTIVITY_COLORS[name] ?? '#9A8694'
}

/** Role switcher segment button. */
export function segmentStyle(on: boolean): CSSProperties {
  return {
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '8px 15px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    background: on ? '#ffffff' : 'transparent',
    color: on ? '#C4006C' : '#8A7484',
    boxShadow: on ? '0 1px 5px rgba(42,30,40,0.14)' : 'none',
    transition: 'all .15s',
  }
}

/** Main navigation tab. */
export function tabStyle(on: boolean): CSSProperties {
  return {
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '9px 15px',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 13.5,
    background: on ? '#FBDFEE' : 'transparent',
    color: on ? '#B4005F' : '#7C6B77',
    transition: 'all .15s',
  }
}

export function chipStyle(bg: string, color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 700,
    background: bg,
    color,
    whiteSpace: 'nowrap',
  }
}

export function dotStyle(color: string): CSSProperties {
  return { width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }
}

/** Selectable pill chip (activities, minutes, quick dates). */
export function pickChipStyle(on: boolean): CSSProperties {
  return {
    border: on ? '1.5px solid #E0007A' : '1.5px solid #EBDCE5',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '8px 14px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13.5,
    background: on ? '#FBDFEE' : '#ffffff',
    color: on ? '#B4005F' : '#5C4B57',
  }
}

export type LeaveStatus = 'pending' | 'approved' | 'denied'

export function leaveStatusChip(status: LeaveStatus): { label: string; style: CSSProperties } {
  const map: Record<LeaveStatus, [string, string, string]> = {
    pending: ['Väntar på attest', '#FFF3DC', '#96690A'],
    approved: ['Godkänd', '#E0F5EC', '#0B7B5D'],
    denied: ['Avslagen', '#FCE5E8', '#C22F45'],
  }
  const [label, bg, color] = map[status]
  return { label, style: chipStyle(bg, color) }
}

export type LedgerType = 'earned' | 'withdrawal' | 'correction' | 'expiry'

export function ledgerTypeChip(type: LedgerType): { label: string; style: CSSProperties } {
  const map: Record<LedgerType, [string, string, string]> = {
    earned: ['Intjänad', '#E0F5EC', '#0B7B5D'],
    withdrawal: ['Uttag', '#FBDFEE', '#B4005F'],
    correction: ['Korrigering', '#F0E6FA', '#7A2E9D'],
    expiry: ['Förfall', '#FFEBD6', '#A05A00'],
  }
  const [label, bg, color] = map[type]
  return { label, style: chipStyle(bg, color) }
}

/** Calendar day cell in the multi-date picker. */
export function calendarCellStyle(
  selected: boolean,
  disabled: boolean,
  isToday: boolean,
): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    height: 34,
    borderRadius: 9,
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 12.5,
    padding: 0,
    cursor: disabled ? 'default' : 'pointer',
    border:
      isToday && !selected
        ? '1.5px solid #E0007A'
        : '1px solid ' + (disabled ? 'transparent' : '#F2E3EC'),
    background: selected ? '#E0007A' : disabled ? 'transparent' : '#ffffff',
    color: selected ? '#ffffff' : disabled ? '#DACBD4' : '#3A2D36',
  }
}

/** Section label in cards (small uppercase heading). */
export const cardLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#A18F9B',
}

export const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #F2E3EC',
  borderRadius: 20,
  padding: 22,
}
