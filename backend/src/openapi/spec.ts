/**
 * OpenAPI 3.0 description of the Träningsreturen REST API.
 * Served at /api/openapi.json and rendered by Swagger UI at /swagger.
 */

const accountSchema = {
  type: 'object',
  description: 'Derived account state — always computed from the events, never stored.',
  properties: {
    balanceMinutes: { type: 'integer' },
    entries: { type: 'array', items: { $ref: '#/components/schemas/LedgerEntry' } },
    currentWeekEarnedMinutes: { type: 'integer' },
    earnedByWeek: { type: 'object', additionalProperties: { type: 'integer' } },
    expiringSoonMinutes: { type: 'integer' },
    firstExpiryDate: { type: 'string', format: 'date', nullable: true },
    workouts: { type: 'array', items: { $ref: '#/components/schemas/EarnedWorkout' } },
    totalWorkoutMinutes: { type: 'integer' },
  },
} as const

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Träningsreturen API',
    version: '1.0.0',
    description:
      'Employees register pulse-raising workouts and get 20 % of the time back as leave. ' +
      'Balances are always derived from events (workouts, approved withdrawals, corrections, expiries).',
    license: { name: 'AGPL-3.0-only' },
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      LedgerEntry: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          type: { type: 'string', enum: ['earned', 'withdrawal', 'correction', 'expiry'] },
          minutes: { type: 'integer', description: 'Signed balance effect' },
          balance: { type: 'integer', description: 'Running balance after this entry' },
          expiresAt: { type: 'string', format: 'date', nullable: true },
          earned: {
            type: 'object',
            nullable: true,
            properties: {
              activity: { type: 'string' },
              workoutMinutes: { type: 'integer' },
              cappedLostMinutes: { type: 'integer' },
            },
          },
          withdrawal: {
            type: 'object',
            nullable: true,
            properties: {
              hours: { type: 'number' },
              startTime: { type: 'string' },
              attestedBy: { type: 'string' },
              attestedByDelegate: { type: 'boolean' },
            },
          },
          correction: {
            type: 'object',
            nullable: true,
            properties: { reason: { type: 'string' }, byName: { type: 'string' } },
          },
          expiry: {
            type: 'object',
            nullable: true,
            properties: { sourceDate: { type: 'string', format: 'date' } },
          },
        },
      },
      EarnedWorkout: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string', format: 'date' },
          activity: { type: 'string' },
          minutes: { type: 'integer' },
          rawEarnedMinutes: { type: 'integer' },
          earnedMinutes: { type: 'integer' },
          capped: { type: 'boolean' },
        },
      },
      Account: accountSchema,
      WorkoutBatch: {
        type: 'object',
        required: ['workouts'],
        properties: {
          workouts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['date', 'activityTypeId', 'minutes'],
              properties: {
                date: { type: 'string', format: 'date' },
                activityTypeId: { type: 'string' },
                minutes: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },
      BatchPreview: {
        type: 'object',
        properties: {
          workoutCount: { type: 'integer' },
          totalMinutes: { type: 'integer' },
          earnedMinutes: { type: 'integer' },
          cappedLostMinutes: { type: 'integer' },
        },
      },
      Leave: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string', format: 'date' },
          startTime: { type: 'string' },
          hours: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'approved', 'denied'] },
          comment: { type: 'string', nullable: true },
          attestedBy: { type: 'string', nullable: true },
          attestedByDelegate: { type: 'boolean' },
          appliedDate: { type: 'string', format: 'date' },
        },
      },
      ApiError: {
        type: 'object',
        properties: { error: { type: 'string' }, code: { type: 'string', nullable: true } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/config': {
      get: {
        summary: 'Rule parameters and feature flags',
        security: [],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/me': {
      get: {
        summary: 'Current user profile and roles',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/me/account': {
      get: {
        summary: 'Derived balance and ledger for the current user',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Account' } },
            },
          },
        },
      },
    },
    '/api/me/attester': {
      get: {
        summary: 'Who attests my leave requests right now (manager or delegate)',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/me/top-activities': {
      get: {
        summary: 'The 5 most frequent activities for the quick-pick chips',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/me/workouts': {
      post: {
        summary: 'Register a batch of workouts (max 60 days back, never forward)',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/WorkoutBatch' } },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': {
            description: 'Validation error (invalid-date/future, invalid-minutes, …)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
            },
          },
        },
      },
    },
    '/api/me/workouts/preview': {
      post: {
        summary: 'Preview a batch before saving (count, time, earning, cap warning)',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/WorkoutBatch' } },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BatchPreview' } },
            },
          },
        },
      },
    },
    '/api/me/workouts/{id}': {
      patch: {
        summary: 'Edit an own workout (activity, minutes)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
      delete: {
        summary: 'Delete an own workout',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
    },
    '/api/me/leaves': {
      get: { summary: 'My leave requests', responses: { '200': { description: 'OK' } } },
      post: {
        summary: 'Apply for leave (quarter-hour steps, min 0.25 h)',
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Invalid hours/date' },
          '409': { description: 'Insufficient balance' },
        },
      },
    },
    '/api/team': {
      get: {
        summary: 'Manager: direct reports with balance and weekly earnings',
        responses: { '200': { description: 'OK' }, '403': { description: 'Not a manager' } },
      },
    },
    '/api/attest/pending': {
      get: {
        summary: 'Manager: pending leave requests in attestation scope',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/attest/handled': {
      get: {
        summary: 'Manager: recently handled leave requests',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/attest/{leaveId}': {
      post: {
        summary: 'Approve or deny a pending request (deduction only after approval)',
        parameters: [{ name: 'leaveId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'OK' },
          '404': { description: 'Not found' },
          '409': { description: 'Insufficient balance at approval' },
        },
      },
    },
    '/api/delegation': {
      get: {
        summary: 'Manager: current delegation and possible delegates',
        responses: { '200': { description: 'OK' } },
      },
      put: {
        summary: 'Manager: activate or end delegation of attestation',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/activity-types': {
      get: { summary: 'All activity types', responses: { '200': { description: 'OK' } } },
    },
    '/api/admin/stats': {
      get: {
        summary: 'Admin: organisation statistics',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/admin/users': {
      get: {
        summary: 'Admin: search users, flags possible duplicates',
        parameters: [{ name: 'query', in: 'query', required: false, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/admin/users/{id}/account': {
      get: {
        summary: "Admin: a user's full ledger (exactly what the employee sees)",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/admin/users/{id}/corrections': {
      post: {
        summary: 'Admin: balance correction (logged with who/when/why)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/admin/users/{id}/merge': {
      post: {
        summary: 'Admin: merge a duplicate account into this one (all history moves)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/admin/users/{id}/active': {
      post: {
        summary: 'Admin: activate/deactivate a user',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/admin/activity-types': {
      post: {
        summary: 'Admin: add activity type',
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/admin/activity-types/{id}': {
      patch: {
        summary: 'Admin: rename or (de)activate an activity type',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
  },
} as const
