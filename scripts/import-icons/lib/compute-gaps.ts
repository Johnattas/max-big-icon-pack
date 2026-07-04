import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AfiEntry, AtomEntry, GapItem, GlyphRef } from './types';

export type ComputeGapsInput = {
  atom: AtomEntry[];
  afi: AfiEntry[];
  coverage: {
    extensions: Set<string>;
    fileNames: Set<string>;
    folderNames: Set<string>;
    concepts: Set<string>;
  };
  glyphs: Map<string, GlyphRef>;
  colours: Map<string, string>;
  afiPngDir: string;
  afiColors: Map<string, string>;
};

function pngFor(dir: string, concept: string): string | null {
  for (const suffix of ['@3x', '@2x', '']) {
    const p = join(dir, `${concept}${suffix}.png`);
    if (existsSync(p)) return p;
  }
  return null;
}

export function computeGaps(input: ComputeGapsInput): GapItem[] {
  const { atom, afi, coverage, glyphs, colours, afiPngDir, afiColors } = input;
  const taken = new Set<string>(); // extensões/nomes já resolvidos
  const gaps: GapItem[] = [];

  const covered = (kind: string, ext: string[], names: string[]) => {
    const nameSet =
      kind === 'folder' ? coverage.folderNames : coverage.fileNames;
    return (
      ext.some(
        (e) =>
          coverage.extensions.has(e.toLowerCase()) ||
          taken.has(`e:${e.toLowerCase()}`)
      ) ||
      names.some(
        (n) =>
          nameSet.has(n.toLowerCase()) ||
          taken.has(`n:${kind}:${n.toLowerCase()}`)
      )
    );
  };
  const claim = (kind: string, ext: string[], names: string[]) => {
    for (const e of ext) taken.add(`e:${e.toLowerCase()}`);
    for (const n of names) taken.add(`n:${kind}:${n.toLowerCase()}`);
  };

  // 1) atom (prioridade) — só coloridos com fonte extraível
  const atomByKindConcept = new Map<string, GapItem>();
  for (const e of atom) {
    if (coverage.concepts.has(e.concept)) continue;
    if (covered(e.kind, e.extensions, e.fileNames)) continue;
    const glyph = glyphs.get(e.concept);
    const hex = e.colour ? (colours.get(e.colour) ?? null) : null;
    if (!glyph || glyph.font === null || !hex) continue; // não colorido/extraível
    if (e.extensions.length === 0 && e.fileNames.length === 0) continue;
    claim(e.kind, e.extensions, e.fileNames);

    const mergeKey = `${e.kind}:${e.concept}`;
    const existing = atomByKindConcept.get(mergeKey);
    if (existing) {
      // merge extensions/fileNames into the first-accepted gap; first wins for hex/glyph/kind
      for (const ext of e.extensions) {
        if (!existing.extensions.includes(ext)) existing.extensions.push(ext);
      }
      for (const n of e.fileNames) {
        if (!existing.fileNames.includes(n)) existing.fileNames.push(n);
      }
      continue;
    }

    const gap: GapItem = {
      concept: e.concept,
      kind: e.kind,
      source: 'atom',
      extensions: [...e.extensions],
      fileNames: [...e.fileNames],
      hex,
      glyph,
      pngPath: null,
    };
    atomByKindConcept.set(mergeKey, gap);
    gaps.push(gap);
  }

  // 2) AFileIcon — só o que sobrou (sempre kind 'file'); precisa de PNG
  for (const e of afi) {
    if (e.extensions.length === 0) continue;
    if (coverage.concepts.has(e.concept)) continue;
    if (covered('file', e.extensions, [])) continue;
    const png = pngFor(afiPngDir, e.concept);
    if (!png) continue;
    claim('file', e.extensions, []);
    gaps.push({
      concept: e.concept,
      kind: 'file',
      source: 'afileicon',
      extensions: e.extensions,
      fileNames: [],
      hex: e.color ? (afiColors.get(e.color) ?? null) : null,
      glyph: null,
      pngPath: png,
    });
  }

  return gaps;
}
