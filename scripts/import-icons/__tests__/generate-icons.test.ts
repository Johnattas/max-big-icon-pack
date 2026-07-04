import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateIcons } from '../lib/generate-icons';
import type { GapItem } from '../lib/types';

const FONTS = resolve(__dirname, '../../../atom-master/fonts');
const PY = resolve(__dirname, '../extract-glyph.py');

describe('generateIcons', () => {
  it('gera SVG colorido para gap do atom', () => {
    const out = mkdtempSync(join(tmpdir(), 'gen-'));
    const gaps: GapItem[] = [
      {
        concept: 'acre',
        kind: 'file',
        source: 'atom',
        extensions: ['acre'],
        fileNames: [],
        hex: '#90a959',
        // 0xe0a2 (do brief original) não existe em file-icons.woff2 (ver Task 5);
        // 0xe600 é um codepoint real presente na fonte.
        glyph: { font: 'file-icons.woff2', codepoint: 0xe600 },
        pngPath: null,
      },
    ];
    const gen = generateIcons(gaps, {
      fontsDir: FONTS,
      pyScript: PY,
      outDir: out,
    });
    expect(gen).toHaveLength(1);
    const svg = join(out, gen[0].iconFile);
    expect(existsSync(svg)).toBe(true);
    expect(readFileSync(svg, 'utf8')).toContain('#90a959');
  });
});
