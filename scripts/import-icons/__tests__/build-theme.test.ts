import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTheme, validateTheme } from '../lib/build-theme';
import type { GeneratedIcon } from '../lib/types';

const base: any = {
  // caminho no estilo do manifest gerado pelo material-icon-theme (theme em
  // dist/, ícones num "icons/" irmão) — buildTheme deve normalizar isto.
  iconDefinitions: { typescript: { iconPath: './../icons/typescript.svg' } },
  fileExtensions: { ts: 'typescript' },
  fileNames: {},
  folderNames: {},
};
const generated: GeneratedIcon[] = [
  {
    concept: 'pinia',
    kind: 'file',
    iconFile: 'pinia.svg',
    extensions: ['pinia'],
    fileNames: [],
    source: 'atom',
  },
];

const generatedFolder: GeneratedIcon[] = [
  {
    concept: 'store',
    kind: 'folder',
    iconFile: 'store.svg',
    extensions: [],
    fileNames: ['store'],
    source: 'atom',
  },
];

describe('buildTheme', () => {
  it('adiciona def e associação de extensão', () => {
    const t: any = buildTheme(base, generated);
    expect(t.iconDefinitions['mbip-pinia']).toEqual({
      iconPath: 'icons/pinia.svg',
    });
    expect(t.fileExtensions['pinia']).toBe('mbip-pinia');
    expect(t.fileExtensions['ts']).toBe('typescript'); // base preservada
  });

  it('normaliza os iconPath da base para icons/<arquivo>', () => {
    const t: any = buildTheme(base, generated);
    // "./../icons/typescript.svg" -> "icons/typescript.svg"
    expect(t.iconDefinitions['typescript'].iconPath).toBe(
      'icons/typescript.svg'
    );
  });

  it('adiciona ícone de pasta em folderNames e folderNamesExpanded', () => {
    const t: any = buildTheme(base, generatedFolder);
    expect(t.folderNames['store']).toBe('mbip-store');
    expect(t.folderNamesExpanded['store']).toBe('mbip-store');
  });

  it('valida arquivos presentes e pega prefixo errado', () => {
    // layout real: theme em <themeDir>/theme.json, ícones em <themeDir>/icons/
    const themeDir = mkdtempSync(join(tmpdir(), 'theme-'));
    const iconsDir = join(themeDir, 'icons');
    mkdirSync(iconsDir);
    writeFileSync(join(iconsDir, 'pinia.svg'), '<svg/>');

    const ok: any = {
      iconDefinitions: { 'mbip-pinia': { iconPath: 'icons/pinia.svg' } },
      fileExtensions: { pinia: 'mbip-pinia' },
    };
    expect(validateTheme(ok, iconsDir)).toEqual([]);

    // prefixo "./../icons/..." resolve para fora do themeDir -> erro
    const wrongPrefix: any = {
      iconDefinitions: { y: { iconPath: './../icons/pinia.svg' } },
      fileExtensions: {},
    };
    expect(validateTheme(wrongPrefix, iconsDir).length).toBe(1);

    // arquivo ausente -> erro
    const missing: any = {
      iconDefinitions: { x: { iconPath: 'icons/missing.svg' } },
      fileExtensions: {},
    };
    expect(validateTheme(missing, iconsDir).length).toBe(1);
  });
});
