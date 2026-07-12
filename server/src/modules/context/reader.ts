import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * Project-context reader (L05 Context Folder).
 *
 * Lists every markdown file that lives under a `specs/`, `docs/` or `insights/`
 * directory at ANY depth in the repo clone (glob `**\/{specs,docs,insights}\/**\/*.md`),
 * and reads specific attached files back for the run-executor. The bodies are
 * treated as UNTRUSTED downstream (delimiter-wrapped + injection guard in the
 * prompt). Any fs error (no clone / no dir) → empty result, never throws.
 */

export type ContextSource = 'specs' | 'docs' | 'insights';
const ROOTS: ContextSource[] = ['specs', 'docs', 'insights'];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);

export interface ContextFileMeta {
  path: string;
  source: ContextSource;
  size: number;
  updatedAt: string;
  content?: string;
}

export interface ContextDoc {
  path: string;
  text: string;
}

/** The context-root segment a repo-relative path belongs to, if any. */
export function contextSourceOf(relPath: string): ContextSource | null {
  const segs = relPath.split(/[\\/]/);
  for (const s of segs) {
    if ((ROOTS as string[]).includes(s)) return s as ContextSource;
  }
  return null;
}

/**
 * List all markdown files under specs/docs/insights (any depth) in the clone.
 * When `withContent` is set, each file's body is included (bounded per file) so
 * the client can Preview without a second round-trip.
 */
export async function listContextFiles(
  cloneRoot: string,
  opts: { withContent?: boolean; perFileChars?: number } = {},
): Promise<ContextFileMeta[]> {
  const withContent = opts.withContent ?? true;
  const perFileChars = opts.perFileChars ?? 20000;
  const files = await walkMd(cloneRoot, cloneRoot, 0);
  const out: ContextFileMeta[] = [];
  for (const abs of files) {
    const rel = relative(cloneRoot, abs);
    const source = contextSourceOf(rel);
    if (!source) continue;
    try {
      const st = await stat(abs);
      const meta: ContextFileMeta = {
        path: rel,
        source,
        size: st.size,
        updatedAt: st.mtime.toISOString(),
      };
      if (withContent) {
        try {
          meta.content = (await readFile(abs, 'utf8')).slice(0, perFileChars);
        } catch {
          /* unreadable → omit content */
        }
      }
      out.push(meta);
    } catch {
      /* vanished between walk and stat → skip */
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Read the bodies of specific attached paths for prompt injection. Each path is
 * validated to be repo-relative, escape-free, and under a specs/docs/insights
 * segment before it is read. Bounded by file + char caps. Never throws.
 */
export async function readAttachedContext(
  cloneRoot: string,
  paths: string[],
  opts: { maxFiles?: number; perFileChars?: number; maxChars?: number } = {},
): Promise<ContextDoc[]> {
  const maxFiles = opts.maxFiles ?? 12;
  const perFileChars = opts.perFileChars ?? 4000;
  let budget = opts.maxChars ?? 24000;

  const out: ContextDoc[] = [];
  for (const rel of paths) {
    if (out.length >= maxFiles || budget <= 0) break;
    if (!isSafeContextPath(rel)) continue;
    try {
      const raw = await readFile(join(cloneRoot, rel), 'utf8');
      const text = raw.slice(0, Math.min(perFileChars, budget)).trim();
      if (!text) continue;
      budget -= text.length;
      out.push({ path: rel, text });
    } catch {
      /* unreadable / missing → skip */
    }
  }
  return out;
}

/** Guard against path traversal / absolute paths / out-of-scope reads. */
export function isSafeContextPath(rel: string): boolean {
  if (!rel || rel.startsWith('/') || rel.startsWith(sep)) return false;
  if (rel.includes('..')) return false;
  if (!rel.toLowerCase().endsWith('.md')) return false;
  return contextSourceOf(rel) !== null;
}

async function walkMd(root: string, dir: string, depth: number): Promise<string[]> {
  if (depth > 8) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.') {
      if (SKIP_DIRS.has(e.name)) continue;
    }
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walkMd(root, p, depth + 1)));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) files.push(p);
  }
  return files;
}
