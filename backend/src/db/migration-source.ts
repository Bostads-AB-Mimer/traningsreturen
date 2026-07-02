import fs from 'node:fs'
import path from 'node:path'

export interface MigrationModule {
  up: (knex: unknown) => Promise<void>
  down: (knex: unknown) => Promise<void>
}

interface MigrationRef {
  name: string
  file: string
}

/**
 * Migration source that records migrations by extension-less name, so a
 * database migrated in development (.ts via tsx) stays valid in production
 * where the compiled .js files run — and vice versa.
 */
export class ExtensionAgnosticMigrationSource {
  constructor(private readonly directory: string) {}

  async getMigrations(): Promise<MigrationRef[]> {
    const files = fs
      .readdirSync(this.directory)
      .filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith('.d.ts'))
      .sort()
    return files.map((file) => ({ name: file.replace(/\.(ts|js)$/, ''), file }))
  }

  getMigrationName(migration: MigrationRef): string {
    return migration.name
  }

  async getMigration(migration: MigrationRef): Promise<MigrationModule> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(path.join(this.directory, migration.file))
  }
}
