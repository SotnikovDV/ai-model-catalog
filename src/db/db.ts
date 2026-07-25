import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import 'dotenv/config';

const projectRoot = process.cwd();

export const DB_PATH = process.env.DB_PATH
  ? path.resolve(projectRoot, process.env.DB_PATH)
  : path.resolve(projectRoot, 'data/models.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  return dbInstance;
}
