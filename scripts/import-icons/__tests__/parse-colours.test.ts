import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseColours } from '../lib/parse-colours';

const COLOURS = resolve(__dirname, '../../../atom-master/styles/colours.less');

describe('parseColours', () => {
  it('resolve cores base e derivadas para hex', async () => {
    const m = await parseColours(COLOURS);
    expect(m.get('medium-green')).toBe('#90a959'); // @green
    // dark-green = darken(@green,15%) -> mais escuro que o base
    const dark = m.get('dark-green')!;
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(dark).not.toBe('#90a959');
  });

  it('não inclui variáveis que não são cor (ex.: adjust-tone)', async () => {
    const m = await parseColours(COLOURS);
    expect(m.has('adjust-tone')).toBe(false);
    for (const v of m.values()) expect(v).toMatch(/^#[0-9a-f]{6}$/);
  });
});
