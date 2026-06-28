/**
 * Smart Diff classification patterns and thresholds.
 * Every file in a PR is classified as core / wiring / boilerplate
 * purely by its path — no LLM call required.
 *
 * Order matters: boilerplate is checked first (lock-files beat everything),
 * then wiring, and the default is core.
 */

/** Glob-style suffix/substring patterns → boilerplate (auto-collapsed). */
export const BOILERPLATE_PATTERNS: RegExp[] = [
  // Lock files
  /(?:^|\/)package-lock\.json$/,
  /(?:^|\/)pnpm-lock\.yaml$/,
  /(?:^|\/)yarn\.lock$/,
  /(?:^|\/)Gemfile\.lock$/,
  /(?:^|\/)Pipfile\.lock$/,
  /(?:^|\/)poetry\.lock$/,
  /(?:^|\/)composer\.lock$/,
  /(?:^|\/)Cargo\.lock$/,
  /(?:^|\/)go\.sum$/,
  // Build output / generated
  /(?:^|\/)dist\//,
  /(?:^|\/)build\//,
  /(?:^|\/)\.next\//,
  /(?:^|\/)out\//,
  /(?:^|\/)coverage\//,
  // Snapshots
  /__snapshots__\//,
  /\.snap$/,
  // Vendored / auto-generated
  /(?:^|\/)vendor\//,
  /(?:^|\/)generated\//,
  /\.gen\./,
  /\.generated\./,
  /\.min\.(js|css)$/,
  // IDE / editor
  /(?:^|\/)\.vscode\//,
  /(?:^|\/)\.idea\//,
];

/** Glob-style suffix/substring patterns → wiring (configs, index barrels, CI). */
export const WIRING_PATTERNS: RegExp[] = [
  // Config files
  /(?:^|\/)tsconfig[\w.-]*\.json$/,
  /(?:^|\/)\.eslintrc/,
  /(?:^|\/)eslint\.config\./,
  /(?:^|\/)\.prettierrc/,
  /(?:^|\/)prettier\.config\./,
  /(?:^|\/)jest\.config\./,
  /(?:^|\/)vitest\.config\./,
  /(?:^|\/)vite\.config\./,
  /(?:^|\/)next\.config\./,
  /(?:^|\/)tailwind\.config\./,
  /(?:^|\/)postcss\.config\./,
  /(?:^|\/)babel\.config\./,
  /(?:^|\/)\.babelrc/,
  /(?:^|\/)webpack\.config\./,
  /(?:^|\/)rollup\.config\./,
  /(?:^|\/)docker-compose/,
  /(?:^|\/)Dockerfile/,
  /(?:^|\/)\.dockerignore$/,
  /(?:^|\/)\.gitignore$/,
  /(?:^|\/)\.env\.example$/,
  /(?:^|\/)Makefile$/,
  /(?:^|\/)\.github\//,
  /(?:^|\/)\.husky\//,
  // Package manifests (not lock files — those are boilerplate)
  /(?:^|\/)package\.json$/,
  /(?:^|\/)pyproject\.toml$/,
  /(?:^|\/)Cargo\.toml$/,
  /(?:^|\/)go\.mod$/,
  // Index / barrel files
  /(?:^|\/)index\.(ts|js|tsx|jsx|mjs|cjs)$/,
  // DB migrations
  /(?:^|\/)migrations?\//,
  /(?:^|\/)drizzle\//,
  // i18n / locale files
  /(?:^|\/)messages\//,
  /(?:^|\/)locales?\//,
  /(?:^|\/)i18n\//,
];

/**
 * Threshold: if total changed lines (additions + deletions) exceed this,
 * the PR is flagged as "too big" with a split suggestion.
 */
export const SPLIT_THRESHOLD_LINES = 500;

/**
 * Maximum files per proposed split chunk.
 * When suggesting splits, core files are grouped into chunks of this size.
 */
export const SPLIT_CHUNK_SIZE = 8;
