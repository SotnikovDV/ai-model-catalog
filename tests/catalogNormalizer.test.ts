import { describe, expect, it } from 'vitest';
import {
  mapBotHubFeaturesToCapabilities,
  mergeCatalogData,
} from '../src/services/catalogNormalizer.js';

describe('mapBotHubFeaturesToCapabilities modality', () => {
  it('определяет multimodal для text + image features', () => {
    const caps = mapBotHubFeaturesToCapabilities([
      'TEXT_TO_TEXT',
      'IMAGE_TO_TEXT',
      'TOOLS',
    ]);

    expect(caps.modality).toBe('multimodal');
    expect(caps.supports_vision).toBe(true);
  });

  it('определяет image для генераторов вроде DALL-E', () => {
    const caps = mapBotHubFeaturesToCapabilities(['TEXT_TO_IMAGE']);

    expect(caps.modality).toBe('image');
    expect(caps.supports_vision).toBe(true);
  });
});

describe('mergeCatalogData capabilities', () => {
  it('не затирает true значением false из более позднего источника', () => {
    const merged = mergeCatalogData(
      {
        supports_json_mode: true,
        supports_web_search: true,
        supports_vision: true,
        sources: ['openrouter'],
      },
      {
        supports_json_mode: false,
        supports_web_search: false,
        supports_vision: false,
        supports_function_calling: true,
        supports_streaming: true,
        sources: ['bothub-openai'],
      },
      {
        supports_web_search: true,
        sources: ['bothub-list'],
      },
    );

    expect(merged.supports_json_mode).toBe(true);
    expect(merged.supports_web_search).toBe(true);
    expect(merged.supports_vision).toBe(true);
    expect(merged.supports_function_calling).toBe(true);
    expect(merged.supports_streaming).toBe(true);
  });

  it('оставляет false если ни один источник не сообщил true', () => {
    const merged = mergeCatalogData(
      { supports_web_search: false, sources: ['bothub-openai'] },
      { supports_json_mode: false, sources: ['bothub-list'] },
    );

    expect(merged.supports_web_search).toBe(false);
    expect(merged.supports_json_mode).toBe(false);
  });
});

describe('mergeCatalogData modality', () => {
  it('не затирает multimodal значением text из более позднего источника', () => {
    const merged = mergeCatalogData(
      {
        modality: 'multimodal',
        supports_vision: true,
        sources: ['openrouter'],
      },
      {
        modality: 'multimodal',
        tags: ['text_to_text', 'image_to_text', 'tools'],
        supports_vision: true,
        sources: ['bothub-list'],
      },
      {
        modality: 'text',
        supports_vision: false,
        sources: ['bothub-page'],
      },
    );

    expect(merged.modality).toBe('multimodal');
    expect(merged.supports_vision).toBe(true);
  });

  it('восстанавливает multimodal по bothub-тегам, если modality была сброшена в text', () => {
    const merged = mergeCatalogData(
      {
        modality: 'text',
        tags: ['text_to_text', 'image_to_text', 'tools'],
        supports_vision: true,
        sources: ['bothub-list'],
      },
    );

    expect(merged.modality).toBe('multimodal');
  });

  it('сохраняет image для генераторов изображений', () => {
    const merged = mergeCatalogData(
      {
        modality: 'image',
        tags: ['text_to_image'],
        supports_vision: true,
        sources: ['bothub-list'],
      },
      {
        modality: 'text',
        sources: ['bothub-page'],
      },
    );

    expect(merged.modality).toBe('image');
  });
});
