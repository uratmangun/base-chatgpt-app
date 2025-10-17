import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn("POSTGRES_URL is not set. Database operations will fail.");
}

const pool = connectionString
  ? new Pool({
      connectionString,
      max: 5,
    })
  : undefined;

export const db = pool ? drizzle(pool) : undefined;

export type DbClient = typeof db;
