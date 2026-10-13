import knex from 'knex'
import { db } from './knex'
import { config } from '../config'
import { logger } from '../logger'

/**
 * Creates the application database on a fresh SQL Server instance. On a
 * shared server the database is provisioned by IT and the app login may lack
 * CREATE DATABASE (or even visibility of it in master), so failure here is
 * only logged; migrations below fail clearly if the database really is missing.
 */
async function ensureDatabaseExists() {
  const master = knex({
    client: 'mssql',
    connection: {
      server: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: 'master',
      options: {
        encrypt: config.db.encrypt,
        trustServerCertificate: config.db.trustServerCertificate,
      },
    },
  })
  try {
    await master.raw(
      `IF DB_ID(?) IS NULL
       BEGIN
         DECLARE @sql nvarchar(300) = N'CREATE DATABASE ' + QUOTENAME(?);
         EXEC(@sql);
       END`,
      [config.db.database, config.db.database],
    )
  } catch (err) {
    logger.warn({ err, database: config.db.database }, 'db.ensureDatabaseExists skipped')
  } finally {
    await master.destroy()
  }
}

async function main() {
  await ensureDatabaseExists()
  const [batch, migrations] = await db.migrate.latest()
  if (migrations.length === 0) {
    logger.info('Database already up to date')
  } else {
    logger.info({ batch, migrations }, 'Migrations applied')
  }
  await db.destroy()
}

main().catch((err) => {
  logger.error({ err }, 'db.migrate')
  process.exitCode = 1
  return db.destroy()
})
