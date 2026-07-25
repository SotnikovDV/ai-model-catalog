import taxonomy from '../data/useCaseTaxonomy.json' with { type: 'json' };

export interface UseCaseCategory {
  id: string;
  label: string;
  order: number;
}

export interface CanonicalUseCase {
  id: string;
  label: string;
  categoryId: string;
}

interface UseCaseTaxonomy {
  categories: UseCaseCategory[];
  useCases: CanonicalUseCase[];
  aliases: Record<string, string>;
}

const data = taxonomy as UseCaseTaxonomy;

const categoriesById = new Map(data.categories.map((c) => [c.id, c]));
const categoryLabelById = new Map(data.categories.map((c) => [c.id, c.label]));
const canonicalLabels = new Set(data.useCases.map((u) => u.label));
const useCaseCategoryByLabel = new Map(data.useCases.map((u) => [u.label, u.categoryId]));

export function getUseCaseCategories(): UseCaseCategory[] {
  return [...data.categories].sort((a, b) => a.order - b.order);
}

export function getUseCaseCategoryLabels(): string[] {
  return getUseCaseCategories().map((c) => c.label);
}

export function getCanonicalUseCaseLabels(): string[] {
  return data.useCases.map((u) => u.label);
}

function resolveCanonicalLabel(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (canonicalLabels.has(trimmed)) return trimmed;
  const alias = data.aliases[trimmed];
  if (alias && canonicalLabels.has(alias)) return alias;
  return null;
}

export function normalizeUseCases(raw: string[] | string | undefined | null): string[] {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(String) : [raw];
          } catch {
            return [raw];
          }
        })()
      : [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const canonical = resolveCanonicalLabel(String(item));
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }

  return result;
}

export function getCategoryLabelForUseCase(useCaseLabel: string): string | null {
  const canonical = resolveCanonicalLabel(useCaseLabel);
  if (!canonical) return null;
  const categoryId = useCaseCategoryByLabel.get(canonical);
  if (!categoryId) return null;
  return categoryLabelById.get(categoryId) ?? null;
}

export function getCategoriesForUseCases(useCases: string[] | string | undefined | null): string[] {
  const normalized = normalizeUseCases(useCases);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const label of normalized) {
    const categoryId = useCaseCategoryByLabel.get(label);
    if (!categoryId) continue;
    const categoryLabel = categoryLabelById.get(categoryId);
    if (!categoryLabel || seen.has(categoryLabel)) continue;
    seen.add(categoryLabel);
    result.push(categoryLabel);
  }

  const orderMap = new Map(getUseCaseCategories().map((c) => [c.label, c.order]));
  return result.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));
}

export function isValidCanonicalUseCase(label: string): boolean {
  return canonicalLabels.has(label.trim());
}

export function buildAiUseCasesPromptSection(): string {
  const lines: string[] = [];
  for (const category of getUseCaseCategories()) {
    lines.push(`[${category.label}]`);
    for (const useCase of data.useCases.filter((u) => u.categoryId === category.id)) {
      lines.push(`- ${useCase.label}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function getCategoryById(id: string): UseCaseCategory | undefined {
  return categoriesById.get(id);
}
