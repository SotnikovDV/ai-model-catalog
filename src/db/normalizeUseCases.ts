import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db.js';
import { normalizeUseCases } from '../utils/useCaseTaxonomy.js';

interface ModelRow {
  id: string;
  name: string;
  use_cases: string;
}

function parseUseCases(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export interface NormalizeUseCasesReport {
  total: number;
  updated: number;
  unchanged: number;
  emptied: number;
  unmapped: Map<string, number>;
  emptiedModels: string[];
}

export function normalizeAllModelUseCases(dryRun = false): NormalizeUseCasesReport {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, use_cases FROM models').all() as unknown as ModelRow[];
  const updateStmt = db.prepare('UPDATE models SET use_cases = ?, updated_at = ? WHERE id = ?');

  const report: NormalizeUseCasesReport = {
    total: rows.length,
    updated: 0,
    unchanged: 0,
    emptied: 0,
    unmapped: new Map(),
    emptiedModels: [],
  };

  const now = new Date().toISOString();

  for (const row of rows) {
    const original = parseUseCases(row.use_cases);
    const normalized = normalizeUseCases(original);

    for (const item of original) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (!normalized.includes(trimmed) && !normalized.some((n) => n === trimmed)) {
        const canonical = normalizeUseCases([trimmed]);
        if (canonical.length === 0) {
          report.unmapped.set(trimmed, (report.unmapped.get(trimmed) ?? 0) + 1);
        }
      }
    }

    const same = original.length === normalized.length
      && original.every((item, index) => item === normalized[index]);

    if (same) {
      report.unchanged += 1;
      continue;
    }

    if (normalized.length === 0 && original.length > 0) {
      report.emptied += 1;
      report.emptiedModels.push(row.name);
    }

    if (!dryRun) {
      updateStmt.run(JSON.stringify(normalized), now, row.id);
    }
    report.updated += 1;
  }

  return report;
}

function printReport(report: NormalizeUseCasesReport, dryRun: boolean): void {
  console.log(dryRun ? 'Предпросмотр нормализации use_cases' : 'Нормализация use_cases завершена');
  console.log(`Всего моделей: ${report.total}`);
  console.log(`${dryRun ? 'Будет обновлено' : 'Обновлено'}: ${report.updated}`);
  console.log(`Без изменений: ${report.unchanged}`);
  console.log(`Опустели после нормализации: ${report.emptied}`);

  if (report.emptiedModels.length > 0) {
    console.log('\nМодели с пустым use_cases после нормализации:');
    for (const name of report.emptiedModels.slice(0, 20)) {
      console.log(`  - ${name}`);
    }
    if (report.emptiedModels.length > 20) {
      console.log(`  ... и ещё ${report.emptiedModels.length - 20}`);
    }
  }

  if (report.unmapped.size > 0) {
    const sorted = [...report.unmapped.entries()].sort((a, b) => b[1] - a[1]);
    console.log('\nТоп неразрешённых значений (добавьте в aliases):');
    for (const [value, count] of sorted.slice(0, 30)) {
      console.log(`  [${count}] ${value}`);
    }
    if (sorted.length > 30) {
      console.log(`  ... и ещё ${sorted.length - 30} уникальных значений`);
    }
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const dryRun = process.argv.includes('--dry-run');
  const report = normalizeAllModelUseCases(dryRun);
  printReport(report, dryRun);
}
