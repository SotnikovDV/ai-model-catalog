import * as fs from 'node:fs';
import * as path from 'node:path';

export interface HelpTopicMeta {
  title: string;
  file: string;
  page?: string;
  description?: string;
}

export interface HelpManifest {
  version: number;
  topics: Record<string, HelpTopicMeta>;
}

export interface HelpArticle {
  context: string;
  title: string;
  description?: string;
  page?: string;
  markdown: string;
}

const CONTEXT_ID_RE = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;

let cachedManifest: HelpManifest | null = null;
let cachedManifestMtimeMs = 0;

function helpRoot(): string {
  return path.join(process.cwd(), 'help');
}

function readManifest(): HelpManifest {
  const manifestPath = path.join(helpRoot(), 'manifest.json');
  const stat = fs.statSync(manifestPath);
  if (cachedManifest && cachedManifestMtimeMs === stat.mtimeMs) {
    return cachedManifest;
  }

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as HelpManifest;
  if (!parsed?.topics || typeof parsed.topics !== 'object') {
    throw new Error('Некорректный help/manifest.json');
  }

  cachedManifest = parsed;
  cachedManifestMtimeMs = stat.mtimeMs;
  return parsed;
}

export function listHelpTopics(): Array<{ context: string } & HelpTopicMeta> {
  const manifest = readManifest();
  return Object.entries(manifest.topics).map(([context, meta]) => ({
    context,
    ...meta,
  }));
}

export function isValidHelpContext(context: string): boolean {
  return CONTEXT_ID_RE.test(context);
}

function resolveHelpFile(relativeFile: string): string {
  const root = path.resolve(helpRoot());
  const resolved = path.resolve(root, relativeFile);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Недопустимый путь к файлу справки');
  }
  if (!resolved.endsWith('.md')) {
    throw new Error('Файл справки должен быть Markdown (.md)');
  }
  return resolved;
}

export function getHelpArticle(context: string): HelpArticle | null {
  if (!isValidHelpContext(context)) return null;

  const manifest = readManifest();
  const meta = manifest.topics[context];
  if (!meta?.file) return null;

  const filePath = resolveHelpFile(meta.file);
  if (!fs.existsSync(filePath)) return null;

  const markdown = fs.readFileSync(filePath, 'utf8');
  return {
    context,
    title: meta.title,
    description: meta.description,
    page: meta.page,
    markdown,
  };
}
