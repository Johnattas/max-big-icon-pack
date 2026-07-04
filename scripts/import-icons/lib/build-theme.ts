import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Manifest } from 'material-icon-theme';
import type { GeneratedIcon } from './types';

const DEF_PREFIX = 'mbip-';

export function buildTheme(
  base: Manifest,
  generated: GeneratedIcon[]
): Manifest {
  const theme: any = structuredClone(base);
  theme.iconDefinitions ??= {};
  theme.fileExtensions ??= {};
  theme.fileNames ??= {};
  theme.folderNames ??= {};
  theme.folderNamesExpanded ??= {};

  // Normaliza os iconPath da base do Material. O manifest gerado usa caminhos
  // como "./../icons/x.svg" (assumindo o theme dentro de dist/ e os SVGs num
  // "icons/" irmão). Aqui os SVGs são copiados para "<themeDir>/icons/", então
  // todo iconPath deve ser "icons/<arquivo>" — relativo à pasta do theme JSON.
  for (const val of Object.values<any>(theme.iconDefinitions)) {
    if (val && typeof val.iconPath === 'string') {
      val.iconPath = `icons/${basename(val.iconPath)}`;
    }
  }

  for (const g of generated) {
    const def = `${DEF_PREFIX}${g.concept}`;
    theme.iconDefinitions[def] = { iconPath: `icons/${g.iconFile}` };
    for (const ext of g.extensions) theme.fileExtensions[ext] = def;
    for (const name of g.fileNames) {
      if (g.kind === 'folder') {
        theme.folderNames[name] = def;
        theme.folderNamesExpanded[name] = def;
      } else {
        theme.fileNames[name] = def;
      }
    }
  }
  return theme as Manifest;
}

export function validateTheme(theme: Manifest, iconsDir: string): string[] {
  const t: any = theme;
  const problems: string[] = [];
  // O VSCode resolve cada iconPath relativo à pasta do arquivo de theme, que é
  // a pasta-mãe de iconsDir (theme em "<themeDir>/theme.json", ícones em
  // "<themeDir>/icons/"). Validar assim pega prefixos errados (ex.: "./../").
  const themeDir = dirname(iconsDir);
  for (const [def, val] of Object.entries<any>(t.iconDefinitions ?? {})) {
    const iconPath = val.iconPath ?? '';
    if (!iconPath || !existsSync(join(themeDir, iconPath))) {
      problems.push(`def ${def}: arquivo ausente (${iconPath})`);
    }
  }
  const defs = new Set(Object.keys(t.iconDefinitions ?? {}));
  for (const map of [
    'fileExtensions',
    'fileNames',
    'folderNames',
    'folderNamesExpanded',
  ] as const) {
    for (const [key, def] of Object.entries<string>(t[map] ?? {})) {
      if (!defs.has(def))
        problems.push(`${map}[${key}] -> def inexistente ${def}`);
    }
  }
  return problems;
}
