import { resolveFont } from './fonts';
import type { GlyphRef } from './types';

const RULE = /\.([\w+.-]+)-icon:before\s*\{([^}]*)\}/g;
const MIXIN = /\.(fi|devicons|fa|mf|octicons)\b/;
const CONTENT = /content:\s*"\\([0-9a-fA-F]+)"/;

export function parseIconsLess(src: string): Map<string, GlyphRef> {
  const out = new Map<string, GlyphRef>();
  for (const m of src.matchAll(RULE)) {
    const name = m[1];
    const body = m[2];
    const mixin = body.match(MIXIN)?.[1];
    const content = body.match(CONTENT)?.[1];
    if (!mixin || !content) continue;
    out.set(name, {
      font: resolveFont(mixin),
      codepoint: parseInt(content, 16),
    });
  }
  return out;
}
