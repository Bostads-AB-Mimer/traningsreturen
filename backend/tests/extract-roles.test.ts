import { extractClaim, extractRoles } from '../src/auth/jwt'

const CLIENT_ID = 'traningsreturen-app'

describe('extractRoles', () => {
  it('reads realm roles (own Keycloak instance)', () => {
    expect(extractRoles({ realm_access: { roles: ['employee', 'manager'] } }, CLIENT_ID)).toEqual([
      'employee',
      'manager',
    ])
  })

  it('reads client roles from resource_access (shared realm like onecore)', () => {
    expect(
      extractRoles(
        { resource_access: { [CLIENT_ID]: { roles: ['admin', 'employee'] } } },
        CLIENT_ID,
      ),
    ).toEqual(['employee', 'admin'])
  })

  it('merges realm and client roles without duplicates', () => {
    expect(
      extractRoles(
        {
          realm_access: { roles: ['employee'] },
          resource_access: { [CLIENT_ID]: { roles: ['employee', 'manager'] } },
        },
        CLIENT_ID,
      ),
    ).toEqual(['employee', 'manager'])
  })

  it('ignores roles for other clients and unknown role names', () => {
    expect(
      extractRoles(
        {
          realm_access: { roles: ['offline_access', 'uma_authorization'] },
          resource_access: {
            'other-app': { roles: ['admin'] },
            account: { roles: ['view-profile'] },
          },
        },
        CLIENT_ID,
      ),
    ).toEqual([])
  })

  it('handles tokens without any role claims', () => {
    expect(extractRoles({}, CLIENT_ID)).toEqual([])
  })
})

describe('extractClaim (AD-synced attributes)', () => {
  it('reads the first matching claim name', () => {
    expect(extractClaim({ jobTitle: 'Utvecklingschef' }, ['jobTitle', 'job_title'])).toBe(
      'Utvecklingschef',
    )
    expect(
      extractClaim({ office_location: 'Utvecklingsenheten' }, [
        'officeLocation',
        'office_location',
      ]),
    ).toBe('Utvecklingsenheten')
  })

  it('ignores empty, whitespace-only and non-string values', () => {
    expect(extractClaim({ jobTitle: '   ' }, ['jobTitle'])).toBeNull()
    expect(extractClaim({ jobTitle: 42 }, ['jobTitle'])).toBeNull()
    expect(extractClaim({}, ['jobTitle'])).toBeNull()
  })

  it('trims values', () => {
    expect(extractClaim({ jobTitle: '  Snickare  ' }, ['jobTitle'])).toBe('Snickare')
  })
})
