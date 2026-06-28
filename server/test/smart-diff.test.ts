import { describe, it, expect } from 'vitest';
import { classifyFile } from '../src/modules/smart-diff/classifier.js';
import { buildSmartDiff } from '../src/modules/smart-diff/service.js';
import { SmartDiff } from '@devdigest/shared';

describe('Smart Diff classifier', () => {
  it('classifies lock files as boilerplate', () => {
    expect(classifyFile('package-lock.json')).toBe('boilerplate');
    expect(classifyFile('pnpm-lock.yaml')).toBe('boilerplate');
    expect(classifyFile('yarn.lock')).toBe('boilerplate');
    expect(classifyFile('Cargo.lock')).toBe('boilerplate');
    expect(classifyFile('go.sum')).toBe('boilerplate');
  });

  it('classifies build/dist output as boilerplate', () => {
    expect(classifyFile('dist/main.js')).toBe('boilerplate');
    expect(classifyFile('build/bundle.js')).toBe('boilerplate');
    expect(classifyFile('.next/cache/foo.json')).toBe('boilerplate');
  });

  it('classifies snapshots as boilerplate', () => {
    expect(classifyFile('src/__snapshots__/foo.snap')).toBe('boilerplate');
    expect(classifyFile('test/Component.test.tsx.snap')).toBe('boilerplate');
  });

  it('classifies config files as wiring', () => {
    expect(classifyFile('tsconfig.json')).toBe('wiring');
    expect(classifyFile('tsconfig.build.json')).toBe('wiring');
    expect(classifyFile('vitest.config.ts')).toBe('wiring');
    expect(classifyFile('next.config.mjs')).toBe('wiring');
    expect(classifyFile('Dockerfile')).toBe('wiring');
    expect(classifyFile('.github/workflows/ci.yml')).toBe('wiring');
    expect(classifyFile('.gitignore')).toBe('wiring');
  });

  it('classifies package.json as wiring (not boilerplate)', () => {
    expect(classifyFile('package.json')).toBe('wiring');
    expect(classifyFile('server/package.json')).toBe('wiring');
  });

  it('classifies index/barrel files as wiring', () => {
    expect(classifyFile('src/modules/index.ts')).toBe('wiring');
    expect(classifyFile('lib/index.js')).toBe('wiring');
  });

  it('classifies i18n/locale files as wiring', () => {
    expect(classifyFile('messages/en/prReview.json')).toBe('wiring');
    expect(classifyFile('locales/ua.json')).toBe('wiring');
  });

  it('classifies migration files as wiring', () => {
    expect(classifyFile('migrations/0001_initial.sql')).toBe('wiring');
    expect(classifyFile('drizzle/0002_add_intent.sql')).toBe('wiring');
  });

  it('classifies business logic as core (default)', () => {
    expect(classifyFile('src/modules/reviews/service.ts')).toBe('core');
    expect(classifyFile('src/components/SmartDiff.tsx')).toBe('core');
    expect(classifyFile('server/src/adapters/llm/openai.ts')).toBe('core');
    expect(classifyFile('lib/hooks/reviews.ts')).toBe('core');
  });
});

describe('Smart Diff service', () => {
  it('groups files by role with correct order (core → wiring → boilerplate)', () => {
    const result = buildSmartDiff(
      [
        { path: 'src/service.ts', additions: 50, deletions: 10 },
        { path: 'package-lock.json', additions: 5000, deletions: 3000 },
        { path: 'tsconfig.json', additions: 2, deletions: 1 },
        { path: 'src/handler.ts', additions: 30, deletions: 5 },
      ],
      [],
    );

    expect(result.groups).toHaveLength(3);
    expect(result.groups[0]!.role).toBe('core');
    expect(result.groups[0]!.files).toHaveLength(2);
    expect(result.groups[1]!.role).toBe('wiring');
    expect(result.groups[1]!.files).toHaveLength(1);
    expect(result.groups[2]!.role).toBe('boilerplate');
    expect(result.groups[2]!.files).toHaveLength(1);
  });

  it('attaches finding_lines from findings to matching files', () => {
    const result = buildSmartDiff(
      [{ path: 'src/api.ts', additions: 84, deletions: 0 }],
      [
        { file: 'src/api.ts', start_line: 28, end_line: 30 },
        { file: 'src/api.ts', start_line: 52, end_line: 52 },
      ],
    );

    expect(result.groups[0]!.files[0]!.finding_lines).toEqual([28, 29, 30, 52]);
  });

  it('sets too_big when total lines exceed threshold', () => {
    const files = Array.from({ length: 20 }, (_, i) => ({
      path: `src/file${i}.ts`,
      additions: 30,
      deletions: 5,
    }));
    const result = buildSmartDiff(files, []);
    expect(result.split_suggestion.too_big).toBe(true);
    expect(result.split_suggestion.total_lines).toBe(700);
    expect(result.split_suggestion.proposed_splits.length).toBeGreaterThan(0);
  });

  it('does not suggest split for small PRs', () => {
    const result = buildSmartDiff(
      [{ path: 'src/a.ts', additions: 10, deletions: 5 }],
      [],
    );
    expect(result.split_suggestion.too_big).toBe(false);
    expect(result.split_suggestion.proposed_splits).toEqual([]);
  });

  it('output validates against SmartDiff zod schema', () => {
    const result = buildSmartDiff(
      [
        { path: 'src/core.ts', additions: 84, deletions: 0 },
        { path: 'package-lock.json', additions: 1000, deletions: 500 },
      ],
      [{ file: 'src/core.ts', start_line: 28, end_line: 52 }],
    );

    expect(() => SmartDiff.parse(result)).not.toThrow();
  });

  it('sorts files with findings first within a group', () => {
    const result = buildSmartDiff(
      [
        { path: 'src/a.ts', additions: 100, deletions: 0 },
        { path: 'src/b.ts', additions: 10, deletions: 0 },
      ],
      [{ file: 'src/b.ts', start_line: 5, end_line: 5 }],
    );

    expect(result.groups[0]!.files[0]!.path).toBe('src/b.ts');
    expect(result.groups[0]!.files[1]!.path).toBe('src/a.ts');
  });
});
