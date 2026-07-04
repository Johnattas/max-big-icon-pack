import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeMatch, parseConfigCson } from '../lib/parse-config-cson';

const CSON = resolve(__dirname, '../../../atom-master/config.cson');

describe('normalizeMatch', () => {
  it('extrai extensão de /\\.ext$/', () => {
    expect(normalizeMatch(/\.agda$/i)).toEqual({
      extensions: ['agda'],
      fileNames: [],
    });
  });
  it('extrai múltiplas extensões de grupo', () => {
    const r = normalizeMatch(/\.(app|xcodeproj)$/i);
    expect(r.extensions.sort()).toEqual(['app', 'xcodeproj']);
  });
  it('extrai fileName de /^\\.name$/', () => {
    expect(normalizeMatch(/^\.atom$/)).toEqual({
      extensions: [],
      fileNames: ['.atom'],
    });
  });
  it('string vira extensão', () => {
    expect(normalizeMatch('.json')).toEqual({
      extensions: ['json'],
      fileNames: [],
    });
  });
});

describe('parseConfigCson', () => {
  it('lê arquivos e pastas do config real', () => {
    const entries = parseConfigCson(CSON);
    expect(entries.length).toBeGreaterThan(100);
    const agda = entries.find((e) => e.concept === 'agda');
    expect(agda?.kind).toBe('file');
    expect(agda?.extensions).toContain('agda');
    expect(agda?.colour).toBe('dark-cyan');
    expect(entries.some((e) => e.kind === 'folder')).toBe(true);
  });
});
