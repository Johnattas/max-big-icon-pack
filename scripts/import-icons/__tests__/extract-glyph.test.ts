import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PY = resolve(__dirname, '../extract-glyph.py');
const FONT = resolve(__dirname, '../../../atom-master/fonts/file-icons.woff2');

describe('extract-glyph.py', () => {
  it('gera SVG com path para um codepoint válido', () => {
    const dir = mkdtempSync(join(tmpdir(), 'glyph-'));
    const out = join(dir, 'x.svg');
    // 0xe600 = glifo real presente em file-icons.woff2 (e0a2 do brief não existe nesta fonte).
    execFileSync('python3', [PY, FONT, 'e600', '#90a959', out]);
    const svg = readFileSync(out, 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
    expect(svg.toLowerCase()).toContain('#90a959');
  });
});
