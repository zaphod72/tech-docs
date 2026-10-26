import { describe, expect, it } from 'vitest';

import { PRESET_IDS, STYLE_PRESETS, parseDocStyleJson } from '../../src/styles/presets';

// Expected literals come from the plan Q4 spec (Module 3 StylePresetConfig
// id union), never recomputed from the implementation under test.
const EXPECTED_PRESET_IDS = [
  'diataxis-howto',
  'diataxis-reference',
  'architecture-deep-dive',
  'stripe-developer-guide',
  'chisle-terse',
] as const;

describe('validates 5 style presets and rejects invalid doc-style.json schema', () => {
  it('exposes exactly the 5 Q4 preset ids, in order', () => {
    expect(PRESET_IDS).toEqual([...EXPECTED_PRESET_IDS]);
  });

  it.each([...EXPECTED_PRESET_IDS])('defines preset %s with label, prompt modifiers, and structural rules', (id) => {
    const preset = STYLE_PRESETS.find((p) => p.id === id);
    expect(preset).toBeDefined();
    expect(preset!.label.length).toBeGreaterThan(0);
    expect(preset!.systemPromptModifiers.length).toBeGreaterThan(0);
    expect(preset!.structuralRules.length).toBeGreaterThan(0);
  });

  it('exposes 5 unique presets and nothing else', () => {
    expect(STYLE_PRESETS).toHaveLength(5);
    expect(new Set(STYLE_PRESETS.map((p) => p.id)).size).toBe(5);
  });

  it('accepts a valid doc-style.json pinning the winning preset id', () => {
    expect(parseDocStyleJson({ presetId: 'diataxis-howto' })).toEqual({
      presetId: 'diataxis-howto',
    });
  });

  it('accepts a valid doc-style.json with user guidance', () => {
    expect(
      parseDocStyleJson({ presetId: 'stripe-developer-guide', userGuidance: 'Prefer tabbed code samples.' }),
    ).toEqual({ presetId: 'stripe-developer-guide', userGuidance: 'Prefer tabbed code samples.' });
  });

  it.each([...EXPECTED_PRESET_IDS])('accepts winning preset id %s in doc-style.json', (presetId) => {
    expect(parseDocStyleJson({ presetId }).presetId).toBe(presetId);
  });

  it('rejects a doc-style.json with an unknown preset id', () => {
    expect(() => parseDocStyleJson({ presetId: 'not-a-preset' })).toThrow();
  });

  it('rejects a doc-style.json missing the preset id', () => {
    expect(() => parseDocStyleJson({})).toThrow();
  });

  it('rejects a doc-style.json with a non-string preset id', () => {
    expect(() => parseDocStyleJson({ presetId: 42 })).toThrow();
  });

  it('rejects a doc-style.json with a non-string user guidance', () => {
    expect(() => parseDocStyleJson({ presetId: 'diataxis-howto', userGuidance: 42 })).toThrow();
  });
});
