import knex, { Knex } from 'knex'
import path from 'node:path'
import { config } from '../config'
import { ExtensionAgnosticMigrationSource } from './migration-source'

export function createKnex(): Knex {
  return knex({
    client: 'mssql',
    connection: {
      server: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    },
    pool: { min: 0, max: 10 },
    migrations: {
      // Extension-agnostic bookkeeping: dev runs .ts (tsx), prod runs compiled .js.
      migrationSource: new ExtensionAgnosticMigrationSource(path.join(__dirname, 'migrations')),
    },
  })
}

export const db = createKnex()
