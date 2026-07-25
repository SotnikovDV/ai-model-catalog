import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ai-catalog-test-'));
process.env.DB_PATH = join(dir, 'test.db');
process.env.AI_ENABLED = 'false';
process.env.ADMIN_PASSWORD = '';
process.env.PORT = '0';
