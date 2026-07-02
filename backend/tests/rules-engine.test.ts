import {
  allocateEarnings,
  deriveAccount,
  previewBatch,
  rawEarning,
  validateLeaveHours,
  validateWorkoutDate,
  validateWorkoutMinutes,
} from '../src/rules/engine'
import { addDays, addMonths, isIsoDate, mondayOf } from '../src/rules/dates'
import { DEFAULT_RULES_CONFIG, RulesConfig, WorkoutInput } from '../src/rules/types'

const config: RulesConfig = { ...DEFAULT_RULES_CONFIG }
const expiryConfig: RulesConfig = { ...DEFAULT_RULES_CONFIG, expiryEnabled: true }

// 2026-07-01 is a Wednesday; the week is Mon 2026-06-29 – Sun 2026-07-05.
const TODAY = '2026-07-01'

const workout = (id: string, date: string, minutes: number, activity = 'Gym'): WorkoutInput => ({
  id,
  date,
  activity,
  minutes,
})

describe('date helpers', () => {
  it('computes the Monday of a week (Mon–Sun)', () => {
    expect(mondayOf('2026-07-01')).toBe('2026-06-29') // Wednesday
    expect(mondayOf('2026-06-29')).toBe('2026-06-29') // Monday itself
    expect(mondayOf('2026-07-05')).toBe('2026-06-29') // Sunday
    expect(mondayOf('2026-07-06')).toBe('2026-07-06') // next Monday
  })

  it('validates ISO dates strictly', () => {
    expect(isIsoDate('2026-07-01')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('01/07/2026')).toBe(false)
  })

  it('adds months for expiry dates', () => {
    expect(addMonths('2025-07-10', 12)).toBe('2026-07-10')
  })
})

describe('earning (20 % return)', () => {
  it('60 min workout in an empty week earns exactly +12 min', () => {
    const acc = deriveAccount(
      { workouts: [workout('w1', '2026-06-30', 60)], approvedLeaves: [], corrections: [] },
      config,
      TODAY,
    )
    expect(acc.balanceMinutes).toBe(12)
    expect(acc.currentWeekEarnedMinutes).toBe(12)
    expect(acc.workouts[0]?.earnedMinutes).toBe(12)
    expect(acc.workouts[0]?.capped).toBe(false)
  })

  it('rounds the share to whole minutes', () => {
    expect(rawEarning(20, config)).toBe(4)
    expect(rawEarning(45, config)).toBe(9)
    expect(rawEarning(50, config)).toBe(10)
    expect(rawEarning(52, config)).toBe(10) // 10.4 → 10
    expect(rawEarning(58, config)).toBe(12) // 11.6 → 12
  })
})

describe('weekly cap (36 min per Mon–Sun week)', () => {
  it('the fourth 60-minute workout in the same week earns 0 but is logged as capped', () => {
    const ws = [
      workout('w1', '2026-06-29', 60),
      workout('w2', '2026-06-30', 60),
      workout('w3', '2026-07-01', 60),
      workout('w4', '2026-07-01', 60),
    ]
    const acc = deriveAccount({ workouts: ws, approvedLeaves: [], corrections: [] }, config, TODAY)
    expect(acc.workouts.map((w) => w.earnedMinutes)).toEqual([12, 12, 12, 0])
    expect(acc.workouts[3]?.capped).toBe(true)
    expect(acc.workouts[3]?.rawEarnedMinutes).toBe(12)
    expect(acc.balanceMinutes).toBe(36)
    // The capped workout is still logged as its own ledger row.
    const cappedRow = acc.entries.find((e) => e.earned && e.minutes === 0)
    expect(cappedRow).toBeDefined()
    expect(cappedRow?.earned?.cappedLostMinutes).toBe(12)
  })

  it('allocates partially when a workout straddles the remaining cap', () => {
    const ws = [
      workout('w1', '2026-06-29', 90), // raw 18
      workout('w2', '2026-06-30', 90), // raw 18 → cap now full (36)
      workout('w3', '2026-07-01', 60), // raw 12 → earns 0
    ]
    const { workouts } = allocateEarnings(ws, config)
    expect(workouts.map((w) => w.earnedMinutes)).toEqual([18, 18, 0])
  })

  it('allocates per workout in date order regardless of input order', () => {
    const ws = [
      workout('late', '2026-07-01', 200), // raw 40
      workout('early', '2026-06-29', 60), // raw 12
    ]
    const { workouts } = allocateEarnings(ws, config)
    expect(workouts[0]?.id).toBe('early')
    expect(workouts[0]?.earnedMinutes).toBe(12)
    expect(workouts[1]?.earnedMinutes).toBe(24) // 36 − 12 remaining
    expect(workouts[1]?.capped).toBe(true)
  })

  it('resets the cap across week boundaries (Sunday vs Monday)', () => {
    const ws = [
      workout('w1', '2026-06-28', 300), // Sunday of previous week, raw 60 → 36
      workout('w2', '2026-06-29', 300), // Monday of next week, raw 60 → 36
    ]
    const acc = deriveAccount({ workouts: ws, approvedLeaves: [], corrections: [] }, config, TODAY)
    expect(acc.balanceMinutes).toBe(72)
    expect(acc.earnedByWeek['2026-06-22']).toBe(36)
    expect(acc.earnedByWeek['2026-06-29']).toBe(36)
  })
})

describe('batch preview', () => {
  it('3×20 min jogging + 4×60 min gym in one submission = 7 workouts with cap warning', () => {
    const batch: WorkoutInput[] = [
      workout('j1', '2026-06-29', 20, 'Jogging'),
      workout('j2', '2026-06-30', 20, 'Jogging'),
      workout('j3', '2026-07-01', 20, 'Jogging'),
      workout('g1', '2026-06-29', 60),
      workout('g2', '2026-06-30', 60),
      workout('g3', '2026-06-30', 60),
      workout('g4', '2026-07-01', 60),
    ]
    const preview = previewBatch([], batch, config)
    expect(preview.workoutCount).toBe(7)
    expect(preview.totalMinutes).toBe(300)
    // Raw earning: 3×4 + 4×12 = 60, capped to 36 for the single week.
    expect(preview.earnedMinutes).toBe(36)
    expect(preview.cappedLostMinutes).toBe(24)
  })

  it('accounts for already-registered workouts in the same weeks', () => {
    const existing = [workout('e1', '2026-06-29', 120)] // raw 24 already used
    const batch = [workout('n1', '2026-06-30', 120)] // raw 24, only 12 left
    const preview = previewBatch(existing, batch, config)
    expect(preview.earnedMinutes).toBe(12)
    expect(preview.cappedLostMinutes).toBe(12)
  })

  it('spreads across weeks without a warning when the cap is not hit', () => {
    const batch = [workout('n1', '2026-06-23', 60), workout('n2', '2026-06-30', 60)]
    const preview = previewBatch([], batch, config)
    expect(preview.earnedMinutes).toBe(24)
    expect(preview.cappedLostMinutes).toBe(0)
  })
})

describe('workout date validation (max 60 days back, never forward)', () => {
  it('rejects future dates', () => {
    expect(validateWorkoutDate(addDays(TODAY, 1), config, TODAY)).toBe('future')
  })

  it('rejects dates older than 60 days', () => {
    expect(validateWorkoutDate(addDays(TODAY, -61), config, TODAY)).toBe('too_old')
  })

  it('accepts today and the 60-day boundary', () => {
    expect(validateWorkoutDate(TODAY, config, TODAY)).toBeNull()
    expect(validateWorkoutDate(addDays(TODAY, -60), config, TODAY)).toBeNull()
  })

  it('rejects malformed dates', () => {
    expect(validateWorkoutDate('2026-13-40', config, TODAY)).toBe('invalid')
    expect(validateWorkoutDate('igår', config, TODAY)).toBe('invalid')
  })
})

describe('withdrawals (quarter-hour steps, FIFO, only after approval)', () => {
  it('validates quarter-hour steps with 0.25 h minimum', () => {
    expect(validateLeaveHours(0.25)).toBe(true)
    expect(validateLeaveHours(2)).toBe(true)
    expect(validateLeaveHours(3.75)).toBe(true)
    expect(validateLeaveHours(0)).toBe(false)
    expect(validateLeaveHours(0.2)).toBe(false)
    expect(validateLeaveHours(1.1)).toBe(false)
    expect(validateLeaveHours(-0.5)).toBe(false)
  })

  it('only approved withdrawals affect the balance (denied ones are not passed in)', () => {
    const ws = [workout('w1', '2026-06-29', 180)] // 36 earned
    const acc = deriveAccount(
      {
        workouts: ws,
        approvedLeaves: [
          {
            id: 'l1',
            date: '2026-07-01',
            startTime: '13:00',
            hours: 0.5,
            attestedBy: 'Anna Berg',
            attestedByDelegate: false,
          },
        ],
        corrections: [],
      },
      config,
      TODAY,
    )
    expect(acc.balanceMinutes).toBe(6)
    const w = acc.entries.find((e) => e.type === 'withdrawal')
    expect(w?.minutes).toBe(-30)
    expect(w?.withdrawal?.attestedBy).toBe('Anna Berg')
  })

  it('deducts FIFO from the oldest earning so newer time survives expiry', () => {
    // Earn 36 min long ago and 12 min recently; withdraw 30 min in between.
    // FIFO must consume the old bucket first, so only 6 old + 12 new remain.
    const oldDate = '2025-08-04'
    const acc = deriveAccount(
      {
        workouts: [workout('w1', oldDate, 180), workout('w2', '2026-06-29', 60)],
        approvedLeaves: [
          {
            id: 'l1',
            date: '2026-06-01',
            startTime: '08:00',
            hours: 0.5,
            attestedBy: 'Anna Berg',
            attestedByDelegate: false,
          },
        ],
        corrections: [],
      },
      expiryConfig,
      TODAY,
    )
    // Old bucket: 36 − 30 = 6 left, expires 2026-08-04 (within 3 months of today).
    expect(acc.expiringSoonMinutes).toBe(6)
    expect(acc.firstExpiryDate).toBe('2026-08-04')
    expect(acc.balanceMinutes).toBe(36 + 12 - 30)
  })
})

describe('expiry feature flag (KONCEPT)', () => {
  const oldDate = '2025-05-05' // > 12 months before TODAY

  it('flag ON: unused time older than 12 months expires as its own ledger rows', () => {
    const acc = deriveAccount(
      { workouts: [workout('w1', oldDate, 60)], approvedLeaves: [], corrections: [] },
      expiryConfig,
      TODAY,
    )
    const expiryRow = acc.entries.find((e) => e.type === 'expiry')
    expect(expiryRow).toBeDefined()
    expect(expiryRow?.minutes).toBe(-12)
    expect(expiryRow?.date).toBe('2026-05-05')
    expect(expiryRow?.expiry?.sourceDate).toBe(oldDate)
    expect(acc.balanceMinutes).toBe(0)
  })

  it('flag OFF: no expiry rows, no expiry warning, expiresAt is null everywhere', () => {
    const acc = deriveAccount(
      { workouts: [workout('w1', oldDate, 60)], approvedLeaves: [], corrections: [] },
      config,
      TODAY,
    )
    expect(acc.entries.some((e) => e.type === 'expiry')).toBe(false)
    expect(acc.entries.every((e) => e.expiresAt === null)).toBe(true)
    expect(acc.expiringSoonMinutes).toBe(0)
    expect(acc.firstExpiryDate).toBeNull()
    expect(acc.balanceMinutes).toBe(12)
  })

  it('flags time expiring within 3 months for the notice', () => {
    const soonSource = addMonths(addDays(TODAY, 30), -12) // expires in ~1 month
    const laterSource = addMonths(addDays(TODAY, 150), -12) // expires in ~5 months
    const acc = deriveAccount(
      {
        workouts: [workout('w1', soonSource, 60), workout('w2', laterSource, 60)],
        approvedLeaves: [],
        corrections: [],
      },
      expiryConfig,
      TODAY,
    )
    expect(acc.expiringSoonMinutes).toBe(12)
    expect(acc.firstExpiryDate).toBe(addDays(TODAY, 30))
  })

  it('withdrawals consume expiring time first (FIFO), reducing what expires', () => {
    const acc = deriveAccount(
      {
        workouts: [workout('w1', oldDate, 180)], // 36 earned, expires 2026-05-05
        approvedLeaves: [
          {
            id: 'l1',
            date: '2025-10-01',
            startTime: '13:00',
            hours: 0.5,
            attestedBy: 'Anna Berg',
            attestedByDelegate: false,
          },
        ],
        corrections: [],
      },
      expiryConfig,
      TODAY,
    )
    const expiryRow = acc.entries.find((e) => e.type === 'expiry')
    expect(expiryRow?.minutes).toBe(-6) // 36 − 30 withdrawn
    expect(acc.balanceMinutes).toBe(0)
  })
})

describe('corrections', () => {
  it('positive and negative corrections hit the ledger with who/when/why', () => {
    const acc = deriveAccount(
      {
        workouts: [workout('w1', '2026-06-29', 180)],
        approvedLeaves: [],
        corrections: [
          {
            id: 'c1',
            date: '2026-06-30',
            minutes: -10,
            reason: 'Pass 29 jun registrerades dubbelt',
            byName: 'Peter Ekström',
          },
        ],
      },
      config,
      TODAY,
    )
    const row = acc.entries.find((e) => e.type === 'correction')
    expect(row?.minutes).toBe(-10)
    expect(row?.correction).toEqual({
      reason: 'Pass 29 jun registrerades dubbelt',
      byName: 'Peter Ekström',
    })
    expect(acc.balanceMinutes).toBe(26)
  })

  it('positive corrections create expiring time when the flag is on', () => {
    const acc = deriveAccount(
      {
        workouts: [],
        approvedLeaves: [],
        corrections: [
          { id: 'c1', date: '2025-05-05', minutes: 30, reason: 'Manuell rättning', byName: 'PE' },
        ],
      },
      expiryConfig,
      TODAY,
    )
    expect(acc.entries.find((e) => e.type === 'expiry')?.minutes).toBe(-30)
    expect(acc.balanceMinutes).toBe(0)
  })
})

describe('running balance', () => {
  it('every row equals the sum of all rows up to and including it', () => {
    const acc = deriveAccount(
      {
        workouts: [
          workout('w1', '2025-05-05', 60),
          workout('w2', '2025-09-01', 90),
          workout('w3', '2026-06-29', 60),
        ],
        approvedLeaves: [
          {
            id: 'l1',
            date: '2025-10-03',
            startTime: '13:00',
            hours: 0.25,
            attestedBy: 'Anna Berg',
            attestedByDelegate: false,
          },
        ],
        corrections: [
          { id: 'c1', date: '2026-03-18', minutes: 30, reason: 'Fel tid', byName: 'PE' },
        ],
      },
      expiryConfig,
      TODAY,
    )
    let sum = 0
    for (const row of acc.entries) {
      sum += row.minutes
      expect(row.balance).toBe(sum)
    }
    expect(acc.balanceMinutes).toBe(sum)
  })
})

describe('workout minutes validation', () => {
  it('accepts whole positive minutes up to 24 h', () => {
    expect(validateWorkoutMinutes(1)).toBe(true)
    expect(validateWorkoutMinutes(60)).toBe(true)
    expect(validateWorkoutMinutes(0)).toBe(false)
    expect(validateWorkoutMinutes(-30)).toBe(false)
    expect(validateWorkoutMinutes(12.5)).toBe(false)
    expect(validateWorkoutMinutes(24 * 60 + 1)).toBe(false)
  })
})
