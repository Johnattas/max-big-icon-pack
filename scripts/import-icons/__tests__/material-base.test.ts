import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  loadMaterialManifest,
  materialCoverage,
  materialIconsDir,
} from '../lib/material-base';

describe('material-base', () => {
  it('carrega manifest e cobertura', () => {
    const m = loadMaterialManifest();
    const cov = materialCoverage(m);
    expect(cov.extensions.has('ts')).toBe(true);
    expect(cov.concepts.size).toBeGreaterThan(100);
  });
  it('localiza o diretório de SVGs com typescript.svg', () => {
    const dir = materialIconsDir();
    expect(existsSync(`${dir}/typescript.svg`)).toBe(true);
  });
});
