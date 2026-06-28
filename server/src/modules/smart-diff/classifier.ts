import type { SmartDiffRole } from '@devdigest/shared';
import { BOILERPLATE_PATTERNS, WIRING_PATTERNS } from './constants.js';

/**
 * Classify a file path into a Smart Diff role.
 * Pure function — deterministic, no I/O, no LLM.
 *
 * Priority: boilerplate > wiring > core (default).
 */
export function classifyFile(path: string): SmartDiffRole {
  for (const re of BOILERPLATE_PATTERNS) {
    if (re.test(path)) return 'boilerplate';
  }
  for (const re of WIRING_PATTERNS) {
    if (re.test(path)) return 'wiring';
  }
  return 'core';
}
