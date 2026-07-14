import pg from "pg";
import config from "../config/index.js";
import logger from "../core/logger.js";

const { Pool, types } = pg;

/**
 * node-postgres hands back BIGINT (OID 20) as a string because a 64-bit int can
 * exceed Number.MAX_SAFE_INTEGER. Our click counts never will, and the API
 * contract says these are numbers, so parse them here rather than at every
 * call site.
 */
types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

/**
 * Singleton — one pool for the whole process. Creating a Pool per request would
 * open a new TCP connection each time and exhaust Postgres' connection limit.
 */
let pool = null;

export function getPool() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: config.db.connectionString,
    ssl: config.db.ssl,
    max: config.db.max,
    idleTimeoutMillis: config.db.idleTimeoutMillis,
    connectionTimeoutMillis: config.db.connectionTimeoutMillis,
  });

  // An idle client erroring out (network blip, Postgres restart) surfaces here.
  // Without a listener, node-postgres would emit an unhandled 'error' and crash.
  pool.on("error", (err) => {
    logger.error("Idle Postgres client errored", { error: err.message });
  });

  return pool;
}

/** Verifies the connection string actually works, so boot fails loudly. */
export async function connectDB() {
  const p = getPool();
  const { rows } = await p.query("SELECT current_database() AS db, version() AS version");
  const { db, version } = rows[0];
  logger.info(`Postgres connected → ${db}`, {
    version: String(version).split(" ").slice(0, 2).join(" "),
  });
  return p;
}

export async function closeDB() {
  if (!pool) return;
  await pool.end();
  pool = null;
  logger.info("Postgres pool closed");
}
