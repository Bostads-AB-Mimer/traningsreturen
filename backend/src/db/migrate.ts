import knex from 'knex'
import { db } from './knex'
import { config } from '../config'
import { logger } from '../logger'

/** Creates the application database on a fresh SQL Server instance. */
async function ensureDatabaseExists() {
  const master = knex({
    client: 'mssql',
    connection: {
      server: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: 'master',
      options: { encrypt: false, trustServerCertificate: true },
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
