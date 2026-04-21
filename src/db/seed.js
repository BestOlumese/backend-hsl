import fs from 'fs/promises';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from './database.js';

async function seed() {
  const db = await getDb();
  
  // Clean start to enforce new schema
  await db.run('DROP TABLE IF EXISTS profiles;');
  
  await db.run(`
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
  
  let data;
  try {
    const fileContent = await fs.readFile(new URL('./seedData.json', import.meta.url), 'utf-8');
    data = JSON.parse(fileContent);
  } catch (err) {
    console.error('Failed to read seedData.json. Make sure the file exists.');
    process.exit(1);
  }

  const profiles = data.profiles || [];
  console.log(`Seeding ${profiles.length} profiles...`);
  
  const stmt = `
    INSERT OR IGNORE INTO profiles (
      id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_name, country_probability, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `;
  
  let count = 0;
  for (const p of profiles) {
    try {
      const id = uuidv7();
      const sample_size = p.sample_size || 1; // Default correctly if not present
      
      await db.run(stmt, [
        id, p.name, p.gender, p.gender_probability, sample_size, p.age, p.age_group, p.country_id, p.country_name, p.country_probability
      ]);
      count++;
    } catch(err) {
      console.error(`Error inserting ${p.name}:`, err.message);
    }
  }
  
  console.log(`Successfully seeded ${count} profiles.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
