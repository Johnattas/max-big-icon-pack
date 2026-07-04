import { readFileSync } from 'node:fs';
import type { AfiEntry } from './types';

type Group = { extensions?: string[] };
type Def = { color?: string; aliases?: Group[]; syntaxes?: Group[] };

export function parseAfileicon(iconsJsonPath: string): AfiEntry[] {
  const data = JSON.parse(readFileSync(iconsJsonPath, 'utf8')) as Record<
    string,
    Def
  >;
  const out: AfiEntry[] = [];
  for (const concept of Object.keys(data)) {
    const def = data[concept];
    const exts = new Set<string>();
    for (const g of [...(def.aliases ?? []), ...(def.syntaxes ?? [])]) {
      for (const e of g.extensions ?? []) exts.add(e.toLowerCase());
    }
    out.push({
      concept,
      extensions: [...exts],
      color: def.color ?? null,
    });
  }
  return out;
}
