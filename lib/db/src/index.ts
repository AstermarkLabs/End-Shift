import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// node-postgres emits 'error' on IDLE pooled clients when the backend closes a
// connection (server restart, network blip, idle timeout, deployment swap). That
// is an EventEmitter 'error' event: with no listener attached, Node rethrows it
// as an unhandled exception and kills the process — even though the pool itself
// recovers fine by discarding the client and opening a new one.
//
// Observed in production as `Error: Connection terminated unexpectedly` at
// pg-pool's idleListener, crashing the API server ~7s after a healthy boot.
// Logging and swallowing is the documented handling; do not exit here.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
