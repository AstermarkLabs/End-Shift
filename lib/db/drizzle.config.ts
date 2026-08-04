import { defineConfig } from "drizzle-kit";
import 'dotenv/config';

// NOTE: `generate` only reads the schema and needs no database, so DATABASE_URL
// is not required here. Commands that do connect (`push`, `migrate`, `studio`)
// fail loudly on an empty URL instead.
// Paths must stay relative (not path.join(__dirname, ...)) — drizzle-kit 0.31.x
// mishandles absolute out/schema paths and produces a malformed read path.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
