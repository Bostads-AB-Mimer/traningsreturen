import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.string('id', 40).primary()
    // Matched against the `preferred_username` claim in the Keycloak JWT.
    t.string('keycloak_username', 255).nullable().unique()
    t.string('name', 200).notNullable()
    t.string('department', 200).notNullable()
    t.string('title', 200).notNullable()
    t.boolean('active').notNullable().defaultTo(true)
    // Managers can receive delegated attestation even without direct reports.
    t.boolean('is_manager').notNullable().defaultTo(false)
    t.string('manager_id', 40).nullable().references('id').inTable('users')
    // Set when an account is merged away into another; kept for traceability.
    t.string('merged_into_user_id', 40).nullable().references('id').inTable('users')
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now())
    t.dateTime('updated_at').notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('activity_types', (t) => {
    t.string('id', 40).primary()
    t.string('name', 100).notNullable().unique()
    t.boolean('active').notNullable().defaultTo(true)
    t.integer('sort_order').notNullable().defaultTo(0)
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('workouts', (t) => {
    t.string('id', 40).primary()
    t.string('user_id', 40).notNullable().references('id').inTable('users')
    t.date('date').notNullable()
    t.string('activity_type_id', 40).notNullable().references('id').inTable('activity_types')
    t.integer('minutes').notNullable()
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now())
    t.dateTime('updated_at').notNullable().defaultTo(knex.fn.now())
    t.index(['user_id', 'date'])
  })

  await knex.schema.createTable('leave_requests', (t) => {
    t.string('id', 40).primary()
    t.string('user_id', 40).notNullable().references('id').inTable('users')
    t.date('date').notNullable()
    t.string('start_time', 5).notNullable()
    t.decimal('hours', 5, 2).notNullable()
    t.string('status', 10).notNullable().defaultTo('pending') // pending | approved | denied
    t.string('comment', 500).nullable()
    t.string('attested_by_user_id', 40).nullable().references('id').inTable('users')
    // Snapshot of the approver's name at attest time (manager or delegate).
    t.string('attested_by_name', 200).nullable()
    t.boolean('attested_by_delegate').notNullable().defaultTo(false)
    t.dateTime('attested_at').nullable()
    t.date('applied_date').notNullable()
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now())
    t.dateTime('updated_at').notNullable().defaultTo(knex.fn.now())
    t.index(['user_id', 'status'])
    t.index(['status'])
  })

  await knex.schema.createTable('corrections', (t) => {
    t.string('id', 40).primary()
    t.string('user_id', 40).notNullable().references('id').inTable('users')
    t.date('date').notNullable()
    t.integer('minutes').notNullable()
    t.string('reason', 500).notNullable()
    t.string('by_user_id', 40).nullable().references('id').inTable('users')
    // Snapshot shown in the employee's ledger.
    t.string('by_name', 200).notNullable()
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now())
    t.index(['user_id'])
  })

  await knex.schema.createTable('delegations', (t) => {
    t.string('id', 40).primary()
    t.string('manager_user_id', 40).notNullable().references('id').inTable('users')
    t.string('delegate_user_id', 40).notNullable().references('id').inTable('users')
    t.date('until_date').notNullable()
    t.boolean('active').notNullable().defaultTo(true)
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now())
    t.dateTime('updated_at').notNullable().defaultTo(knex.fn.now())
    t.index(['manager_user_id', 'active'])
  })

  await knex.schema.createTable('audit_log', (t) => {
    t.bigIncrements('id').primary()
    t.dateTime('at').notNullable().defaultTo(knex.fn.now())
    t.string('actor_user_id', 40).nullable()
    t.string('actor_name', 200).notNullable()
    t.string('action', 100).notNullable()
    t.string('entity', 50).notNullable()
    t.string('entity_id', 40).nullable()
    t.text('details').nullable() // JSON payload
    t.index(['entity', 'entity_id'])
    t.index(['at'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_log')
  await knex.schema.dropTableIfExists('delegations')
  await knex.schema.dropTableIfExists('corrections')
  await knex.schema.dropTableIfExists('leave_requests')
  await knex.schema.dropTableIfExists('workouts')
  await knex.schema.dropTableIfExists('activity_types')
  await knex.schema.dropTableIfExists('users')
}
