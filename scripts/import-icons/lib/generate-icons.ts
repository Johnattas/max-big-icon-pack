import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GapItem, GeneratedIcon } from './types';

function safeName(concept: string): string {
  return concept.replace(/[^\w.-]/g, '_').toLowerCase();
}

export function generateIcons(
  gaps: GapItem[],
  opts: { fontsDir: string; pyScript: string; outDir: string }
): GeneratedIcon[] {
  mkdirSync(opts.outDir, { recursive: true });
  const generated: GeneratedIcon[] = [];

  for (const g of gaps) {
    const base = safeName(g.concept);
    try {
      if (g.source === 'atom' && g.glyph?.font && g.hex) {
        const iconFile = `${base}.svg`;
        const out = join(opts.outDir, iconFile);
        execFileSync('python3', [
          opts.pyScript,
          join(opts.fontsDir, g.glyph.font),
          g.glyph.codepoint.toString(16),
          g.hex,
          out,
        ]);
        generated.push(toGenerated(g, iconFile));
      } else if (g.source === 'afileicon' && g.pngPath) {
        const iconFile = `${base}.png`;
        copyFileSync(g.pngPath, join(opts.outDir, iconFile));
        generated.push(toGenerated(g, iconFile));
      }
    } catch (err) {
      console.warn(
        `[generate-icons] pulando ${g.concept}: ${(err as Error).message}`
      );
    }
  }
  return generated;
}

function toGenerated(g: GapItem, iconFile: string): GeneratedIcon {
  return {
    concept: g.concept,
    kind: g.kind,
    iconFile,
    extensions: g.extensions,
    fileNames: g.fileNames,
    source: g.source,
  };
}
