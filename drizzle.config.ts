import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.POSTGRES_URL) {
  console.warn(
    "Warning: POSTGRES_URL is not set. Drizzle migrations may fail.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? "",
  },
  verbose: true,
  tablesFilter: ["server_wallets"],
  strict: true,
});
