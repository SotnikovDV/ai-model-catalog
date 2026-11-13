import { describe, expect, it } from 'vitest';
import { isBatchInferenceModelId } from '../src/utils/modelIdVariants.js';

describe('isBatchInferenceModelId', () => {
  it('returns true for BotHub batch suffix', () => {
    expect(isBatchInferenceModelId('claude-haiku-4.5:batch')).toBe(true);
    expect(isBatchInferenceModelId(' GPT-5:Batch ')).toBe(true);
  });

  it('returns false for regular model ids', () => {
    expect(isBatchInferenceModelId('claude-haiku-4.5')).toBe(false);
    expect(isBatchInferenceModelId('gpt-4o')).toBe(false);
  });
});
