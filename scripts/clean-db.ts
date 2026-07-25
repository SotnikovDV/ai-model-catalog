#!/usr/bin/env node
import { getDb, DB_PATH } from '../src/db/db.js';
import { CREATE_TABLE_SQL, CREATE_INDEXES_SQL } from '../src/db/schema.js';

console.log(`Cleaning database at ${DB_PATH}`);
const db = getDb();
db.exec('DROP TABLE IF EXISTS models;');
db.exec(CREATE_TABLE_SQL);
db.exec(CREATE_INDEXES_SQL);
console.log('Database cleaned and schema recreated.');
