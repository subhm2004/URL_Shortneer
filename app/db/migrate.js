import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertConfigValid } from "../config/index.js";
import logger from "../core/logger.js";
import { closeDB, getPool } from "./pool.js";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Postgres advisory lock id. Two app instances booting at once (Docker scale,
 * a rolling deploy) would otherwise both try to apply the same migration and
 * one would fail on a duplicate object.
 */
const LOCK_ID = 4_812_7731;

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function migrate() {
  assertConfigValid();
  const client = await getPool().connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await ensureMigrationsTable(client);

    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (!pending.length) {
      logger.info(`Migrations up to date (${applied.size} applied)`);
      return;
    }

    for (const file of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");

      // Each migration is one transaction: a failure half-way leaves the schema
      // untouched rather than partially applied.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        logger.info(`Migration applied → ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    logger.info(`${pending.length} migration(s) applied`);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
}

// Allow `npm run migrate` as a standalone command.
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  migrate()
    .then(() => closeDB())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Migration failed", { error: err.message });
      process.exit(1);
    });
}
