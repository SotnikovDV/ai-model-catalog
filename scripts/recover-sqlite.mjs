/**
 * Восстанавливает читаемые данные из повреждённого SQLite в новый файл.
 * Исходный models.db не изменяется.
 *
 * DB_PATH=/app/data/models.db node scripts/recover-sqlite.mjs
 */
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const srcPath = path.resolve(process.env.DB_PATH ?? 'data/models.db');
const dstPath = path.resolve(
  process.env.RECOVER_DB_PATH ?? path.join(path.dirname(srcPath), 'models.recovered.db'),
);

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function tableNames(db) {
  return db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map((row) => row.name);
}

function copyRows(src, dst, table) {
  const qTable = quoteIdent(table);
  const columns = src.prepare(`PRAGMA table_info(${qTable})`).all().map((row) => row.name);
  const colList = columns.map(quoteIdent).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const insert = dst.prepare(`INSERT OR IGNORE INTO ${qTable} (${colList}) VALUES (${placeholders})`);
  const selectSql = `SELECT ${colList} FROM ${qTable}`;

  let copied = 0;
  let skipped = 0;

  try {
    const rows = src.prepare(selectSql).all();
    dst.exec('BEGIN');
    for (const row of rows) {
      try {
        insert.run(...columns.map((col) => row[col]));
        copied += 1;
      } catch {
        skipped += 1;
      }
    }
    dst.exec('COMMIT');
    return { copied, skipped, method: 'all' };
  } catch (error) {
    try { dst.exec('ROLLBACK'); } catch { /* ignore */ }
    console.warn(`  ${table}: SELECT * не удался (${error.message}), копирую по rowid`);
  }

  copied = 0;
  skipped = 0;
  let maxRowid = 0;
  try {
    maxRowid = Number(src.prepare(`SELECT MAX(rowid) AS m FROM ${qTable}`).get()?.m ?? 0);
  } catch (error) {
    throw new Error(`Не удалось получить MAX(rowid) для ${table}: ${error.message}`);
  }

  const byRowid = src.prepare(`SELECT ${colList} FROM ${qTable} WHERE rowid = ?`);
  dst.exec('BEGIN');
  for (let rowid = 1; rowid <= maxRowid; rowid += 1) {
    try {
      const row = byRowid.get(rowid);
      if (!row) continue;
      insert.run(...columns.map((col) => row[col]));
      copied += 1;
    } catch {
      skipped += 1;
    }
  }
  dst.exec('COMMIT');
  return { copied, skipped, method: 'rowid' };
}

function recreateSchema(src, dst, table) {
  const row = src.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(table);
  if (!row?.sql) throw new Error(`Нет CREATE TABLE для ${table}`);
  dst.exec(row.sql);
}

function recreateIndexes(src, dst, table) {
  const indexes = src.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL
  `).all(table);

  for (const index of indexes) {
    try {
      dst.exec(index.sql);
    } catch (error) {
      console.warn(`  индекс не создан: ${error.message}`);
    }
  }
}

console.log(`Источник: ${srcPath}`);
console.log(`Назначение: ${dstPath}`);

if (!existsSync(srcPath)) {
  throw new Error(`Файл БД не найден: ${srcPath}`);
}

if (existsSync(dstPath)) {
  unlinkSync(dstPath);
}

const src = new DatabaseSync(srcPath, { readOnly: true });
const dst = new DatabaseSync(dstPath);
dst.exec('PRAGMA journal_mode = DELETE');
dst.exec('PRAGMA busy_timeout = 5000');
dst.exec('PRAGMA foreign_keys = OFF');

const tables = tableNames(src);
console.log(`Таблицы: ${tables.join(', ') || '(нет)'}`);

for (const table of tables) {
  console.log(`Копирую ${table}...`);
  recreateSchema(src, dst, table);
  const result = copyRows(src, dst, table);
  recreateIndexes(src, dst, table);
  console.log(`  ${result.copied} строк (${result.method}), пропущено ${result.skipped}`);
}

src.close();
dst.exec('PRAGMA foreign_keys = ON');
const check = dst.prepare('PRAGMA integrity_check').all();
dst.close();

const ok = check.length === 1 && check[0].integrity_check === 'ok';
console.log('integrity_check:', check.map((row) => row.integrity_check).join('\n'));

if (!ok) {
  process.exitCode = 1;
  console.error('Восстановленный файл всё ещё не прошёл integrity_check. Не заменяйте models.db.');
} else {
  console.log('Готово. Остановите контейнер, сохраните models.db как бэкап и замените его на models.recovered.db.');
}
