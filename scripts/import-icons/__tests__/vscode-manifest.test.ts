import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('vscode manifest', () => {
  it('contribui um iconTheme válido', () => {
    const p = resolve(__dirname, '../../../dist-theme/package.json');
    const pkg = JSON.parse(readFileSync(p, 'utf8'));
    const theme = pkg.contributes?.iconThemes?.[0];
    expect(theme?.id).toBe('max-big-icon-pack');
    expect(theme?.path).toBe('./max-big-icon-theme.json');
    expect(pkg.engines?.vscode).toBeTruthy();
  });
});
