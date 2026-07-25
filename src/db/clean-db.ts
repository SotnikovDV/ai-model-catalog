import { rm } from 'node:fs/promises';
import { DB_PATH, getDb } from './db.js';
import { CREATE_TABLE_SQL, CREATE_INDEXES_SQL } from './schema.js';
import { seedModels } from './seeds.js';
import { insertModel } from './migrate.js';

async function main() {
  console.log(`Database path: ${DB_PATH}`);

  try {
    await rm(DB_PATH, { force: true });
    console.log('Removed existing database file');
  } catch (err) {
    console.error('Failed to remove database file:', err);
    process.exit(1);
  }

  const db = getDb();
  db.exec(CREATE_TABLE_SQL);
  db.exec(CREATE_INDEXES_SQL);
  console.log('Applied schema');

  for (const model of seedModels) {
    insertModel(db, model);
  }
  console.log(`Seeded ${seedModels.length} models`);

  console.log('Database recreated, schema applied, and seed data loaded');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
