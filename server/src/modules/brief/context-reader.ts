import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * Project-context reader (L05 Context Folder, MVP).
 *
 * Reads markdown from the cloned repo's `specs/`, `docs/`, `insights/` roots so
 * the brief can be grounded in the project's own rules. This is the MVP stand-in
 * for per-agent manual attach metadata (future work): it is bounded (file + char
 * caps) and the text is treated as UNTRUSTED downstream (delimiter-wrapped +
 * injection guard in the prompt). Any fs error (no clone / no dir) → [].
 */

export interface ContextDoc {
  path: string;
  text: string;
}

const ROOTS = ['specs', 'docs', 'insights'];

export interface ContextOptions {
  maxFiles?: number;
  maxChars?: number;
  perFileChars?: number;
}

export async function readProjectContext(
  cloneRoot: string,
  opts: ContextOptions = {},
): Promise<ContextDoc[]> {
  const maxFiles = opts.maxFiles ?? 6;
  const maxChars = opts.maxChars ?? 6000;
  const perFileChars = opts.perFileChars ?? 1800;

  const out: ContextDoc[] = [];
  let budget = maxChars;
  for (const root of ROOTS) {
    if (out.length >= maxFiles || budget <= 0) break;
    const files = await walkMd(join(cloneRoot, root));
    for (const abs of files) {
      if (out.length >= maxFiles || budget <= 0) break;
      try {
        const raw = await readFile(abs, 'utf8');
        const text = raw.slice(0, Math.min(perFileChars, budget)).trim();
        if (!text) continue;
        budget -= text.length;
        out.push({ path: relative(cloneRoot, abs), text });
      } catch {
        /* unreadable file → skip */
      }
    }
  }
  return out;
}

async function walkMd(dir: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walkMd(p, depth + 1)));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) files.push(p);
  }
  return files.sort();
}
