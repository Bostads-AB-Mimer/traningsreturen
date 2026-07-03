import { Knex } from 'knex'

/**
 * Keycloak user id (the token's `sub` claim). Used to resolve the AD-synced
 * `managerId` attribute — which holds the manager's Keycloak id — into the
 * app's manager relation at login.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.string('keycloak_id', 64).nullable()
  })
  // Filtered unique index: MSSQL plain unique indexes treat NULLs as equal.
  await knex.raw(
    `CREATE UNIQUE INDEX users_keycloak_id_unique
     ON users (keycloak_id) WHERE keycloak_id IS NOT NULL`,
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX users_keycloak_id_unique ON users')
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('keycloak_id')
  })
}
