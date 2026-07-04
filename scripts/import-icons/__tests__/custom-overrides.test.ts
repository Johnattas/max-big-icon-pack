import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyFileRecolors,
  applyOverrides,
  recolorAllFills,
  recolorSvg,
} from '../lib/custom-overrides';

const FOLDER_SVG = (folder: string, motive: string) =>
  `<svg viewBox="0 0 16 16"><path id="folder" fill="${folder}" d="m1 1"/><path id="motive" fill="${motive}" d="m2 2"/></svg>`;

describe('recolorSvg', () => {
  it('troca os fills de folder e motive', () => {
    const out = recolorSvg(
      FOLDER_SVG('#43a047', '#c8e6c9'),
      '#ec407a',
      '#f8bbd0'
    );
    expect(out).toContain('id="folder" fill="#ec407a"');
    expect(out).toContain('id="motive" fill="#f8bbd0"');
    expect(out).not.toContain('#43a047');
  });
});

describe('applyOverrides', () => {
  it('recolore routes e mapeia pasta para ícone material', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ov-'));
    const iconsDir = join(dir, 'icons');
    mkdirSync(iconsDir);
    // fontes que os overrides consomem
    writeFileSync(
      join(iconsDir, 'folder-routes.svg'),
      FOLDER_SVG('#43a047', '#c8e6c9')
    );
    writeFileSync(
      join(iconsDir, 'folder-routes-open.svg'),
      FOLDER_SVG('#43a047', '#c8e6c9')
    );

    const theme: any = {
      iconDefinitions: {
        'folder-routes': { iconPath: 'icons/folder-routes.svg' },
        'folder-store': { iconPath: 'icons/folder-store.svg' },
        'folder-store-open': { iconPath: 'icons/folder-store-open.svg' },
      },
      folderNames: {},
      folderNamesExpanded: {},
    };

    // FOLDER_RECOLORS inclui 'resources' cuja origem não existe aqui -> vira problema esperado
    const problems = applyOverrides(theme, iconsDir);

    // recolor routes: novo SVG gerado com rosa
    const recolored = readFileSync(
      join(iconsDir, 'mbip-folder-routes.svg'),
      'utf8'
    );
    expect(recolored).toContain('#ec407a');
    expect(theme.iconDefinitions['mbip-folder-routes'].iconPath).toBe(
      'icons/mbip-folder-routes.svg'
    );
    expect(theme.folderNames['routes']).toBe('mbip-folder-routes');
    expect(theme.folderNamesExpanded['routes']).toBe('mbip-folder-routes-open');

    // mapeamento: storage -> folder-store (+ open)
    expect(theme.folderNames['storage']).toBe('folder-store');
    expect(theme.folderNamesExpanded['storage']).toBe('folder-store-open');

    // origem ausente é reportada, não quebra
    expect(problems.some((p) => p.includes('resources'))).toBe(true);
  });
});

describe('recolorAllFills', () => {
  it('troca todos os fills por uma cor', () => {
    const out = recolorAllFills(
      '<svg><path fill="#8bc34a" d="a"/><path fill="#333" d="b"/></svg>',
      '#e53935'
    );
    expect(out).toBe(
      '<svg><path fill="#e53935" d="a"/><path fill="#e53935" d="b"/></svg>'
    );
  });
});

describe('applyFileRecolors', () => {
  it('recolore package/composer e mapeia em fileNames', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fr-'));
    writeFileSync(
      join(dir, 'nodejs.svg'),
      '<svg><path fill="#8bc34a" d="a"/></svg>'
    );
    writeFileSync(join(dir, 'vite.svg'), '<svg><path fill="#a0f" d="a"/></svg>');
    const theme: any = { iconDefinitions: {}, fileNames: {} };
    const problems = applyFileRecolors(theme, dir);

    // package.json -> verde; package-lock.json -> vermelho (base nodejs recolorido)
    expect(theme.fileNames['package.json']).toBe('mbip-file-package.json');
    expect(theme.fileNames['package-lock.json']).toBe(
      'mbip-file-package-lock.json'
    );
    const green = readFileSync(join(dir, 'mbip-file-package.json.svg'), 'utf8');
    const red = readFileSync(
      join(dir, 'mbip-file-package-lock.json.svg'),
      'utf8'
    );
    expect(green).toContain('#4caf50');
    expect(red).toContain('#e53935');

    // composer.* vem do simple-icons (colorido direto)
    expect(theme.fileNames['composer.json']).toBe('mbip-file-composer.json');
    expect(theme.fileNames['composer.lock']).toBe('mbip-file-composer.lock');
    expect(
      readFileSync(join(dir, 'mbip-file-composer.json.svg'), 'utf8')
    ).toContain('#4caf50');
    expect(problems).toEqual([]);
  });
});
