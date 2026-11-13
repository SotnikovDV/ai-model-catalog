export function isSqliteCorruptError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('malformed')
    || message.includes('not a database')
    || message.includes('disk i/o error')
    || message.includes('database disk image is malformed')
    || /\bcorrupt/i.test(error.message);
}
