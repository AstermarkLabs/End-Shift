import { defineConfig } from "drizzle-kit";
import path from "path";

// NOTE: `generate` only reads the schema and needs no database, so DATABASE_URL
// is not required here. Commands that do connect (`push`, `migrate`, `studio`)
// fail loudly on an empty URL instead.
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
