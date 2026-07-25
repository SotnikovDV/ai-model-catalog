/** Канонический ключ модели для сравнения и уникальности. */
export function normalizeModelName(name: string): string {
  return name.trim().toLowerCase();
}
