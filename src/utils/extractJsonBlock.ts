function stripReasoningBlocks(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
    .replace(/```thinking[\s\S]*?```/gi, '')
    .trim();
}

function removeTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1');
}

function extractBalancedJson(text: string, open: '{' | '[', close: '}' | ']'): string | null {
  const start = text.indexOf(open);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function collectJsonCandidates(text: string): string[] {
  const stripped = stripReasoningBlocks(text.trim());
  const candidates: string[] = [];

  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRe.exec(stripped)) !== null) {
    candidates.push(match[1].trim());
  }

  candidates.push(stripped);

  const object = extractBalancedJson(stripped, '{', '}');
  if (object) candidates.push(object);

  const array = extractBalancedJson(stripped, '[', ']');
  if (array) candidates.push(array);

  return [...new Set(candidates)].filter(Boolean);
}

function tryParseJson(raw: string): unknown {
  const variants = [raw, removeTrailingCommas(raw)];
  let lastError: unknown;
  for (const variant of variants) {
    try {
      return JSON.parse(variant);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function extractJsonBlock(text: string): unknown {
  const candidates = collectJsonCandidates(text);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return tryParseJson(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new SyntaxError('JSON not found');
}
