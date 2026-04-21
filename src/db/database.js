import { createClient } from "@libsql/client";
import dotenv from "dotenv";

// Load environment variables for local development
dotenv.config();

let wrappedDb = null;

export const getDb = async () => {
  if (wrappedDb) {
    return wrappedDb;
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Bootstrap the schema if it doesn't exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE COLLATE NOCASE NOT NULL,
      gender TEXT NOT NULL,
      gender_probability REAL NOT NULL,
      sample_size INTEGER NOT NULL,
      age INTEGER NOT NULL,
      age_group TEXT NOT NULL,
      country_id TEXT NOT NULL,
      country_name TEXT NOT NULL,
      country_probability REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Wrap the LibSQL client to match the native sqlite module API endpoints
  // This allows the profile.controller.js to use .get(), .all(), and .run() natively!
  wrappedDb = {
    get: async (sql, args = []) => {
      const result = await client.execute({ sql, args });
      return result.rows.length > 0 ? result.rows[0] : undefined;
    },
    all: async (sql, args = []) => {
      const result = await client.execute({ sql, args });
      return result.rows;
    },
    run: async (sql, args = []) => {
      return await client.execute({ sql, args });
    }
  };

  return wrappedDb;
};
