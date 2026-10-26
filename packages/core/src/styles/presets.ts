import { z } from 'zod';

import type { StylePresetConfig } from '../types/index.js';

// The 5 winning-preset ids are the plan Q4 spec (Module 3 StylePresetConfig
// id union). Labels, prompt modifiers, and rules below are the minimal
// content each id implies; the ids themselves are the contract.
export const PRESET_IDS = [
  'diataxis-howto',
  'diataxis-reference',
  'architecture-deep-dive',
  'stripe-developer-guide',
  'chisle-terse',
] as const;

export type StylePresetId = (typeof PRESET_IDS)[number];

export const STYLE_PRESETS: StylePresetConfig[] = [
  {
    id: 'diataxis-howto',
    label: 'Diátaxis How-To',
    systemPromptModifiers: 'Write a task-oriented how-to: goal first, numbered steps, prerequisites up front.',
    structuralRules: [
      'State the goal in the first paragraph.',
      'Number each step; one action per step.',
      'List prerequisites before step 1.',
    ],
  },
  {
    id: 'diataxis-reference',
    label: 'Diátaxis Reference',
    systemPromptModifiers:
      'Write a dry technical reference: complete signatures, no narrative, every field documented.',
    structuralRules: [
      'Document every parameter, field, and return value.',
      'No tutorial narrative; state facts only.',
      'Keep entries in stable alphabetical or declaration order.',
    ],
  },
  {
    id: 'architecture-deep-dive',
    label: 'Architecture Deep Dive',
    systemPromptModifiers: 'Explain the system architecture: components, data flow, invariants, and trade-offs.',
    structuralRules: [
      'Name each component and its responsibility.',
      'Describe data flow end to end.',
      'Call out invariants and rejected alternatives.',
    ],
  },
  {
    id: 'stripe-developer-guide',
    label: 'Stripe Developer Guide',
    systemPromptModifiers:
      'Write a Stripe-style developer guide: concise prose, runnable code samples, copy-paste ready.',
    structuralRules: [
      'Pair every concept with a code sample.',
      'Keep samples runnable and copy-paste ready.',
      'Front-load the common path; relegate edge cases.',
    ],
  },
  {
    id: 'chisle-terse',
    label: 'Chisle Terse',
    systemPromptModifiers: 'Write tersely: shortest complete sentences, no filler, never restate the heading.',
    structuralRules: [
      'One idea per short paragraph.',
      'No filler phrases or restated headings.',
      'Prefer lists over prose where meaning is preserved.',
    ],
  },
];

export const docStyleFileSchema = z.object({
  presetId: z.enum(PRESET_IDS),
  userGuidance: z.string().optional(),
});

export type DocStyleFile = z.infer<typeof docStyleFileSchema>;

export function parseDocStyleJson(value: unknown): DocStyleFile {
  return docStyleFileSchema.parse(value);
}
