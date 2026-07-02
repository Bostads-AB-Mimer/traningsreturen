/**
 * Swedish demo data mirroring the design prototype exactly, including its
 * seeded RNG so the generated workout history matches the prototype's.
 */

import { addDays, IsoDate, mondayOf, parseIsoDate, toIsoDate } from '../../rules/dates'

export interface DemoUser {
  id: string
  keycloakUsername: string | null
  name: string
  department: string
  title: string
  managerId: string | null
  active: boolean
  isManager?: boolean
  /** RNG seed from the prototype's workout generator (null = no generated workouts). */
  seed: number | null
}

export const DEMO_USERS: DemoUser[] = [
  // Managers and admin (the three login personas + delegation options)
  {
    id: 'u_anna',
    keycloakUsername: 'anna.berg',
    name: 'Anna Berg',
    department: 'Fastighetsservice',
    title: 'Chef Fastighetsservice',
    managerId: null,
    active: true,
    isManager: true,
    seed: null,
  },
  {
    id: 'u_maria',
    keycloakUsername: 'maria.holm',
    name: 'Maria Holm',
    department: 'Kundcenter',
    title: 'Chef Kundcenter',
    managerId: null,
    active: true,
    isManager: true,
    seed: null,
  },
  {
    id: 'u_daniel',
    keycloakUsername: 'daniel.strom',
    name: 'Daniel Ström',
    department: 'Förvaltning',
    title: 'Chef Förvaltning',
    managerId: null,
    active: true,
    isManager: true,
    seed: null,
  },
  {
    id: 'u_peter',
    keycloakUsername: 'peter.ekstrom',
    name: 'Peter Ekström',
    department: 'HR',
    title: 'HR-administratör',
    managerId: null,
    active: true,
    seed: null,
  },
  // Employees (Anna Berg's team is u1–u5, same as the prototype)
  {
    id: 'u1',
    keycloakUsername: 'sara.lindqvist',
    name: 'Sara Lindqvist',
    department: 'Fastighetsservice',
    title: 'Fastighetsskötare',
    managerId: 'u_anna',
    active: true,
    seed: 11,
  },
  {
    id: 'u2',
    keycloakUsername: null,
    name: 'Johan Pettersson',
    department: 'Fastighetsservice',
    title: 'Drifttekniker',
    managerId: 'u_anna',
    active: true,
    seed: 22,
  },
  {
    id: 'u3',
    keycloakUsername: null,
    name: 'Ali Hassan',
    department: 'Fastighetsservice',
    title: 'Fastighetsskötare',
    managerId: 'u_anna',
    active: true,
    seed: 33,
  },
  {
    id: 'u4',
    keycloakUsername: null,
    name: 'Karin Öberg',
    department: 'Kundcenter',
    title: 'Kundvärd',
    managerId: 'u_anna',
    active: true,
    seed: 44,
  },
  {
    id: 'u5',
    keycloakUsername: null,
    name: 'Erik Sandström',
    department: 'Fastighetsservice',
    title: 'Snickare',
    managerId: 'u_anna',
    active: true,
    seed: 55,
  },
  // Possible duplicate of u5 — used to demo the merge feature.
  {
    id: 'u6',
    keycloakUsername: null,
    name: 'Erik Sandstrom',
    department: 'Fastighetsservice',
    title: 'Snickare',
    managerId: null,
    active: true,
    seed: 56,
  },
  {
    id: 'u7',
    keycloakUsername: null,
    name: 'Lena Ahmadi',
    department: 'Ekonomi',
    title: 'Redovisningsekonom',
    managerId: 'u_daniel',
    active: true,
    seed: 77,
  },
  {
    id: 'u8',
    keycloakUsername: null,
    name: 'Marcus Nyström',
    department: 'Projekt',
    title: 'Projektledare',
    managerId: 'u_daniel',
    active: false,
    seed: 88,
  },
]

export const DEMO_ACTIVITIES = [
  { id: 'a1', name: 'Gym', active: true },
  { id: 'a2', name: 'Power walk', active: true },
  { id: 'a3', name: 'Jogging', active: true },
  { id: 'a4', name: 'Simning', active: true },
  { id: 'a5', name: 'Cykling', active: true },
  { id: 'a6', name: 'Padel', active: true },
  { id: 'a7', name: 'Gruppträning', active: true },
  { id: 'a8', name: 'Skidåkning', active: false },
]

export interface DemoLeave {
  id: string
  userId: string
  date: IsoDate
  startTime: string
  hours: number
  status: 'pending' | 'approved' | 'denied'
  attestedByUserId: string | null
  attestedByName: string | null
  comment: string | null
  appliedDate: IsoDate
}

export const DEMO_LEAVES: DemoLeave[] = [
  {
    id: 'l1',
    userId: 'u1',
    date: '2025-10-03',
    startTime: '13:00',
    hours: 2,
    status: 'approved',
    attestedByUserId: 'u_anna',
    attestedByName: 'Anna Berg',
    comment: null,
    appliedDate: '2025-09-29',
  },
  {
    id: 'l2',
    userId: 'u1',
    date: '2026-02-13',
    startTime: '12:00',
    hours: 1.5,
    status: 'approved',
    attestedByUserId: 'u_anna',
    attestedByName: 'Anna Berg',
    comment: null,
    appliedDate: '2026-02-09',
  },
  {
    id: 'l3',
    userId: 'u1',
    date: '2026-03-06',
    startTime: '08:00',
    hours: 4,
    status: 'denied',
    attestedByUserId: 'u_anna',
    attestedByName: 'Anna Berg',
    comment: 'Krockar med OVK-besiktningen i Skallberget – kan du ta veckan efter?',
    appliedDate: '2026-03-02',
  },
  {
    id: 'l4',
    userId: 'u1',
    date: '2026-04-10',
    startTime: '14:00',
    hours: 2,
    status: 'approved',
    attestedByUserId: 'u_anna',
    attestedByName: 'Anna Berg',
    comment: null,
    appliedDate: '2026-04-07',
  },
  {
    id: 'l5',
    userId: 'u1',
    date: '2026-07-10',
    startTime: '13:00',
    hours: 2,
    status: 'pending',
    attestedByUserId: null,
    attestedByName: null,
    comment: null,
    appliedDate: '2026-06-30',
  },
  {
    id: 'l6',
    userId: 'u3',
    date: '2026-07-06',
    startTime: '15:00',
    hours: 1,
    status: 'pending',
    attestedByUserId: null,
    attestedByName: null,
    comment: null,
    appliedDate: '2026-07-01',
  },
  {
    id: 'l7',
    userId: 'u4',
    date: '2026-07-13',
    startTime: '08:00',
    hours: 3.5,
    status: 'pending',
    attestedByUserId: null,
    attestedByName: null,
    comment: null,
    appliedDate: '2026-07-02',
  },
  {
    id: 'l8',
    userId: 'u2',
    date: '2026-06-05',
    startTime: '12:00',
    hours: 3,
    status: 'approved',
    attestedByUserId: 'u_anna',
    attestedByName: 'Anna Berg',
    comment: null,
    appliedDate: '2026-06-01',
  },
  {
    id: 'l9',
    userId: 'u4',
    date: '2026-05-15',
    startTime: '13:00',
    hours: 2,
    status: 'approved',
    attestedByUserId: 'u_anna',
    attestedByName: 'Anna Berg',
    comment: null,
    appliedDate: '2026-05-11',
  },
]

export const DEMO_CORRECTIONS = [
  {
    id: 'c1',
    userId: 'u1',
    date: '2026-03-18' as IsoDate,
    minutes: 30,
    reason: 'Pass 14 mar registrerades med fel tid (45 i st.f. 195 min)',
    byUserId: 'u_peter',
    byName: 'Peter Ekström',
  },
]

/** Deterministic RNG — same algorithm and seeding as the prototype. */
function rng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export interface DemoWorkout {
  id: string
  userId: string
  date: IsoDate
  activity: string
  minutes: number
}

/**
 * Ports the prototype's workout generator verbatim: weekly 0–3 sessions from
 * May 2025 until the current week, with a fixed current week for Sara (u1)
 * so the "intjänat denna vecka" card shows a predictable value.
 */
export function generateDemoWorkouts(user: DemoUser, today: IsoDate): DemoWorkout[] {
  if (user.seed === null) return []
  const r = rng(user.seed * 7919 + 13)
  const acts =
    user.id === 'u1'
      ? [
          'Gym',
          'Gym',
          'Gym',
          'Padel',
          'Padel',
          'Padel',
          'Power walk',
          'Power walk',
          'Jogging',
          'Jogging',
          'Simning',
          'Cykling',
        ]
      : ['Gym', 'Jogging', 'Power walk', 'Cykling', 'Simning', 'Padel']
  const pool = user.id === 'u1' ? [45, 60, 60, 75, 90] : [30, 40, 45, 60, 60, 75, 90]
  const currentMonday = mondayOf(today)
  const out: DemoWorkout[] = []
  let n = 0
  let week = mondayOf(toIsoDate(new Date(2025, 4, 5)))
  while (week <= currentMonday) {
    const isCurrentWeek = week === currentMonday
    if (user.id === 'u1' && isCurrentWeek) {
      out.push({ id: 'w_u1_cur1', userId: user.id, date: week, activity: 'Gym', minutes: 60 })
      const wednesday = addDays(week, 2)
      if (wednesday <= today) {
        out.push({
          id: 'w_u1_cur2',
          userId: user.id,
          date: wednesday,
          activity: 'Power walk',
          minutes: 60,
        })
      }
    } else {
      const count = r() < (user.id === 'u1' ? 0.05 : 0.2) ? 0 : 1 + Math.floor(r() * 3)
      const offsets = new Set<number>()
      while (offsets.size < count) offsets.add(Math.floor(r() * 7))
      for (const offset of [...offsets].sort((a, b) => a - b)) {
        const date = addDays(week, offset)
        if (date > today) continue
        out.push({
          id: `w_${user.id}_${n++}`,
          userId: user.id,
          date,
          activity: acts[Math.floor(r() * acts.length)] as string,
          minutes: pool[Math.floor(r() * pool.length)] as number,
        })
      }
    }
    week = addDays(week, 7)
  }
  return out
}

// Re-export used by the seed runner for "today".
export { parseIsoDate, toIsoDate }
